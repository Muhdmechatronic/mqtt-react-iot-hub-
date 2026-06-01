const router      = require('express').Router();
const ctrl        = require('../controllers/authController');
const googleCtrl  = require('../controllers/googleAuthController');

router.post('/register',          ctrl.register);
router.post('/login',             ctrl.login);
router.post('/google',            googleCtrl.googleLogin);

// Forgot password (OTP flow)
router.post('/forgot-password',   ctrl.forgotPassword);
router.post('/verify-otp',        ctrl.verifyOTP);
router.post('/reset-password',    ctrl.resetPassword);

// Registration with email verification
router.post('/register-otp',      ctrl.sendRegisterOTP);
router.post('/verify-register',   ctrl.verifyRegister);

module.exports = router;
