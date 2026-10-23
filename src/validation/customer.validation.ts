import Joi from 'joi';
import { StrKey } from '@stellar/stellar-sdk';

const stellarAddress = Joi.string()
  .trim()
  .custom((value: string, helpers) =>
    StrKey.isValidEd25519PublicKey(value) ? value : helpers.error('any.invalid'),
  )
  .messages({ 'any.invalid': 'stellarAddress must be a valid Stellar public key (G...)' });

const fields = {
  name: Joi.string().trim().min(1).max(120),
  email: Joi.string().trim().lowercase().email().allow(null),
  phone: Joi.string()
    .trim()
    .pattern(/^[+0-9 ()-]{5,25}$/)
    .allow(null),
  stellarAddress: stellarAddress.allow(null),
  notes: Joi.string().allow('').max(1000),
};

export const createCustomerSchema = Joi.object({ ...fields, name: fields.name.required() });
export const updateCustomerSchema = Joi.object(fields).min(1);
