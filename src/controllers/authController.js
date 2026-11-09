
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
  let createdUserId = null;

  try {
    const {
      username,
      password,
      phone,
    } = req.body;

    // Validate input
    if (
      typeof username !== 'string' ||
      !username.trim() ||
      typeof password !== 'string' ||
      !password
    ) {
      return error(
        res,
        'Username and password are required',
        400
      );
    }

    const cleanUsername = username.trim();
    const cleanPhone =
      typeof phone === 'string' && phone.trim()
        ? phone.trim()
        : null;

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
      .eq('username', cleanUsername)
      .maybeSingle();

    if (findError) {
      console.error('Find user error:', findError);

      return error(res, 'Database error', 500);
    }

    if (existingUser) {
      return error(
        res,
        'Username already exists',
        409
      );
    }

    // Get default points
    let defaultPoints = 100;

    const {
      data: setting,
      error: settingError,
    } = await supabase
      .from('app_settings')
      .select('value_int, value')
      .eq('key', 'new_user_points')
      .maybeSingle();

    if (settingError) {
      console.error('Settings error:', settingError);

      return error(
        res,
        'Unable to load registration settings',
        500
      );
    }

    if (setting) {
      const configuredPoints =
        setting.value_int ?? setting.value;

      if (
        configuredPoints !== null &&
        configuredPoints !== undefined &&
        Number.isFinite(Number(configuredPoints)) &&
        Number(configuredPoints) >= 0
      ) {
        defaultPoints = Number(configuredPoints);
      }
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // 1. Create user
    const {
      data: user,
      error: insertError,
    } = await supabase
      .from('users')
      .insert({
        username: cleanUsername,
        password_hash: passwordHash,
        phone: cleanPhone,
        role: 'user',
        points: defaultPoints,
      })
      .select(
        'id, username, phone, role, points, created_at'
      )
      .single();

    if (insertError) {
      console.error('Create user error:', insertError);

      if (insertError.code === '23505') {
        return error(
          res,
          'Username or phone already exists',
          409
        );
      }

      return error(
        res,
        'Unable to create user',
        500
      );
    }

    createdUserId = user.id;

    // 2. Create profile using the same UUID
    const {
      error: profileError,
    } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        username: user.username,
        phone: user.phone,
        role: user.role,
        points: user.points,
      });

    if (profileError) {
      console.error(
        'Create profile error:',
        profileError
      );

      // Roll back newly created user
      const {
        error: rollbackError,
      } = await supabase
        .from('users')
        .delete()
        .eq('id', user.id);

      if (rollbackError) {
        console.error(
          'User rollback failed:',
          rollbackError
        );
      }

      createdUserId = null;

      return error(
        res,
        'Unable to create user profile',
        500
      );
    }

    // 3. Create JWT only after both inserts succeed
    const token = signToken({
      id: user.id,
      username: user.username,
      role: user.role,
    });

    createdUserId = null;

    return created(
      res,
      {
        user,
        token,
      },
      'Registration successful'
    );

  } catch (err) {
    console.error('Register error:', err);

    // Attempt cleanup if an unexpected error occurs
    if (createdUserId) {
      const {
        error: rollbackError,
      } = await supabase
        .from('users')
        .delete()
        .eq('id', createdUserId);

      if (rollbackError) {
        console.error(
          'User rollback failed:',
          rollbackError
        );
      }
    }

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

    if (
      typeof username !== 'string' ||
      !username.trim() ||
      typeof password !== 'string' ||
      !password
    ) {
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
      .eq('username', username.trim())
      .maybeSingle();

    if (findError) {
      console.error('Find user error:', findError);

      return error(res, 'Database error', 500);
    }

    if (!user) {
      return error(
        res,
        'Invalid username or password',
        401
      );
    }

    // Check active status
    if (!user.is_active) {
      return error(
        res,
        'Account is disabled',
        403
      );
    }

    // Check password
    const passwordCorrect = await comparePassword(
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
    console.error('Login error:', err);

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
