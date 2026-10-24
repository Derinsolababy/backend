import { getDb } from '@/utils/database';
import { useDatabase } from './helpers';

useDatabase();

const plan = (sql: string, ...params: unknown[]) =>
  (
    getDb()
      .prepare(`EXPLAIN QUERY PLAN ${sql}`)
      .all(...(params as string[])) as { detail: string }[]
  )
    .map((r) => r.detail)
    .join(' | ');

describe('query plans use indexes', () => {
  it('filters completed sales by date with an index', () => {
    expect(
      plan(
        "SELECT COUNT(*) FROM transactions WHERE status = 'completed' AND created_at >= ?",
        '2026-01-01',
      ),
    ).toMatch(/USING (COVERING )?INDEX idx_transactions_status_created/);
  });

  it("lists a customer's sales with an index", () => {
    expect(
      plan('SELECT * FROM transactions WHERE customer_id = ? ORDER BY created_at DESC', 'c1'),
    ).toMatch(/USING INDEX idx_transactions_customer/);
  });

  it('finds line items by product with an index', () => {
    expect(plan('SELECT 1 FROM transaction_items WHERE product_id = ? LIMIT 1', 'p1')).toMatch(
      /USING (COVERING )?INDEX idx_items_product/,
    );
  });
});
