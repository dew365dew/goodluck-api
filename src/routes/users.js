const express = require('express');

const auth = require('../middleware/auth');

const {
  getMe,
} = require('../controllers/userController');

const router = express.Router();


// Current logged-in user
router.get('/me', auth, getMe);


module.exports = router;