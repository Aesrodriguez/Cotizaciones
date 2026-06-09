const db = require('../config/database');

exports.getAll = async (req, res, next) => {
  try {
    const { search, category } = req.query;
    let query = db('products').where({ active: true }).orderBy('name');
    if (search) query = query.where((b) => b.where('name', 'ilike', `%${search}%`).orWhere('code', 'ilike', `%${search}%`));
    if (category) query = query.where({ category });
    const data = await query;
    res.json(data);
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const product = await db('products').where({ id: req.params.id }).first();
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(product);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const [product] = await db('products').insert(req.body).returning('*');
    res.status(201).json(product);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const [product] = await db('products').where({ id: req.params.id }).update({ ...req.body, updated_at: db.fn.now() }).returning('*');
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(product);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    await db('products').where({ id: req.params.id }).update({ active: false });
    res.status(204).end();
  } catch (err) { next(err); }
};
