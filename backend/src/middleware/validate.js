const validate = (schema, target = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[target], { abortEarly: false, stripUnknown: true });
  if (error) {
    const details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message }));
    return res.status(400).json({ error: 'Datos de entrada inválidos', details });
  }
  req[target] = value;
  next();
};

module.exports = validate;
