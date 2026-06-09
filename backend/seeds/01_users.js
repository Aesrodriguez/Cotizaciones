const bcrypt = require('bcryptjs');

exports.seed = async (knex) => {
  await knex('users').del();
  const hash = await bcrypt.hash('Admin123!', 10);
  await knex('users').insert([
    { name: 'Administrador', email: 'admin@empresa.com', password_hash: hash, role: 'admin' },
    { name: 'Vendedor Demo', email: 'vendedor@empresa.com', password_hash: await bcrypt.hash('Vendedor1!', 10), role: 'vendedor' },
  ]);
};
