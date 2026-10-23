/**
 * Seeds a demo store: an admin, a manager and a cashier, a cafe-and-grocery
 * catalog, a few customers, and two weeks of completed sales so the dashboard
 * has something to show. Safe to re-run: it refuses to touch a non-empty
 * database unless SEED_FORCE=1.
 *
 *   npm run db:seed
 */
import bcrypt from 'bcryptjs';
import { CustomerModel } from '@/models/customer.model';
import { PaymentModel, type PaymentMethod } from '@/models/payment.model';
import { ProductModel } from '@/models/product.model';
import { TransactionModel } from '@/models/transaction.model';
import { UserModel } from '@/models/user.model';
import { closeDatabase, connectDatabase, getDb } from '@/utils/database';
import { logger } from '@/utils/logger';

const PASSWORD = 'stellarpos-demo';

const CATALOG: [string, string, string, number, number][] = [
  // name, sku, category, price (cents), stock
  ['Espresso', 'COF-ESP', 'Coffee', 250, 400],
  ['Flat White', 'COF-FLW', 'Coffee', 420, 400],
  ['Cappuccino', 'COF-CAP', 'Coffee', 400, 400],
  ['Cold Brew', 'COF-CLD', 'Coffee', 450, 120],
  ['Chai Latte', 'TEA-CHA', 'Tea', 380, 200],
  ['Hibiscus Iced Tea', 'TEA-HIB', 'Tea', 320, 150],
  ['Butter Croissant', 'BAK-CRO', 'Bakery', 300, 60],
  ['Banana Bread', 'BAK-BAN', 'Bakery', 350, 40],
  ['Meat Pie', 'BAK-PIE', 'Bakery', 450, 35],
  ['Chin Chin (200g)', 'SNK-CHN', 'Snacks', 280, 80],
  ['Plantain Chips', 'SNK-PLT', 'Snacks', 220, 90],
  ['Roasted Groundnuts', 'SNK-GRN', 'Snacks', 180, 6],
  ['Whole Bean Coffee 250g', 'RET-BEA', 'Retail', 1600, 25],
  ['Reusable Cup', 'RET-CUP', 'Retail', 1200, 18],
  ['Pour-over Kit', 'RET-POU', 'Retail', 3400, 4],
  ['Spring Water 500ml', 'BEV-WAT', 'Beverages', 120, 300],
  ['Zobo 350ml', 'BEV-ZOB', 'Beverages', 260, 3],
  ['Orange Juice', 'BEV-ORJ', 'Beverages', 350, 70],
];

const CUSTOMERS = [
  { name: 'Amaka Obi', email: 'amaka@example.com', phone: '+234 803 555 0101' },
  { name: 'Tunde Bakare', email: 'tunde@example.com', phone: '+234 806 555 0144' },
  { name: 'Grace Mensah', email: 'grace@example.com', phone: '+233 24 555 0198' },
  { name: 'Daniel Okafor', email: null, phone: '+234 809 555 0177' },
  { name: 'Lina Haddad', email: 'lina@example.com', phone: null },
];

// Deterministic pseudo-random so every seed looks the same.
let state = 42;
const rand = () => (state = (state * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
const pick = <T>(xs: T[]): T => xs[Math.floor(rand() * xs.length)];

async function main() {
  await connectDatabase();
  if (UserModel.count() > 0 && process.env.SEED_FORCE !== '1') {
    logger.warn('Database already has data; set SEED_FORCE=1 to seed anyway. Nothing changed.');
    return;
  }

  const hash = await bcrypt.hash(PASSWORD, 10);
  const admin = UserModel.create({
    name: 'Ada Admin',
    email: 'admin@stellarpos.dev',
    passwordHash: hash,
    role: 'admin',
  });
  UserModel.create({
    name: 'Musa Manager',
    email: 'manager@stellarpos.dev',
    passwordHash: hash,
    role: 'manager',
  });
  const cashier = UserModel.create({
    name: 'Chidi Cashier',
    email: 'cashier@stellarpos.dev',
    passwordHash: hash,
    role: 'cashier',
  });

  const products = CATALOG.map(([name, sku, category, priceCents, stock]) =>
    ProductModel.create({
      name,
      sku,
      category,
      priceCents,
      stock: stock + 200,
      lowStockThreshold: 8,
    }),
  );
  const customers = CUSTOMERS.map((c) => CustomerModel.create(c));

  const db = getDb();
  const methods: PaymentMethod[] = ['cash', 'card', 'card', 'stellar'];
  let sales = 0;
  for (let daysAgo = 13; daysAgo >= 0; daysAgo--) {
    const count = 6 + Math.floor(rand() * 10);
    for (let n = 0; n < count; n++) {
      const lines = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => ({
        productId: pick(products).id,
        quantity: 1 + Math.floor(rand() * 2),
      }));
      const sale = TransactionModel.createSale({
        userId: rand() > 0.3 ? cashier.id : admin.id,
        customerId: rand() > 0.6 ? pick(customers).id : null,
        items: lines,
      });
      PaymentModel.create({
        transactionId: sale.id,
        method: pick(methods),
        amountCents: sale.totalCents,
        status: 'completed',
      });
      TransactionModel.markCompleted(sale.id);
      const hour = 7 + Math.floor(rand() * 12);
      const minute = Math.floor(rand() * 60);
      const at = `datetime('now', 'start of day', '-${daysAgo} days', '+${hour} hours', '+${minute} minutes')`;
      db.prepare(
        `UPDATE transactions SET created_at = ${at}, completed_at = ${at} WHERE id = ?`,
      ).run(sale.id);
      sales++;
    }
  }
  // Bring stock back to the catalog levels so low-stock alerts show realistic items.
  for (const [i, [, , , , stock]] of CATALOG.entries()) {
    db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(stock, products[i].id);
  }

  logger.info(`Seeded ${products.length} products, ${customers.length} customers, ${sales} sales.`);
  logger.info(
    `Sign in as admin@stellarpos.dev, manager@stellarpos.dev or cashier@stellarpos.dev / ${PASSWORD}`,
  );
}

main()
  .catch((err) => {
    logger.error(err);
    process.exitCode = 1;
  })
  .finally(closeDatabase);
