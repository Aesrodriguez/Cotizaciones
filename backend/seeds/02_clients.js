exports.seed = async (knex) => {
  await knex('clients').del();
  await knex('clients').insert([
    { name: 'Carlos Rodríguez', company: 'Tech Solutions S.A.S', email: 'carlos@techsolutions.co', phone: '3001234567', document_type: 'NIT', document_number: '900123456-1', city: 'Bogotá' },
    { name: 'María López', company: 'Comercial López Ltda', email: 'mlopez@comerciallopez.com', phone: '3109876543', document_type: 'NIT', document_number: '800234567-2', city: 'Medellín' },
    { name: 'Juan Pérez', company: 'Distribuciones JP', email: 'jperez@distribjp.co', phone: '3205551234', document_type: 'CC', document_number: '12345678', city: 'Cali' },
  ]);
};
