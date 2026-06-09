const db = require('../config/database');

exports.getAll = async (req, res, next) => {
  try {
    const { search, active = true, page = 1, limit = 50 } = req.query;
    let query = db('clients').where({ active: active !== 'false' }).orderBy('name');
    if (search) query = query.where((b) => b.where('name', 'ilike', `%${search}%`).orWhere('company', 'ilike', `%${search}%`).orWhere('document_number', 'ilike', `%${search}%`));
    const offset = (page - 1) * limit;
    const [{ count }] = await query.clone().count('id as count');
    const data = await query.limit(limit).offset(offset);
    res.json({ data, total: parseInt(count, 10) });
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const client = await db('clients').where({ id: req.params.id }).first();
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(client);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const [client] = await db('clients').insert(req.body).returning('*');
    res.status(201).json(client);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const [client] = await db('clients').where({ id: req.params.id }).update({ ...req.body, updated_at: db.fn.now() }).returning('*');
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(client);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const count = await db('clients').where({ id: req.params.id }).del();
    if (!count) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.status(204).end();
  } catch (err) { next(err); }
};
