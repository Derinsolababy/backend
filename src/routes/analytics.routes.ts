import { Router } from 'express';
import { authenticate } from '@/middleware/auth.middleware';
import { getDb } from '@/utils/database';
import { asyncHandler, boundedInt, sendSuccess } from '@/utils/helpers';

const router = Router();
router.use(authenticate);

const COMPLETED = "status = 'completed'";

router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const db = getDb();
    // Defaults to today (UTC); ?days=N widens the window.
    const days = boundedInt(req.query.days, 1, 1, 365);
    const since = `datetime('now', 'start of day', '-${days - 1} days')`;
    const totals = db
      .prepare(
        `SELECT COUNT(*) AS sales, COALESCE(SUM(total_cents), 0) AS revenue,
                COALESCE(SUM(tax_cents), 0) AS tax, COALESCE(SUM(discount_cents), 0) AS discounts
         FROM transactions WHERE ${COMPLETED} AND created_at >= ${since}`,
      )
      .get() as { sales: number; revenue: number; tax: number; discounts: number };
    const byMethod = db
      .prepare(
        `SELECT p.method, COUNT(*) AS count, SUM(p.amount_cents) AS amount
         FROM payments p JOIN transactions t ON t.id = p.transaction_id
         WHERE p.status = 'completed' AND t.${COMPLETED} AND t.created_at >= ${since}
         GROUP BY p.method ORDER BY amount DESC`,
      )
      .all() as { method: string; count: number; amount: number }[];
    const items = db
      .prepare(
        `SELECT COALESCE(SUM(i.quantity), 0) AS units FROM transaction_items i
         JOIN transactions t ON t.id = i.transaction_id
         WHERE t.${COMPLETED} AND t.created_at >= ${since}`,
      )
      .get() as { units: number };
    const counts = db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM transactions WHERE status = 'refunded' AND created_at >= ${since}) AS refunds,
           (SELECT COUNT(*) FROM transactions WHERE status = 'void' AND created_at >= ${since}) AS voids,
           (SELECT COUNT(*) FROM products WHERE active = 1 AND stock <= low_stock_threshold) AS lowStock,
           (SELECT COUNT(*) FROM customers) AS customers`,
      )
      .get() as { refunds: number; voids: number; lowStock: number; customers: number };

    sendSuccess(res, {
      days,
      totalSales: totals.sales,
      totalRevenueCents: totals.revenue,
      taxCents: totals.tax,
      discountCents: totals.discounts,
      averageTicketCents: totals.sales ? Math.round(totals.revenue / totals.sales) : 0,
      unitsSold: items.units,
      byMethod: byMethod.map((m) => ({ method: m.method, count: m.count, amountCents: m.amount })),
      refunds: counts.refunds,
      voids: counts.voids,
      lowStockProducts: counts.lowStock,
      customers: counts.customers,
    });
  }),
);

router.get(
  '/revenue-by-day',
  asyncHandler(async (req, res) => {
    const days = boundedInt(req.query.days, 7, 1, 90);
    const rows = getDb()
      .prepare(
        `SELECT date(created_at) AS day, COUNT(*) AS sales, SUM(total_cents) AS revenue
         FROM transactions
         WHERE ${COMPLETED} AND created_at >= datetime('now', 'start of day', '-${days - 1} days')
         GROUP BY day ORDER BY day`,
      )
      .all() as { day: string; sales: number; revenue: number }[];

    // Fill gaps so charts get one point per day, including zero days.
    const byDay = new Map(rows.map((r) => [r.day, r]));
    const series = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const day = d.toISOString().slice(0, 10);
      const row = byDay.get(day);
      series.push({ day, sales: row?.sales ?? 0, revenueCents: row?.revenue ?? 0 });
    }
    sendSuccess(res, series);
  }),
);

router.get(
  '/hourly',
  asyncHandler(async (_req, res) => {
    const rows = getDb()
      .prepare(
        `SELECT CAST(strftime('%H', created_at) AS INTEGER) AS hour, COUNT(*) AS sales, SUM(total_cents) AS revenue
         FROM transactions WHERE ${COMPLETED} AND created_at >= datetime('now', '-30 days')
         GROUP BY hour`,
      )
      .all() as { hour: number; sales: number; revenue: number }[];
    const byHour = new Map(rows.map((r) => [r.hour, r]));
    sendSuccess(
      res,
      Array.from({ length: 24 }, (_, hour) => ({
        hour,
        sales: byHour.get(hour)?.sales ?? 0,
        revenueCents: byHour.get(hour)?.revenue ?? 0,
      })),
    );
  }),
);

router.get(
  '/top-products',
  asyncHandler(async (req, res) => {
    const limit = boundedInt(req.query.limit, 5, 1, 50);
    const days = boundedInt(req.query.days, 30, 1, 365);
    const rows = getDb()
      .prepare(
        `SELECT i.product_id AS productId, i.name, i.sku, SUM(i.quantity) AS units,
                SUM(i.line_total_cents) AS revenueCents
         FROM transaction_items i JOIN transactions t ON t.id = i.transaction_id
         WHERE t.${COMPLETED} AND t.created_at >= datetime('now', '-${days} days')
         GROUP BY i.product_id ORDER BY units DESC, revenueCents DESC LIMIT ?`,
      )
      .all(limit);
    sendSuccess(res, rows);
  }),
);

export default router;
