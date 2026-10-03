const express = require('express');

const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const {
  getUsers,
  getUserById,
  updateUserStatus,
  updateUserPoints,
} = require('../controllers/adminController');

const router = express.Router();


// ทุก route ด้านล่างต้อง Login + เป็น Admin
router.use(auth);
router.use(admin);


// ดู Users ทั้งหมด
router.get(
  '/users',
  getUsers
);


// ดู User คนเดียว
router.get(
  '/users/:id',
  getUserById
);


// เปิด / ปิดบัญชี
router.patch(
  '/users/:id/status',
  updateUserStatus
);


// ปรับ Points
router.patch(
  '/users/:id/points',
  updateUserPoints
);


module.exports = router;