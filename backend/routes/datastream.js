const router = require('express').Router();
const auth   = require('../middleware/auth');
const ctrl   = require('../controllers/datastreamController');

router.get('/',    auth, ctrl.list);
router.post('/',   auth, ctrl.create);
router.put('/:id', auth, ctrl.update);
router.delete('/:id', auth, ctrl.remove);

module.exports = router;
