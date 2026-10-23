import { getDb } from '@/utils/database';
import { likePattern, newId, type Pagination } from '@/utils/helpers';

interface ProductRow {
  id: string;
  name: string;
  sku: string;
  description: string;
  category: string;
  price_cents: number;
  stock: number;
  low_stock_threshold: number;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  description: string;
  category: string;
  priceCents: number;
  stock: number;
  lowStockThreshold: number;
  active: boolean;
  lowStock: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  name: string;
  sku: string;
  description?: string;
  category?: string;
  priceCents: number;
  stock?: number;
  lowStockThreshold?: number;
  active?: boolean;
}

export const toProduct = (r: ProductRow): Product => ({
  id: r.id,
  name: r.name,
  sku: r.sku,
  description: r.description,
  category: r.category,
  priceCents: r.price_cents,
  stock: r.stock,
  lowStockThreshold: r.low_stock_threshold,
  active: r.active === 1,
  lowStock: r.stock <= r.low_stock_threshold,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const COLUMNS: Record<keyof Omit<ProductInput, 'active'>, string> = {
  name: 'name',
  sku: 'sku',
  description: 'description',
  category: 'category',
  priceCents: 'price_cents',
  stock: 'stock',
  lowStockThreshold: 'low_stock_threshold',
};

export interface ProductFilter {
  search?: string;
  category?: string;
  lowStock?: boolean;
  includeInactive?: boolean;
}

function where(filter: ProductFilter): { sql: string; params: string[] } {
  const clauses: string[] = [];
  const params: string[] = [];
  if (!filter.includeInactive) clauses.push('active = 1');
  if (filter.search) {
    clauses.push("(name LIKE ? ESCAPE '\\' OR sku LIKE ? ESCAPE '\\')");
    params.push(likePattern(filter.search), likePattern(filter.search));
  }
  if (filter.category) {
    clauses.push('category = ?');
    params.push(filter.category);
  }
  if (filter.lowStock) clauses.push('stock <= low_stock_threshold');
  return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

export const ProductModel = {
  create(input: ProductInput): Product {
    const id = newId();
    getDb()
      .prepare(
        `INSERT INTO products (id, name, sku, description, category, price_cents, stock, low_stock_threshold, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.name,
        input.sku,
        input.description ?? '',
        input.category ?? 'General',
        input.priceCents,
        input.stock ?? 0,
        input.lowStockThreshold ?? 5,
        input.active === false ? 0 : 1,
      );
    return this.findById(id)!;
  },

  findById(id: string): Product | undefined {
    const row = getDb().prepare('SELECT * FROM products WHERE id = ?').get(id) as
      ProductRow | undefined;
    return row && toProduct(row);
  },

  findBySku(sku: string): Product | undefined {
    const row = getDb().prepare('SELECT * FROM products WHERE sku = ?').get(sku) as
      ProductRow | undefined;
    return row && toProduct(row);
  },

  list(filter: ProductFilter, page: Pagination): { items: Product[]; total: number } {
    const { sql, params } = where(filter);
    const db = getDb();
    const total = (
      db.prepare(`SELECT COUNT(*) AS n FROM products ${sql}`).get(...params) as {
        n: number;
      }
    ).n;
    const rows = db
      .prepare(`SELECT * FROM products ${sql} ORDER BY category, name LIMIT ? OFFSET ?`)
      .all(...params, page.limit, page.offset) as unknown as ProductRow[];
    return { items: rows.map(toProduct), total };
  },

  categories(): string[] {
    const rows = getDb()
      .prepare('SELECT DISTINCT category FROM products WHERE active = 1 ORDER BY category')
      .all() as { category: string }[];
    return rows.map((r) => r.category);
  },

  update(id: string, fields: Partial<ProductInput>): Product | undefined {
    const sets: string[] = [];
    const params: (string | number)[] = [];
    for (const [key, column] of Object.entries(COLUMNS)) {
      const value = fields[key as keyof typeof COLUMNS];
      if (value !== undefined) {
        sets.push(`${column} = ?`);
        params.push(value);
      }
    }
    if (fields.active !== undefined) {
      sets.push('active = ?');
      params.push(fields.active ? 1 : 0);
    }
    if (sets.length) {
      sets.push("updated_at = datetime('now')");
      getDb()
        .prepare(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`)
        .run(...params, id);
    }
    return this.findById(id);
  },

  /**
   * Deletes a product. Products that appear on past sales are archived
   * (active = 0) instead, so receipts and reports stay intact.
   */
  delete(id: string): 'deleted' | 'archived' {
    const db = getDb();
    const used = db.prepare('SELECT 1 FROM transaction_items WHERE product_id = ? LIMIT 1').get(id);
    if (used) {
      db.prepare("UPDATE products SET active = 0, updated_at = datetime('now') WHERE id = ?").run(
        id,
      );
      return 'archived';
    }
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    return 'deleted';
  },

  /** Adds `delta` (may be negative) to stock. Returns false if it would go below zero. */
  adjustStock(id: string, delta: number): boolean {
    const result = getDb()
      .prepare(
        "UPDATE products SET stock = stock + ?, updated_at = datetime('now') WHERE id = ? AND stock + ? >= 0",
      )
      .run(delta, id, delta);
    return result.changes === 1;
  },
};
