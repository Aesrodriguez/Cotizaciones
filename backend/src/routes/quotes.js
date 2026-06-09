const router = require('express').Router();
const Joi = require('joi');
const ctrl = require('../controllers/quotesController');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const itemSchema = Joi.object({
  product_id: Joi.number().integer().allow(null),
  description: Joi.string().max(500).required(),
  quantity: Joi.number().positive().required(),
  unit: Joi.string().max(50).default('Unidad'),
  unit_price: Joi.number().min(0).required(),
  discount_pct: Joi.number().min(0).max(100).default(0),
  tax_rate: Joi.number().min(0).max(100).default(19),
});

const quoteSchema = Joi.object({
  client_id: Joi.number().integer().required(),
  status: Joi.string().valid('borrador', 'enviada', 'aprobada', 'rechazada', 'vencida').default('borrador'),
  issue_date: Joi.date().iso().required(),
  valid_until: Joi.date().iso().min(Joi.ref('issue_date')).required(),
  notes: Joi.string().allow('', null),
  terms: Joi.string().allow('', null),
  currency: Joi.string().max(10).default('COP'),
  items: Joi.array().items(itemSchema).min(1).required(),
});

router.use(authenticate);
router.get('/stats', authorize('admin', 'vendedor'), ctrl.getStats);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', validate(quoteSchema), ctrl.create);
router.put('/:id', validate(quoteSchema), ctrl.update);
router.delete('/:id', authorize('admin'), ctrl.remove);

module.exports = router;
