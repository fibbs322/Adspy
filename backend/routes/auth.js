const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const db = require('../db/init');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

// Регистрация
router.post('/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Укажи email и пароль' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Некорректный email' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Пароль должен быть не короче 8 символов' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
  }

  const hash = await bcrypt.hash(password, 10);
  const info = db
    .prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
    .run(email.toLowerCase(), hash);

  const token = jwt.sign(
    { id: info.lastInsertRowid, email: email.toLowerCase(), role: 'user' },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.status(201).json({ token, user: { id: info.lastInsertRowid, email: email.toLowerCase() } });
});

// Логин
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Укажи email и пароль' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({ token, user: { id: user.id, email: user.email } });
});

// Вход/регистрация через Google (ID-токен от Google Identity Services на фронтенде)
router.post('/google', async (req, res) => {
  const { credential } = req.body;

  if (!googleClient) {
    return res.status(503).json({ error: 'Вход через Google не настроен на сервере (нет GOOGLE_CLIENT_ID)' });
  }
  if (!credential) {
    return res.status(400).json({ error: 'Нет токена Google' });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (err) {
    return res.status(401).json({ error: 'Не удалось подтвердить токен Google' });
  }

  if (!payload || !payload.email) {
    return res.status(401).json({ error: 'Google не вернул email' });
  }

  const email = payload.email.toLowerCase();
  const googleId = payload.sub;

  let user = db.prepare('SELECT * FROM users WHERE google_id = ? OR email = ?').get(googleId, email);

  if (!user) {
    const info = db
      .prepare('INSERT INTO users (email, password_hash, google_id) VALUES (?, ?, ?)')
      .run(email, '', googleId);
    user = { id: info.lastInsertRowid, email, role: 'user' };
  } else if (!user.google_id) {
    // Пользователь раньше регистрировался по email/паролю — привязываем Google к тому же аккаунту
    db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(googleId, user.id);
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role || 'user' },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({ token, user: { id: user.id, email: user.email } });
});

module.exports = router;
