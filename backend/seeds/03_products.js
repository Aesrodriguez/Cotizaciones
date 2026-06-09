exports.seed = async (knex) => {
  await knex('products').del();
  await knex('products').insert([
    { code: 'SRV-001', name: 'Consultoría Técnica', description: 'Servicio de consultoría por hora', unit: 'Hora', price: 150000, tax_rate: 19, category: 'Servicios' },
    { code: 'SRV-002', name: 'Desarrollo de Software', description: 'Desarrollo de módulo a medida', unit: 'Hora', price: 200000, tax_rate: 19, category: 'Servicios' },
    { code: 'HW-001', name: 'Laptop Empresarial', description: 'Laptop Core i7, 16GB RAM, 512GB SSD', unit: 'Unidad', price: 3500000, tax_rate: 19, category: 'Hardware' },
    { code: 'HW-002', name: 'Monitor 27"', description: 'Monitor Full HD 27 pulgadas', unit: 'Unidad', price: 950000, tax_rate: 19, category: 'Hardware' },
    { code: 'LIC-001', name: 'Licencia Software Anual', description: 'Licencia de uso anual por usuario', unit: 'Licencia', price: 450000, tax_rate: 0, category: 'Licencias' },
  ]);
};
