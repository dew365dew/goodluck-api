const supabase = require('../config/supabase');

const {
  hashPassword,
  comparePassword,
} = require('../core/utils/password');

const {
  signToken,
} = require('../core/utils/jwt');

const {
  success,
  created,
  error,
} = require('../core/response');


// ==============================
// REGISTER
// ==============================

async function register(req, res) {
  try {
    const {
      username,
      password,
      phone,
    } = req.body;

    // Check required fields
    if (!username || !password) {
      return error(
        res,
        'Username and password are required',
        400
      );
    }

    // Check password length
    if (password.length < 6) {
      return error(
        res,
        'Password must be at least 6 characters',
        400
      );
    }

    // Check existing username
    const {
      data: existingUser,
      error: findError,
    } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (findError) {
      console.error(findError);

      return error(
        res,
        'Database error',
        500
      );
    }

    if (existingUser) {
      return error(
        res,
        'Username already exists',
        409
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Default points
    let defaultPoints = 100;

    const {
      data: setting,
    } = await supabase
      .from('app_settings')
      .select('value_int, value')
      .eq('key', 'new_user_points')
      .maybeSingle();

    if (setting) {
      if (setting.value_int !== null) {
        defaultPoints = Number(setting.value_int);
      } else if (setting.value !== null) {
        defaultPoints = Number(setting.value);
      }
    }

    // Create user
    const {
      data: user,
      error: insertError,
    } = await supabase
      .from('users')
      .insert({
        username,
        password_hash: passwordHash,
        phone: phone || null,
        role: 'user',
        points: defaultPoints,
      })
      .select(
        'id, username, phone, role, points, created_at'
      )
      .single();

    if (insertError) {
      console.error(insertError);

      return error(
        res,
        'Unable to create user',
        500
      );
    }

    // Create JWT
    const token = signToken({
      id: user.id,
      username: user.username,
      role: user.role,
    });

    return created(
      res,
      {
        user,
        token,
      },
      'Registration successful'
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


// ==============================
// LOGIN
// ==============================

async function login(req, res) {
  try {
    const {
      username,
      password,
    } = req.body;

    // Check required fields
    if (!username || !password) {
      return error(
        res,
        'Username and password are required',
        400
      );
    }

    // Find user
    const {
      data: user,
      error: findError,
    } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (findError) {
      console.error(findError);

      return error(
        res,
        'Database error',
        500
      );
    }

    // User not found
    if (!user) {
      return error(
        res,
        'Invalid username or password',
        401
      );
    }

    // Check active
    if (!user.is_active) {
      return error(
        res,
        'Account is disabled',
        403
      );
    }

    // Check password
    const passwordCorrect =
      await comparePassword(
        password,
        user.password_hash
      );

    if (!passwordCorrect) {
      return error(
        res,
        'Invalid username or password',
        401
      );
    }

    // Create JWT
    const token = signToken({
      id: user.id,
      username: user.username,
      role: user.role,
    });

    return success(
      res,
      {
        user: {
          id: user.id,
          username: user.username,
          phone: user.phone,
          role: user.role,
          points: user.points,
          created_at: user.created_at,
        },
        token,
      },
      'Login successful'
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


// ==============================
// EXPORT
// ==============================

module.exports = {
  register,
  login,
};