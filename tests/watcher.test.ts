import * as horizon from '@/services/horizon';
import { pollOnce } from '@/services/paymentWatcher';
import { getDb } from '@/utils/database';
import { MERCHANT, useDatabase } from './helpers';

jest.mock('@/services/horizon');
const mocked = jest.mocked(horizon);

useDatabase();

const cursor = () =>
  (
    getDb().prepare("SELECT value FROM kv WHERE key = 'horizon_payments_cursor'").get() as {
      value: string;
    }
  )?.value;

describe('payment watcher', () => {
  it('starts from the latest payment instead of replaying history', async () => {
    mocked.latestCursor.mockResolvedValue('900');
    mocked.fetchPaymentsSince.mockResolvedValue({ payments: [], cursor: '900' });
    await pollOnce(MERCHANT);
    expect(mocked.fetchPaymentsSince).toHaveBeenCalledWith(MERCHANT, '900');
    expect(cursor()).toBe('900');
  });

  it('advances and persists the cursor', async () => {
    mocked.fetchPaymentsSince.mockResolvedValue({ payments: [], cursor: '950' });
    await pollOnce(MERCHANT);
    expect(cursor()).toBe('950');
    await pollOnce(MERCHANT);
    expect(mocked.fetchPaymentsSince).toHaveBeenLastCalledWith(MERCHANT, '950');
    expect(mocked.latestCursor).toHaveBeenCalledTimes(0);
  });
});
