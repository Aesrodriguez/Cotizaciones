const router = require('express').Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('admin'));

router.get('/', async (req, res, next) => {
  try {
    const users = await db('users').select('id', 'name', 'email', 'role', 'active', 'created_at').orderBy('name');
    res.json(users);
  } catch (err) { next(err); }
});

router.patch('/:id/toggle', async (req, res, next) => {
  try {
    const user = await db('users').where({ id: req.params.id }).first();
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    const [updated] = await db('users').where({ id: req.params.id }).update({ active: !user.active, updated_at: db.fn.now() }).returning(['id', 'name', 'email', 'role', 'active']);
    res.json(updated);
  } catch (err) { next(err); }
});

module.exports = router;
