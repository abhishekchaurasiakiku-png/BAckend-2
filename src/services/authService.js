import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../config/database.js';
import env from '../config/env.js';

const SALT_ROUNDS = 12;

/**
 * Register a new user
 */
export async function registerUser({ name, emailOrPhone, password }) {
  // Check if user already exists
  const existing = await prisma.user.findUnique({
    where: { emailOrPhone },
  });

  if (existing) {
    const error = new Error('User with this email/phone already exists');
    error.status = 409;
    throw error;
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Create user
  const user = await prisma.user.create({
    data: {
      name,
      emailOrPhone,
      passwordHash,
    },
    select: {
      id: true,
      name: true,
      emailOrPhone: true,
      avatarUrl: true,
      createdAt: true,
    },
  });

  // Generate tokens
  const tokens = await generateTokens(user.id);

  return { user, ...tokens };
}

/**
 * Login with email/phone and password
 */
export async function loginUser({ emailOrPhone, password }) {
  // Find user
  const user = await prisma.user.findUnique({
    where: { emailOrPhone },
  });

  if (!user) {
    const error = new Error('Invalid credentials');
    error.status = 401;
    throw error;
  }

  // Verify password
  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    const error = new Error('Invalid credentials');
    error.status = 401;
    throw error;
  }

  // Generate tokens
  const tokens = await generateTokens(user.id);

  return {
    user: {
      id: user.id,
      name: user.name,
      emailOrPhone: user.emailOrPhone,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    },
    ...tokens,
  };
}

/**
 * Refresh access token using a valid refresh token
 */
export async function refreshAccessToken(refreshToken) {
  // Verify refresh token JWT
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
  } catch {
    const error = new Error('Invalid or expired refresh token');
    error.status = 401;
    throw error;
  }

  // Check if refresh token exists in DB (not revoked)
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
  });

  if (!storedToken || storedToken.expiresAt < new Date()) {
    const error = new Error('Refresh token expired or revoked');
    error.status = 401;
    throw error;
  }

  // Delete old refresh token (rotate)
  await prisma.refreshToken.delete({
    where: { id: storedToken.id },
  });

  // Generate new token pair
  const tokens = await generateTokens(decoded.userId);

  return tokens;
}

/**
 * Logout — invalidate refresh token
 */
export async function logoutUser(refreshToken) {
  try {
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  } catch {
    // Token may not exist, that's fine
  }
}

/**
 * Generate access + refresh token pair
 */
async function generateTokens(userId) {
  const accessToken = jwt.sign(
    { userId },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRY }
  );

  const refreshTokenValue = jwt.sign(
    { userId, jti: crypto.randomUUID() },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRY }
  );

  // Parse the expiry for DB storage
  const decoded = jwt.decode(refreshTokenValue);
  const expiresAt = new Date(decoded.exp * 1000);

  // Store refresh token in DB
  await prisma.refreshToken.create({
    data: {
      userId,
      token: refreshTokenValue,
      expiresAt,
    },
  });

  return {
    accessToken,
    refreshToken: refreshTokenValue,
  };
}
