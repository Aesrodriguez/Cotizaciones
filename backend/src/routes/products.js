const router = require('express').Router();
const Joi = require('joi');
const ctrl = require('../controllers/productsController');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const productSchema = Joi.object({
  code: Joi.string().max(50).allow('', null),
  name: Joi.string().max(200).required(),
  description: Joi.string().allow('', null),
  unit: Joi.string().max(50).default('Unidad'),
  price: Joi.number().min(0).required(),
  tax_rate: Joi.number().min(0).max(100).default(19),
  category: Joi.string().max(100).allow('', null),
  active: Joi.boolean().default(true),
});

router.use(authenticate);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', authorize('admin'), validate(productSchema), ctrl.create);
router.put('/:id', authorize('admin'), validate(productSchema), ctrl.update);
router.delete('/:id', authorize('admin'), ctrl.remove);

module.exports = router;
