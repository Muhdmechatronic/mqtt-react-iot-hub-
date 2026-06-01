const router = require('express').Router();
const ctrl   = require('../controllers/googleAssistantController');

// Google Smart Home fulfillment endpoint
// Google sends SYNC / QUERY / EXECUTE / DISCONNECT intents here
router.post('/fulfillment', ctrl.fulfillment);

// Internal: called by dashboard when a device state changes, to push to Google
router.post('/report-state', ctrl.reportState);

module.exports = router;
