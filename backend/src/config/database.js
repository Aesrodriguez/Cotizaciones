const knex = require('knex');
const knexConfig = require('../../knexfile');
const logger = require('./logger');

const env = process.env.NODE_ENV || 'development';
const config = knexConfig[env];

const db = knex(config);

db.raw('SELECT 1')
  .then(() => logger.info('Conexión a base de datos establecida'))
  .catch((err) => logger.error('Error conectando a la base de datos:', err.message));

module.exports = db;
