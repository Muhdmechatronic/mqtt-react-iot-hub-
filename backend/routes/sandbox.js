const router = require('express').Router();
const auth   = require('../middleware/auth');
const ctrl   = require('../controllers/sandboxController');

router.get('/',       auth, ctrl.list);
router.post('/',      auth, ctrl.save);
router.get('/:id',    auth, ctrl.load);
router.delete('/:id', auth, ctrl.remove);

module.exports = router;
