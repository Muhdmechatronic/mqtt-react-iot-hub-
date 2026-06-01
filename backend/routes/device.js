const router = require('express').Router();
const auth   = require('../middleware/auth');
const ctrl   = require('../controllers/deviceController');

router.post('/register',    auth, ctrl.register);
router.get('/list',         auth, ctrl.list);
router.delete('/:id',       auth, ctrl.deleteDevice);
router.post('/data',              ctrl.pushData);        // no auth — uses api_key header
router.post('/ping',              ctrl.ping);            // no auth — heartbeat from firmware
router.get('/state',              ctrl.getDeviceState);  // no auth — ESP32 polls this
router.post('/command',     auth, ctrl.sendCommand);

module.exports = router;
