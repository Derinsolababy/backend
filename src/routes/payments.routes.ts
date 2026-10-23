import { Router } from 'express';
import { authenticate } from '@/middleware/auth.middleware';
import { notFound } from '@/middleware/error.middleware';
import { validateBody } from '@/middleware/validate.middleware';
import { PaymentModel } from '@/models/payment.model';
import { PaymentRequestModel } from '@/models/paymentRequest.model';
import * as checkout from '@/services/checkout.service';
import { asyncHandler, sendSuccess } from '@/utils/helpers';
import {
  createPaymentSchema,
  createRequestSchema,
  verifyRequestSchema,
} from '@/validation/payment.validation';

const router = Router();
router.use(authenticate);

router.get(
  '/transaction/:transactionId',
  asyncHandler(async (req, res) => {
    sendSuccess(res, PaymentModel.findByTransactionId(req.params.transactionId));
  }),
);

/** Cash, card, or a Stellar payment identified by its transaction hash. */
router.post(
  '/',
  validateBody(createPaymentSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as {
      transactionId: string;
      method: 'cash' | 'card' | 'stellar';
      amountCents?: number;
      tenderedCents?: number;
      stellarTxHash?: string;
    };
    const result =
      body.method === 'stellar'
        ? await checkout.recordStellarPayment({
            transactionId: body.transactionId,
            stellarTxHash: body.stellarTxHash!,
          })
        : checkout.recordOfflinePayment({ ...body, method: body.method });
    sendSuccess(res, result, 201);
  }),
);

/** Opens a QR (SEP-0007) checkout for the sale's balance. */
router.post(
  '/requests',
  validateBody(createRequestSchema),
  asyncHandler(async (req, res) => {
    sendSuccess(res, checkout.createPaymentRequest(req.body.transactionId), 201);
  }),
);

router.get(
  '/requests/:id',
  asyncHandler(async (req, res) => {
    const request = PaymentRequestModel.findById(req.params.id);
    if (!request) throw notFound('Payment request');
    sendSuccess(res, request);
  }),
);

router.post(
  '/requests/:id/verify',
  validateBody(verifyRequestSchema),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await checkout.verifyPaymentRequest(req.params.id, req.body.txHash));
  }),
);

router.post(
  '/requests/:id/cancel',
  asyncHandler(async (req, res) => {
    sendSuccess(res, checkout.cancelPaymentRequest(req.params.id));
  }),
);

export default router;
