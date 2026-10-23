import type { DatabaseSync } from 'node:sqlite';
import { config } from '@/config/config';
import { AppError, badRequest } from '@/middleware/error.middleware';
import { getDb, withTransaction } from '@/utils/database';
import { newId, type Pagination } from '@/utils/helpers';
import { taxCents } from '@/utils/money';

export type TransactionStatus = 'pending' | 'completed' | 'void' | 'refunded';

interface TransactionRow {
  id: string;
  reference: string;
  user_id: string;
  customer_id: string | null;
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  status: TransactionStatus;
  note: string;
  created_at: string;
  completed_at: string | null;
  cashier_name?: string;
  customer_name?: string | null;
  paid_cents?: number;
}

interface ItemRow {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  unit_price_cents: number;
  quantity: number;
  line_total_cents: number;
}

export interface TransactionItem {
  id: string;
  productId: string;
  name: string;
  sku: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

export interface Transaction {
  id: string;
  reference: string;
  userId: string;
  cashierName: string | null;
  customerId: string | null;
  customerName: string | null;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  status: TransactionStatus;
  note: string;
  createdAt: string;
  completedAt: string | null;
}

export interface SaleInput {
  userId: string;
  customerId?: string | null;
  items: { productId: string; quantity: number }[];
  discountCents?: number;
  note?: string;
}

const SELECT = `
  SELECT t.*, u.name AS cashier_name, c.name AS customer_name,
    (SELECT COALESCE(SUM(amount_cents), 0) FROM payments p
      WHERE p.transaction_id = t.id AND p.status = 'completed') AS paid_cents
  FROM transactions t
  LEFT JOIN users u ON u.id = t.user_id
  LEFT JOIN customers c ON c.id = t.customer_id`;

const toTransaction = (r: TransactionRow): Transaction => {
  const paid = r.paid_cents ?? 0;
  return {
    id: r.id,
    reference: r.reference,
    userId: r.user_id,
    cashierName: r.cashier_name ?? null,
    customerId: r.customer_id,
    customerName: r.customer_name ?? null,
    subtotalCents: r.subtotal_cents,
    discountCents: r.discount_cents,
    taxCents: r.tax_cents,
    totalCents: r.total_cents,
    paidCents: paid,
    balanceCents: Math.max(0, r.total_cents - paid),
    status: r.status,
    note: r.note,
    createdAt: r.created_at,
    completedAt: r.completed_at,
  };
};

const toItem = (r: ItemRow): TransactionItem => ({
  id: r.id,
  productId: r.product_id,
  name: r.name,
  sku: r.sku,
  unitPriceCents: r.unit_price_cents,
  quantity: r.quantity,
  lineTotalCents: r.line_total_cents,
});

function nextReference(db: DatabaseSync): string {
  const row = db.prepare("SELECT value FROM kv WHERE key = 'sale_seq'").get() as
    { value: string } | undefined;
  const seq = (row ? Number(row.value) : 0) + 1;
  db.prepare(
    "INSERT INTO kv (key, value) VALUES ('sale_seq', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(String(seq));
  return `S-${String(seq).padStart(6, '0')}`;
}

function restock(db: DatabaseSync, transactionId: string): void {
  db.prepare(
    `UPDATE products SET stock = stock + (
       SELECT SUM(quantity) FROM transaction_items i
       WHERE i.transaction_id = ? AND i.product_id = products.id)
     WHERE id IN (SELECT product_id FROM transaction_items WHERE transaction_id = ?)`,
  ).run(transactionId, transactionId);
}

export const TransactionModel = {
  /**
   * Creates a pending sale: validates every line, reserves stock, prices the
   * cart and writes the sale, all in one database transaction. Any failure
   * (unknown product, insufficient stock) leaves the database unchanged.
   */
  createSale(input: SaleInput): Transaction {
    const id = withTransaction((db) => {
      const merged = new Map<string, number>();
      for (const line of input.items) {
        merged.set(line.productId, (merged.get(line.productId) ?? 0) + line.quantity);
      }

      const lines: Omit<ItemRow, 'id'>[] = [];
      for (const [productId, quantity] of merged) {
        const product = db
          .prepare('SELECT id, name, sku, price_cents, stock, active FROM products WHERE id = ?')
          .get(productId) as
          | {
              id: string;
              name: string;
              sku: string;
              price_cents: number;
              stock: number;
              active: number;
            }
          | undefined;
        if (!product || product.active !== 1) {
          throw new AppError(`Product ${productId} not found`, 404);
        }
        const updated = db
          .prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?')
          .run(quantity, productId, quantity);
        if (updated.changes !== 1) {
          throw new AppError(
            `Insufficient stock for ${product.name}: ${product.stock} left, ${quantity} requested`,
            409,
          );
        }
        lines.push({
          product_id: productId,
          name: product.name,
          sku: product.sku,
          unit_price_cents: product.price_cents,
          quantity,
          line_total_cents: product.price_cents * quantity,
        });
      }

      if (input.customerId) {
        const exists = db.prepare('SELECT 1 FROM customers WHERE id = ?').get(input.customerId);
        if (!exists) throw new AppError('Customer not found', 404);
      }

      const subtotal = lines.reduce((sum, l) => sum + l.line_total_cents, 0);
      const discount = input.discountCents ?? 0;
      if (discount > subtotal) throw badRequest('Discount cannot exceed the subtotal');
      const tax = taxCents(subtotal - discount, config.store.taxRateBps);
      const total = subtotal - discount + tax;

      const saleId = newId();
      db.prepare(
        `INSERT INTO transactions
           (id, reference, user_id, customer_id, subtotal_cents, discount_cents, tax_cents, total_cents, status, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      ).run(
        saleId,
        nextReference(db),
        input.userId,
        input.customerId ?? null,
        subtotal,
        discount,
        tax,
        total,
        input.note ?? '',
      );
      const insertItem = db.prepare(
        `INSERT INTO transaction_items
           (id, transaction_id, product_id, name, sku, unit_price_cents, quantity, line_total_cents)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const l of lines) {
        insertItem.run(
          newId(),
          saleId,
          l.product_id,
          l.name,
          l.sku,
          l.unit_price_cents,
          l.quantity,
          l.line_total_cents,
        );
      }
      return saleId;
    });
    return this.findById(id)!;
  },

  findById(id: string): Transaction | undefined {
    const row = getDb().prepare(`${SELECT} WHERE t.id = ?`).get(id) as TransactionRow | undefined;
    return row && toTransaction(row);
  },

  findItemsByTransactionId(id: string): TransactionItem[] {
    const rows = getDb()
      .prepare('SELECT * FROM transaction_items WHERE transaction_id = ? ORDER BY rowid')
      .all(id) as unknown as ItemRow[];
    return rows.map(toItem);
  },

  list(
    filter: {
      status?: TransactionStatus;
      customerId?: string;
      from?: string;
      to?: string;
      search?: string;
    },
    page: Pagination,
  ): { items: Transaction[]; total: number } {
    const clauses: string[] = [];
    const params: string[] = [];
    if (filter.status) {
      clauses.push('t.status = ?');
      params.push(filter.status);
    }
    if (filter.customerId) {
      clauses.push('t.customer_id = ?');
      params.push(filter.customerId);
    }
    if (filter.from) {
      clauses.push('t.created_at >= ?');
      params.push(filter.from);
    }
    if (filter.to) {
      clauses.push('t.created_at < ?');
      params.push(filter.to);
    }
    if (filter.search) {
      clauses.push('t.reference LIKE ?');
      params.push(`%${filter.search.toUpperCase()}%`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const db = getDb();
    const total = (
      db.prepare(`SELECT COUNT(*) AS n FROM transactions t ${where}`).get(...params) as {
        n: number;
      }
    ).n;
    const rows = db
      .prepare(`${SELECT} ${where} ORDER BY t.created_at DESC, t.reference DESC LIMIT ? OFFSET ?`)
      .all(...params, page.limit, page.offset) as unknown as TransactionRow[];
    return { items: rows.map(toTransaction), total };
  },

  markCompleted(id: string): void {
    getDb()
      .prepare(
        "UPDATE transactions SET status = 'completed', completed_at = datetime('now') WHERE id = ? AND status = 'pending'",
      )
      .run(id);
  },

  /** Cancels a pending sale and returns its reserved stock. */
  void(id: string): Transaction {
    withTransaction((db) => {
      const row = db.prepare('SELECT status FROM transactions WHERE id = ?').get(id) as
        { status: TransactionStatus } | undefined;
      if (!row) throw new AppError('Transaction not found', 404);
      if (row.status !== 'pending') {
        throw new AppError(`Only pending sales can be voided (this one is ${row.status})`, 409);
      }
      restock(db, id);
      db.prepare("UPDATE transactions SET status = 'void' WHERE id = ?").run(id);
      db.prepare(
        "UPDATE payment_requests SET status = 'cancelled' WHERE transaction_id = ? AND status = 'pending'",
      ).run(id);
    });
    return this.findById(id)!;
  },

  /** Marks a completed sale refunded and optionally returns items to stock. */
  refund(id: string, opts: { restock: boolean; reason?: string }): Transaction {
    withTransaction((db) => {
      const row = db.prepare('SELECT status, note FROM transactions WHERE id = ?').get(id) as
        { status: TransactionStatus; note: string } | undefined;
      if (!row) throw new AppError('Transaction not found', 404);
      if (row.status !== 'completed') {
        throw new AppError(`Only completed sales can be refunded (this one is ${row.status})`, 409);
      }
      if (opts.restock) restock(db, id);
      const note = opts.reason
        ? `${row.note ? `${row.note}\n` : ''}Refund: ${opts.reason}`
        : row.note;
      db.prepare("UPDATE transactions SET status = 'refunded', note = ? WHERE id = ?").run(
        note,
        id,
      );
    });
    return this.findById(id)!;
  },
};
