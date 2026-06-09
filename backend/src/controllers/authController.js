const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const logger = require('../config/logger');

const signToken = (user) =>
  jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await db('users').where({ email, active: true }).first();
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    const token = signToken(user);
    logger.info(`Login exitoso: ${user.email}`);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) { next(err); }
};

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role = 'vendedor' } = req.body;
    const exists = await db('users').where({ email }).first();
    if (exists) return res.status(409).json({ error: 'El email ya está registrado' });
    const password_hash = await bcrypt.hash(password, 10);
    const [user] = await db('users').insert({ name, email, password_hash, role }).returning(['id', 'name', 'email', 'role']);
    const token = signToken(user);
    res.status(201).json({ token, user });
  } catch (err) { next(err); }
};

exports.me = async (req, res) => {
  res.json({ user: req.user });
};

exports.changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    const user = await db('users').where({ id: req.user.id }).first();
    if (!(await bcrypt.compare(current_password, user.password_hash))) {
      return res.status(400).json({ error: 'Contraseña actual incorrecta' });
    }
    const password_hash = await bcrypt.hash(new_password, 10);
    await db('users').where({ id: req.user.id }).update({ password_hash, updated_at: db.fn.now() });
    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) { next(err); }
};
