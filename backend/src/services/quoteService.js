const db = require('../config/database');

const generateQuoteNumber = async () => {
  const year = new Date().getFullYear();
  const last = await db('quotes')
    .where('quote_number', 'like', `COT-${year}-%`)
    .orderBy('id', 'desc')
    .first();
  const seq = last ? parseInt(last.quote_number.split('-')[2], 10) + 1 : 1;
  return `COT-${year}-${String(seq).padStart(4, '0')}`;
};

const calcTotals = (items) => {
  let subtotal = 0;
  let taxAmount = 0;
  let discountAmount = 0;
  const computed = items.map((item) => {
    const base = Number(item.quantity) * Number(item.unit_price);
    const disc = base * (Number(item.discount_pct) / 100);
    const taxable = base - disc;
    const tax = taxable * (Number(item.tax_rate) / 100);
    subtotal += base;
    discountAmount += disc;
    taxAmount += tax;
    return { ...item, subtotal: taxable + tax };
  });
  return { items: computed, subtotal, taxAmount, discountAmount, total: subtotal - discountAmount + taxAmount };
};

const getAll = async ({ page = 1, limit = 10, status, client_id, search, user_id, role }) => {
  const offset = (page - 1) * limit;
  let query = db('quotes as q')
    .join('clients as c', 'q.client_id', 'c.id')
    .join('users as u', 'q.user_id', 'u.id')
    .select('q.*', 'c.name as client_name', 'c.company as client_company', 'u.name as user_name')
    .orderBy('q.created_at', 'desc');

  if (role === 'vendedor') query = query.where('q.user_id', user_id);
  if (status) query = query.where('q.status', status);
  if (client_id) query = query.where('q.client_id', client_id);
  if (search) {
    query = query.where((b) =>
      b.where('q.quote_number', 'ilike', `%${search}%`)
        .orWhere('c.name', 'ilike', `%${search}%`)
        .orWhere('c.company', 'ilike', `%${search}%`),
    );
  }

  const [{ count }] = await query.clone().clearSelect().count('q.id as count');
  const data = await query.limit(limit).offset(offset);
  return { data, total: parseInt(count, 10), page, limit, pages: Math.ceil(count / limit) };
};

const getById = async (id, user) => {
  let query = db('quotes as q')
    .join('clients as c', 'q.client_id', 'c.id')
    .join('users as u', 'q.user_id', 'u.id')
    .select('q.*', 'c.name as client_name', 'c.company as client_company', 'c.email as client_email', 'u.name as user_name')
    .where('q.id', id);
  if (user.role === 'vendedor') query = query.where('q.user_id', user.id);
  const quote = await query.first();
  if (!quote) return null;
  quote.items = await db('quote_items as qi')
    .leftJoin('products as p', 'qi.product_id', 'p.id')
    .select('qi.*', 'p.name as product_name', 'p.code as product_code')
    .where('qi.quote_id', id)
    .orderBy('qi.sort_order');
  return quote;
};

const create = async (data, userId) => {
  const quoteNumber = await generateQuoteNumber();
  const { items: rawItems, notes, terms, client_id, issue_date, valid_until, currency = 'COP', status = 'borrador' } = data;
  const { items, subtotal, taxAmount, discountAmount, total } = calcTotals(rawItems);

  const [quote] = await db('quotes').insert({
    quote_number: quoteNumber, client_id, user_id: userId,
    status, issue_date, valid_until, notes, terms,
    subtotal, tax_amount: taxAmount, discount_amount: discountAmount, total, currency,
  }).returning('*');

  if (items.length) {
    await db('quote_items').insert(items.map((it, i) => ({
      quote_id: quote.id, product_id: it.product_id || null,
      description: it.description, quantity: it.quantity,
      unit: it.unit || 'Unidad', unit_price: it.unit_price,
      discount_pct: it.discount_pct || 0, tax_rate: it.tax_rate,
      subtotal: it.subtotal, sort_order: i,
    })));
  }
  return getById(quote.id, { role: 'admin' });
};

const update = async (id, data, user) => {
  const existing = await getById(id, user);
  if (!existing) return null;

  const { items: rawItems, notes, terms, client_id, issue_date, valid_until, currency, status } = data;
  const { items, subtotal, taxAmount, discountAmount, total } = calcTotals(rawItems);

  await db('quotes').where('id', id).update({
    client_id, status, issue_date, valid_until, notes, terms,
    subtotal, tax_amount: taxAmount, discount_amount: discountAmount, total, currency,
    updated_at: db.fn.now(),
  });
  await db('quote_items').where('quote_id', id).del();
  if (items.length) {
    await db('quote_items').insert(items.map((it, i) => ({
      quote_id: id, product_id: it.product_id || null,
      description: it.description, quantity: it.quantity,
      unit: it.unit || 'Unidad', unit_price: it.unit_price,
      discount_pct: it.discount_pct || 0, tax_rate: it.tax_rate,
      subtotal: it.subtotal, sort_order: i,
    })));
  }
  return getById(id, { role: 'admin' });
};

const remove = async (id, user) => {
  const existing = await getById(id, user);
  if (!existing) return false;
  await db('quotes').where('id', id).del();
  return true;
};

const getStats = async () => {
  const [totals] = await db('quotes').select(
    db.raw('COUNT(*) as total'),
    db.raw("COUNT(*) FILTER (WHERE status = 'aprobada') as approved"),
    db.raw("COUNT(*) FILTER (WHERE status = 'pendiente' OR status = 'enviada') as pending"),
    db.raw('SUM(total) as revenue'),
    db.raw("SUM(total) FILTER (WHERE status = 'aprobada') as approved_revenue"),
  );
  const byStatus = await db('quotes').select('status').count('id as count').groupBy('status');
  const byMonth = await db('quotes')
    .select(db.raw("TO_CHAR(created_at, 'YYYY-MM') as month"))
    .sum('total as total').count('id as count')
    .groupByRaw("TO_CHAR(created_at, 'YYYY-MM')")
    .orderByRaw("TO_CHAR(created_at, 'YYYY-MM') DESC")
    .limit(12);
  return { totals, byStatus, byMonth: byMonth.reverse() };
};

module.exports = { getAll, getById, create, update, remove, getStats };
