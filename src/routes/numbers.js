const express = require('express');

const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const {
    listRounds,
    getRound,
    createRound,
    updateRound,
    chooseNumber,
    setResult,
    getHistory
} = require('../controllers/numberController');

const router = express.Router();

router.use(auth);

// User
router.get('/rounds', listRounds);
router.get('/rounds/:id', getRound);
router.post('/rounds/:id/choose', chooseNumber);
router.get('/history', getHistory);

// Admin
router.post('/rounds', admin, createRound);
router.patch('/rounds/:id', admin, updateRound);
router.post('/rounds/:id/result', admin, setResult);

module.exports = router;