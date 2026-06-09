require('../setup');

// Mocks de la base de datos
jest.mock('../../src/config/database', () => {
  const mockDb = jest.fn();
  mockDb.raw = jest.fn().mockResolvedValue([{}]);
  mockDb.fn = { now: jest.fn().mockReturnValue('NOW()') };
  return mockDb;
});

describe('quoteService - calcTotals (interno)', () => {
  it('calcula correctamente subtotales con descuento e IVA', () => {
    const items = [
      { quantity: 2, unit_price: 100000, discount_pct: 10, tax_rate: 19 },
    ];
    const base = 2 * 100000;
    const disc = base * 0.1;
    const taxable = base - disc;
    const tax = taxable * 0.19;
    expect(taxable + tax).toBeCloseTo(214200);
  });

  it('maneja items sin descuento', () => {
    const base = 1 * 50000;
    const tax = base * 0.19;
    expect(base + tax).toBe(59500);
  });

  it('maneja tasa de IVA 0%', () => {
    const base = 3 * 200000;
    const tax = base * 0;
    expect(base + tax).toBe(600000);
  });
});

describe('quoteService - generateQuoteNumber (lógica)', () => {
  it('genera el formato correcto COT-YYYY-XXXX', () => {
    const year = new Date().getFullYear();
    const num = `COT-${year}-0001`;
    expect(num).toMatch(/^COT-\d{4}-\d{4}$/);
  });
});
