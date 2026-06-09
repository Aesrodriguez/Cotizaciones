const quoteService = require('../services/quoteService');

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, status, client_id, search } = req.query;
    const result = await quoteService.getAll({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      status, client_id, search,
      user_id: req.user.id,
      role: req.user.role,
    });
    res.json(result);
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const quote = await quoteService.getById(req.params.id, req.user);
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });
    res.json(quote);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const quote = await quoteService.create(req.body, req.user.id);
    res.status(201).json(quote);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const quote = await quoteService.update(req.params.id, req.body, req.user);
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });
    res.json(quote);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const deleted = await quoteService.remove(req.params.id, req.user);
    if (!deleted) return res.status(404).json({ error: 'Cotización no encontrada' });
    res.status(204).end();
  } catch (err) { next(err); }
};

exports.getStats = async (req, res, next) => {
  try {
    const stats = await quoteService.getStats();
    res.json(stats);
  } catch (err) { next(err); }
};
