import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate, statusConfig } from '../utils/format';

describe('formatCurrency', () => {
  it('formatea correctamente COP', () => {
    const result = formatCurrency(1500000);
    expect(result).toContain('1.500.000');
  });

  it('maneja valor 0', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0');
  });

  it('maneja valor undefined', () => {
    const result = formatCurrency(undefined);
    expect(result).toContain('0');
  });
});

describe('formatDate', () => {
  it('formatea fecha ISO', () => {
    const result = formatDate('2024-01-15');
    expect(result).toContain('15');
    expect(result).toContain('2024');
  });

  it('retorna guion para valor null', () => {
    expect(formatDate(null)).toBe('-');
  });
});

describe('statusConfig', () => {
  it('contiene todos los estados', () => {
    const estados = ['borrador', 'enviada', 'aprobada', 'rechazada', 'vencida'];
    estados.forEach((e) => {
      expect(statusConfig[e]).toBeDefined();
      expect(statusConfig[e].label).toBeTruthy();
      expect(statusConfig[e].class).toBeTruthy();
    });
  });
});
