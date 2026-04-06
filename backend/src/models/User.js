'use strict';

const { pool } = require('../config/database');

const User = {
  /**
   * Find a user by email.
   */
  async findByEmail(email) {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE email = ? AND is_active = 1 LIMIT 1',
      [email]
    );
    return rows[0] || null;
  },

  /**
   * Find a user by id.
   */
  async findById(id) {
    const [rows] = await pool.query(
      'SELECT id, name, email, role, phone, created_at FROM users WHERE id = ? AND is_active = 1 LIMIT 1',
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Create a new user.
   */
  async create({ name, email, passwordHash, role = 'farmer', phone = null }) {
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)',
      [name, email, passwordHash, role, phone]
    );
    return result.insertId;
  },

  /**
   * Update user profile.
   */
  async update(id, { name, phone }) {
    await pool.query(
      'UPDATE users SET name = ?, phone = ? WHERE id = ?',
      [name, phone, id]
    );
  },

  /**
   * Store a refresh token.
   */
  async saveRefreshToken(userId, tokenHash, expiresAt) {
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [userId, tokenHash, expiresAt]
    );
  },

  /**
   * Find a valid (non-revoked, non-expired) refresh token.
   */
  async findRefreshToken(tokenHash) {
    const [rows] = await pool.query(
      `SELECT * FROM refresh_tokens
       WHERE token_hash = ? AND revoked = 0 AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash]
    );
    return rows[0] || null;
  },

  /**
   * Revoke a refresh token.
   */
  async revokeRefreshToken(tokenHash) {
    await pool.query(
      'UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?',
      [tokenHash]
    );
  }
};

module.exports = User;
