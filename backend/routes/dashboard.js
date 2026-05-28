const router = require('express').Router();
const auth   = require('../middleware/auth');
const ctrl   = require('../controllers/dashboardController');

router.get('/',                          auth, ctrl.listDashboards);
router.post('/',                         auth, ctrl.createDashboard);
router.get('/:dashboard_id/widgets',     auth, ctrl.getWidgets);
router.post('/:dashboard_id/widgets',    auth, ctrl.createWidget);
router.put('/widgets/:widget_id',        auth, ctrl.updateWidget);
router.put('/widgets/:widget_id/layout', auth, ctrl.updateLayout);
router.delete('/widgets/:widget_id',     auth, ctrl.removeWidget);
router.delete('/:dashboard_id',          auth, ctrl.deleteDashboard);

module.exports = router;
