const router = require('express').Router();
const Joi = require('joi');
const ctrl = require('../controllers/clientsController');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');

const clientSchema = Joi.object({
  name: Joi.string().max(200).required(),
  company: Joi.string().max(200).allow('', null),
  email: Joi.string().email().allow('', null),
  phone: Joi.string().max(50).allow('', null),
  document_type: Joi.string().valid('NIT', 'CC', 'CE', 'RUT', 'Otro').default('NIT'),
  document_number: Joi.string().max(50).allow('', null),
  address: Joi.string().allow('', null),
  city: Joi.string().max(100).allow('', null),
  country: Joi.string().max(100).default('Colombia'),
  active: Joi.boolean().default(true),
});

router.use(authenticate);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', validate(clientSchema), ctrl.create);
router.put('/:id', validate(clientSchema), ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
