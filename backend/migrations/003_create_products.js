exports.up = (knex) =>
  knex.schema.createTable('products', (t) => {
    t.increments('id').primary();
    t.string('code', 50).unique();
    t.string('name', 200).notNullable();
    t.text('description');
    t.string('unit', 50).defaultTo('Unidad');
    t.decimal('price', 14, 2).notNullable().defaultTo(0);
    t.decimal('tax_rate', 5, 2).notNullable().defaultTo(19);
    t.string('category', 100);
    t.boolean('active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

exports.down = (knex) => knex.schema.dropTableIfExists('products');
