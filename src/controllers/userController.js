
const supabase = require('../config/supabase');

const {
  success,
  error,
} = require('../core/response');

// GET CURRENT USER
async function getMe(req, res) {
  try {
    const userId = req.user.id;

    const {
      data: user,
      error: dbError,
    } = await supabase
      .from('users')
      .select(
        'id, username, phone, role, points, is_active, created_at, updated_at'
      )
      .eq('id', userId)
      .maybeSingle();

    if (dbError) {
      console.error(dbError);
      return error(res, 'Database error', 500);
    }

    if (!user) {
      return error(res, 'User not found', 404);
    }

    return success(res, user, 'User profile');
  } catch (err) {
    console.error(err);
    return error(res, 'Internal server error', 500);
  }
}

// UPDATE CURRENT USER PROFILE
async function updateMe(req, res) {
  try {
    const userId = req.user.id;
    const { phone } = req.body;

    // ตรวจสอบว่ามีการส่ง phone มาหรือไม่
    if (phone === undefined) {
      return error(res, 'กรุณาระบุเบอร์โทรศัพท์', 400);
    }

    // อนุญาตให้เว้นว่างได้
    const cleanPhone = phone === null ? null : String(phone).trim() || null;

    // ตรวจสอบรูปแบบเบอร์โทรศัพท์
    if (cleanPhone !== null && !/^[0-9]{9,15}$/.test(cleanPhone)) {
      return error(res, 'รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง', 400);
    }

    const {
      data: user,
      error: dbError,
    } = await supabase
      .from('users')
      .update({
        phone: cleanPhone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select(
        'id, username, phone, role, points, is_active, created_at, updated_at'
      )
      .maybeSingle();

    if (dbError) {
      console.error(dbError);

      if (dbError.code === '23505') {
        return error(res, 'เบอร์โทรศัพท์นี้ถูกใช้งานแล้ว', 409);
      }

      return error(res, 'Database error', 500);
    }

    if (!user) {
      return error(res, 'User not found', 404);
    }

    return success(res, user, 'Profile updated successfully');
  } catch (err) {
    console.error(err);
    return error(res, 'Internal server error', 500);
  }
}

module.exports = {
  getMe,
  updateMe,
};
