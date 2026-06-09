require('../setup');
const jwt = require('jsonwebtoken');

describe('JWT Auth Middleware', () => {
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  it('rechaza petición sin header Authorization', async () => {
    const { authenticate } = require('../../src/middleware/auth');
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rechaza token malformado', async () => {
    jest.resetModules();
    const { authenticate } = require('../../src/middleware/auth');
    const req = { headers: { authorization: 'Bearer token_invalido' } };
    const res = mockRes();
    const next = jest.fn();
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('validate middleware', () => {
  const Joi = require('joi');
  const validate = require('../../src/middleware/validate');

  it('llama next() con datos válidos', () => {
    const schema = Joi.object({ name: Joi.string().required() });
    const middleware = validate(schema);
    const req = { body: { name: 'Test' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('retorna 400 con datos inválidos', () => {
    const schema = Joi.object({ name: Joi.string().required() });
    const middleware = validate(schema);
    const req = { body: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('authorize middleware', () => {
  const { authorize } = require('../../src/middleware/auth');

  it('permite acceso con rol correcto', () => {
    const middleware = authorize('admin');
    const req = { user: { role: 'admin' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('deniega acceso con rol incorrecto', () => {
    const middleware = authorize('admin');
    const req = { user: { role: 'vendedor' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
