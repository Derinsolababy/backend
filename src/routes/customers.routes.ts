import { Router } from 'express';
import { authenticate } from '@/middleware/auth.middleware';
import { notFound } from '@/middleware/error.middleware';
import { validateBody } from '@/middleware/validate.middleware';
import { CustomerModel, type CustomerInput } from '@/models/customer.model';
import { asyncHandler, paginatedResponse, parsePagination, sendSuccess } from '@/utils/helpers';
import { createCustomerSchema, updateCustomerSchema } from '@/validation/customer.validation';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = parsePagination(req.query);
    const search = req.query.search ? String(req.query.search) : undefined;
    const { items, total } = CustomerModel.list(search, page);
    paginatedResponse(res, items, total, page);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const customer = CustomerModel.findById(req.params.id);
    if (!customer) throw notFound('Customer');
    sendSuccess(res, { ...customer, stats: CustomerModel.stats(customer.id) });
  }),
);

router.post(
  '/',
  validateBody(createCustomerSchema),
  asyncHandler(async (req, res) => {
    sendSuccess(res, CustomerModel.create(req.body as CustomerInput), 201);
  }),
);

router.put(
  '/:id',
  validateBody(updateCustomerSchema),
  asyncHandler(async (req, res) => {
    if (!CustomerModel.findById(req.params.id)) throw notFound('Customer');
    sendSuccess(res, CustomerModel.update(req.params.id, req.body as Partial<CustomerInput>));
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!CustomerModel.delete(req.params.id)) throw notFound('Customer');
    sendSuccess(res, { id: req.params.id });
  }),
);

export default router;
