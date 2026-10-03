const supabase = require('../config/supabase');

const {
  success,
  error,
} = require('../core/response');


// ==============================
// GET CURRENT USER
// ==============================

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
      'User profile'
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
  getMe,
};