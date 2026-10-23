import { getDb } from '@/utils/database';
import { likePattern, newId, type Pagination } from '@/utils/helpers';

interface CustomerRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  stellar_address: string | null;
  notes: string;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  stellarAddress: string | null;
  notes: string;
  createdAt: string;
}

export interface CustomerStats {
  visits: number;
  lifetimeCents: number;
  lastVisit: string | null;
}

export type CustomerInput = Omit<Customer, 'id' | 'createdAt'>;

const toCustomer = (r: CustomerRow): Customer => ({
  id: r.id,
  name: r.name,
  email: r.email,
  phone: r.phone,
  stellarAddress: r.stellar_address,
  notes: r.notes,
  createdAt: r.created_at,
});

export const CustomerModel = {
  create(input: Partial<CustomerInput> & { name: string }): Customer {
    const id = newId();
    getDb()
      .prepare(
        'INSERT INTO customers (id, name, email, phone, stellar_address, notes) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        id,
        input.name,
        input.email ?? null,
        input.phone ?? null,
        input.stellarAddress ?? null,
        input.notes ?? '',
      );
    return this.findById(id)!;
  },

  findById(id: string): Customer | undefined {
    const row = getDb().prepare('SELECT * FROM customers WHERE id = ?').get(id) as
      CustomerRow | undefined;
    return row && toCustomer(row);
  },

  list(search: string | undefined, page: Pagination): { items: Customer[]; total: number } {
    const db = getDb();
    const filter = search
      ? "WHERE name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\'"
      : '';
    const params = search ? [likePattern(search), likePattern(search), likePattern(search)] : [];
    const total = (
      db.prepare(`SELECT COUNT(*) AS n FROM customers ${filter}`).get(...params) as {
        n: number;
      }
    ).n;
    const rows = db
      .prepare(`SELECT * FROM customers ${filter} ORDER BY name LIMIT ? OFFSET ?`)
      .all(...params, page.limit, page.offset) as unknown as CustomerRow[];
    return { items: rows.map(toCustomer), total };
  },

  update(id: string, fields: Partial<CustomerInput>): Customer | undefined {
    const map: Record<keyof CustomerInput, string> = {
      name: 'name',
      email: 'email',
      phone: 'phone',
      stellarAddress: 'stellar_address',
      notes: 'notes',
    };
    const sets: string[] = [];
    const params: (string | null)[] = [];
    for (const [key, column] of Object.entries(map)) {
      const value = fields[key as keyof CustomerInput];
      if (value !== undefined) {
        sets.push(`${column} = ?`);
        params.push(value);
      }
    }
    if (sets.length) {
      getDb()
        .prepare(`UPDATE customers SET ${sets.join(', ')} WHERE id = ?`)
        .run(...params, id);
    }
    return this.findById(id);
  },

  /** Deletes a customer, detaching them from past sales rather than losing the sales. */
  delete(id: string): boolean {
    const db = getDb();
    db.prepare('UPDATE transactions SET customer_id = NULL WHERE customer_id = ?').run(id);
    return db.prepare('DELETE FROM customers WHERE id = ?').run(id).changes === 1;
  },

  stats(id: string): CustomerStats {
    const row = getDb()
      .prepare(
        `SELECT COUNT(*) AS visits, COALESCE(SUM(total_cents), 0) AS lifetime, MAX(created_at) AS last
         FROM transactions WHERE customer_id = ? AND status = 'completed'`,
      )
      .get(id) as { visits: number; lifetime: number; last: string | null };
    return { visits: row.visits, lifetimeCents: row.lifetime, lastVisit: row.last };
  },
};
