exports.up = (knex) =>
  knex.schema.createTable('clients', (t) => {
    t.increments('id').primary();
    t.string('name', 200).notNullable();
    t.string('company', 200);
    t.string('email', 255);
    t.string('phone', 50);
    t.string('document_type', 20).defaultTo('NIT');
    t.string('document_number', 50);
    t.text('address');
    t.string('city', 100);
    t.string('country', 100).defaultTo('Colombia');
    t.boolean('active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

exports.down = (knex) => knex.schema.dropTableIfExists('clients');
