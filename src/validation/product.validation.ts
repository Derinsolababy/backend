import Joi from 'joi';

const fields = {
  name: Joi.string().trim().min(1).max(120),
  sku: Joi.string()
    .trim()
    .uppercase()
    .pattern(/^[A-Z0-9][A-Z0-9-_.]{0,39}$/)
    .messages({ 'string.pattern.base': 'SKU may only contain letters, digits, - _ and .' }),
  description: Joi.string().allow('').max(1000),
  category: Joi.string().trim().min(1).max(60),
  priceCents: Joi.number().integer().min(0).max(100_000_000),
  stock: Joi.number().integer().min(0).max(1_000_000),
  lowStockThreshold: Joi.number().integer().min(0).max(100_000),
  active: Joi.boolean(),
};

export const createProductSchema = Joi.object({
  ...fields,
  name: fields.name.required(),
  sku: fields.sku.required(),
  priceCents: fields.priceCents.required(),
});

export const updateProductSchema = Joi.object(fields).min(1);

export const adjustStockSchema = Joi.object({
  delta: Joi.number().integer().invalid(0).min(-1_000_000).max(1_000_000).required(),
  reason: Joi.string().max(200).allow(''),
});
