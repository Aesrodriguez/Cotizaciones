const router = require('express').Router();
const Joi = require('joi');
const ctrl = require('../controllers/authController');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

const registerSchema = Joi.object({
  name: Joi.string().min(2).max(150).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(/^(?=.*[A-Z])(?=.*\d)/).required()
    .messages({ 'string.pattern.base': 'La contraseña debe tener al menos una mayúscula y un número' }),
  role: Joi.string().valid('admin', 'vendedor', 'viewer').default('vendedor'),
});

const changePwdSchema = Joi.object({
  current_password: Joi.string().required(),
  new_password: Joi.string().min(8).pattern(/^(?=.*[A-Z])(?=.*\d)/).required(),
});

router.post('/login', validate(loginSchema), ctrl.login);
router.post('/register', authenticate, authorize('admin'), validate(registerSchema), ctrl.register);
router.get('/me', authenticate, ctrl.me);
router.patch('/change-password', authenticate, validate(changePwdSchema), ctrl.changePassword);

module.exports = router;
