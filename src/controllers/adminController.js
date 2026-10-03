const supabase = require('../config/supabase');

const {
  success,
  error,
} = require('../core/response');


// ========================================
// GET ALL USERS
// ========================================

async function getUsers(req, res) {
  try {
    const {
      data: users,
      error: dbError,
    } = await supabase
      .from('users')
      .select(
        'id, username, phone, role, points, is_active, created_at, updated_at'
      )
      .order('created_at', {
        ascending: false,
      });

    if (dbError) {
      console.error(dbError);

      return error(
        res,
        'Database error',
        500
      );
    }

    return success(
      res,
      users,
      'Users loaded'
    );

  } catch (err) {
    console.error(err);

    return error(
      res,
      'Internal server error',
      500
    );
  }
}


// ========================================
// GET USER BY ID
// ========================================

async function getUserById(req, res) {
  try {
    const { id } = req.params;

    const {
      data: user,
      error: dbError,
    } = await supabase
      .from('users')
      .select(
        'id, username, phone, role, points, is_active, created_at, updated_at'
      )
      .eq('id', id)
      .maybeSingle();

    if (dbError) {
      console.error(dbError);

      return error(
        res,
        'Database error',
        500
      );
    }

    if (!user) {
      return error(
        res,
        'User not found',
        404
      );
    }

    return success(
      res,
      user,
      'User loaded'
    );

  } catch (err) {
    console.error(err);

    return error(
      res,
      'Internal server error',
      500
    );
  }
}


// ========================================
// ENABLE / DISABLE USER
// ========================================

async function updateUserStatus(req, res) {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return error(
        res,
        'is_active must be true or false',
        400
      );
    }

    // ป้องกัน Admin ปิดบัญชีตัวเอง
    if (req.user.id === id) {
      return error(
        res,
        'You cannot disable your own account',
        400
      );
    }

    const {
      data: user,
      error: dbError,
    } = await supabase
      .from('users')
      .update({
        is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(
        'id, username, phone, role, points, is_active, created_at, updated_at'
      )
      .maybeSingle();

    if (dbError) {
      console.error(dbError);

      return error(
        res,
        'Unable to update user status',
        500
      );
    }

    if (!user) {
      return error(
        res,
        'User not found',
        404
      );
    }

    return success(
      res,
      user,
      is_active
        ? 'User enabled'
        : 'User disabled'
    );

  } catch (err) {
    console.error(err);

    return error(
      res,
      'Internal server error',
      500
    );
  }
}


// ========================================
// UPDATE USER POINTS
// ========================================

async function updateUserPoints(req, res) {
  try {
    const { id } = req.params;
    const { points } = req.body;

    const newPoints = Number(points);

    if (!Number.isInteger(newPoints)) {
      return error(
        res,
        'Points must be an integer',
        400
      );
    }

    if (newPoints < 0) {
      return error(
        res,
        'Points cannot be negative',
        400
      );
    }

    const {
      data: user,
      error: dbError,
    } = await supabase
      .from('users')
      .update({
        points: newPoints,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(
        'id, username, phone, role, points, is_active, created_at, updated_at'
      )
      .maybeSingle();

    if (dbError) {
      console.error(dbError);

      return error(
        res,
        'Unable to update points',
        500
      );
    }

    if (!user) {
      return error(
        res,
        'User not found',
        404
      );
    }

    return success(
      res,
      user,
      'Points updated'
    );

  } catch (err) {
    console.error(err);

    return error(
      res,
      'Internal server error',
      500
    );
  }
}


module.exports = {
  getUsers,
  getUserById,
  updateUserStatus,
  updateUserPoints,
};