import Joi from 'joi';
import { PAYMENT_METHODS } from '@/models/payment.model';

const txHash = Joi.string()
  .trim()
  .lowercase()
  .pattern(/^[0-9a-f]{64}$/)
  .messages({ 'string.pattern.base': 'stellarTxHash must be a 64-character hex transaction hash' });

export const createPaymentSchema = Joi.object({
  transactionId: Joi.string().uuid().required(),
  method: Joi.string()
    .valid(...PAYMENT_METHODS)
    .required(),
  amountCents: Joi.number().integer().min(1),
  tenderedCents: Joi.number().integer().min(1),
  stellarTxHash: txHash.when('method', {
    is: 'stellar',
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
});

export const createRequestSchema = Joi.object({
  transactionId: Joi.string().uuid().required(),
});

export const verifyRequestSchema = Joi.object({
  txHash: txHash.required(),
});
