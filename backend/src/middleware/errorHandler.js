const logger = require('../config/logger');

const errorHandler = (err, req, res, _next) => {
  logger.error(`${req.method} ${req.path} - ${err.message}`, { stack: err.stack });

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: 'Datos inválidos', details: err.details });
  }
  if (err.code === '23505') {
    return res.status(409).json({ error: 'El registro ya existe (valor duplicado)' });
  }
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referencia a registro inexistente' });
  }

  const statusCode = err.statusCode || 500;
  const message = statusCode < 500 ? err.message : 'Error interno del servidor';
  res.status(statusCode).json({ error: message });
};

module.exports = errorHandler;
