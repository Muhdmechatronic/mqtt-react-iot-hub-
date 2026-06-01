const router      = require('express').Router();
const ctrl        = require('../controllers/authController');
const googleCtrl  = require('../controllers/googleAuthController');

router.post('/register', ctrl.register);
router.post('/login',    ctrl.login);
router.post('/google',   googleCtrl.googleLogin);

module.exports = router;
