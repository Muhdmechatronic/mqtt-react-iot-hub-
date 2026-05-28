const router = require('express').Router();
const auth   = require('../middleware/auth');
const ctrl   = require('../controllers/sensorController');

router.get('/latest',       auth, ctrl.getLatest);
router.get('/history',      auth, ctrl.getHistory);
router.get('/types',        auth, ctrl.getSensorTypes);
router.get('/export',       auth, ctrl.exportCsv);
router.get('/export-json',  auth, ctrl.exportJson);  // JSON for client-side XLSX

module.exports = router;
