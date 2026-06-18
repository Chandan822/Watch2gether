import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

/**
 * Authentication Service
 *
 * Houses operations for:
 * 1. Password cryptography (hashing and verification via bcrypt)
 * 2. Token creation and validation (JWT Access and Refresh tokens)
 */

// Hashing round count for password generation
const BCRYPT_SALT_ROUNDS = 10;

/**
 * Securely hashes a plain-text password using bcrypt.
 * Bcrypt automatically handles salting to prevent rainbow table attacks.
 */
export const hashPassword = async (password) => {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
};

/**
 * Compares a plain-text password against a stored hashed password.
 */
export const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

/**
 * Generates a short-lived (15 minutes) JWT Access Token.
 * Contains core user identifiers.
 */
export const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
    },
    config.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );
};

/**
 * Generates a long-lived (7 days) JWT Refresh Token.
 * Contains only the user ID to check session validity.
 */
export const generateRefreshToken = (user) => {
  return jwt.sign({ id: user.id }, config.JWT_REFRESH_SECRET, {
    expiresIn: '7d',
  });
};

/**
 * Verifies a JWT Access Token.
 */
export const verifyAccessToken = (token) => {
  return jwt.verify(token, config.JWT_ACCESS_SECRET);
};

/**
 * Verifies a JWT Refresh Token.
 */
export const verifyRefreshToken = (token) => {
  return jwt.verify(token, config.JWT_REFRESH_SECRET);
};
