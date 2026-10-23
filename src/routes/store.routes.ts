import { Router } from 'express';
import { config } from '@/config/config';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { getAccountBalances, isValidPublicKey } from '@/services/stellar.service';
import { asyncHandler, sendSuccess } from '@/utils/helpers';

const router = Router();

/** Public store settings the terminal needs before anyone signs in. */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, {
      name: config.store.name,
      currency: config.store.currency,
      taxRateBps: config.store.taxRateBps,
      stellar: {
        network: config.stellar.network,
        enabled: Boolean(config.stellar.merchantPublicKey),
        merchantPublicKey: config.stellar.merchantPublicKey || null,
        asset: { code: config.stellar.asset.code, issuer: config.stellar.asset.issuer || null },
        assetRate: config.stellar.assetRate,
        paymentTtlMinutes: config.stellar.paymentTtlMinutes,
        contracts: config.stellar.contracts,
      },
    });
  }),
);

/** Live balances of the merchant's receiving account. */
router.get(
  '/wallet',
  authenticate,
  authorize('admin', 'manager'),
  asyncHandler(async (_req, res) => {
    const key = config.stellar.merchantPublicKey;
    if (!key || !isValidPublicKey(key)) {
      sendSuccess(res, { configured: false, balances: [] });
      return;
    }
    sendSuccess(res, { configured: true, publicKey: key, balances: await getAccountBalances(key) });
  }),
);

export default router;
