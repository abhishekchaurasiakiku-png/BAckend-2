import * as authService from '../services/authService.js';

/**
 * POST /api/auth/register
 */
export async function register(req, res, next) {
  try {
    const { name, emailOrPhone, password } = req.body;
    const result = await authService.registerUser({ name, emailOrPhone, password });

    res.status(201).json({
      message: 'User registered successfully',
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/login
 */
export async function login(req, res, next) {
  try {
    const { emailOrPhone, password } = req.body;
    const result = await authService.loginUser({ emailOrPhone, password });

    res.json({
      message: 'Login successful',
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/refresh
 */
export async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Refresh token is required',
      });
    }

    const tokens = await authService.refreshAccessToken(refreshToken);

    res.json({
      message: 'Token refreshed',
      ...tokens,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/logout
 */
export async function logout(req, res, next) {
  try {
    const { refreshToken } = req.body;
    await authService.logoutUser(refreshToken);

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
}
