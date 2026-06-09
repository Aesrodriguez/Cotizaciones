const router = require('express').Router();

router.use('/auth', require('./auth'));
router.use('/quotes', require('./quotes'));
router.use('/clients', require('./clients'));
router.use('/products', require('./products'));
router.use('/users', require('./users'));

module.exports = router;
