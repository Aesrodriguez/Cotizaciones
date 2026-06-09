exports.up = (knex) =>
  knex.schema
    .createTable('quotes', (t) => {
      t.increments('id').primary();
      t.string('quote_number', 30).notNullable().unique();
      t.integer('client_id').notNullable().references('id').inTable('clients').onDelete('RESTRICT');
      t.integer('user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
      t.enum('status', ['borrador', 'enviada', 'aprobada', 'rechazada', 'vencida'])
        .notNullable()
        .defaultTo('borrador');
      t.date('issue_date').notNullable();
      t.date('valid_until').notNullable();
      t.text('notes');
      t.text('terms');
      t.decimal('subtotal', 14, 2).notNullable().defaultTo(0);
      t.decimal('tax_amount', 14, 2).notNullable().defaultTo(0);
      t.decimal('discount_amount', 14, 2).notNullable().defaultTo(0);
      t.decimal('total', 14, 2).notNullable().defaultTo(0);
      t.string('currency', 10).notNullable().defaultTo('COP');
      t.timestamps(true, true);
    })
    .createTable('quote_items', (t) => {
      t.increments('id').primary();
      t.integer('quote_id').notNullable().references('id').inTable('quotes').onDelete('CASCADE');
      t.integer('product_id').references('id').inTable('products').onDelete('SET NULL');
      t.string('description', 500).notNullable();
      t.decimal('quantity', 10, 2).notNullable().defaultTo(1);
      t.string('unit', 50).defaultTo('Unidad');
      t.decimal('unit_price', 14, 2).notNullable();
      t.decimal('discount_pct', 5, 2).notNullable().defaultTo(0);
      t.decimal('tax_rate', 5, 2).notNullable().defaultTo(19);
      t.decimal('subtotal', 14, 2).notNullable().defaultTo(0);
      t.integer('sort_order').defaultTo(0);
    });

exports.down = (knex) =>
  knex.schema.dropTableIfExists('quote_items').dropTableIfExists('quotes');
