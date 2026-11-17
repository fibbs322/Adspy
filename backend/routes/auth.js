const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const db = require('../db/init');
const { sendVerificationEmail, isMailerConfigured, generateCode } = require('../utils/mailer');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_TTL_MS = 15 * 60 * 1000; // 15 минут

const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role || 'user' },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// Если на хостинге задан ADMIN_EMAIL и пользователь с таким email у нас есть — делаем его
// админом и сразу даём доступ к поиску. Так владелец сервиса получает админ-аккаунт просто
// зайдя под нужным email, без ручного копания в базе.
function promoteIfAdminEmail(user) {
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  if (!adminEmail || user.email.toLowerCase() !== adminEmail) return user;
  if (user.role === 'admin' && user.plan_active) return user;
  db.prepare('UPDATE users SET role = ?, plan_active = 1 WHERE id = ?').run('admin', user.id);
  return { ...user, role: 'admin', plan_active: 1 };
}

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

  const normalizedEmail = email.toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
  }

  const hash = await bcrypt.hash(password, 10);
  const mailerReady = isMailerConfigured();

  if (!mailerReady) {
    // Отправка писем не настроена на сервере — создаём аккаунт сразу без подтверждения,
    // чтобы регистрация не сломалась.
    const info = db
      .prepare('INSERT INTO users (email, password_hash, email_verified) VALUES (?, ?, 1)')
      .run(normalizedEmail, hash);
    let user = { id: info.lastInsertRowid, email: normalizedEmail, role: 'user', plan_active: 0 };
    user = promoteIfAdminEmail(user);
    const token = signToken(user);
    return res.status(201).json({ token, user: { id: user.id, email: user.email } });
  }

  const code = generateCode();
  const expires = new Date(Date.now() + CODE_TTL_MS).toISOString();

  const info = db
    .prepare('INSERT INTO users (email, password_hash, email_verified, verification_code, verification_expires) VALUES (?, ?, 0, ?, ?)')
    .run(normalizedEmail, hash, code, expires);

  try {
    await sendVerificationEmail(normalizedEmail, code);
  } catch (err) {
    db.prepare('DELETE FROM users WHERE id = ?').run(info.lastInsertRowid);
    return res.status(502).json({ error: 'Не удалось отправить письмо с кодом. Попробуй ещё раз чуть позже.' });
  }

  res.status(201).json({ needsVerification: true, email: normalizedEmail });
});

// Подтверждение email кодом из письма
router.post('/verify-email', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Укажи email и код' });
  }
  const normalizedEmail = email.toLowerCase();
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  if (user.email_verified) {
    return res.status(400).json({ error: 'Email уже подтверждён, просто войди' });
  }
  if (!user.verification_code || user.verification_code !== String(code).trim()) {
    return res.status(400).json({ error: 'Неверный код' });
  }
  if (!user.verification_expires || new Date(user.verification_expires) < new Date()) {
    return res.status(400).json({ error: 'Код истёк, запроси новый' });
  }

  db.prepare('UPDATE users SET email_verified = 1, verification_code = NULL, verification_expires = NULL WHERE id = ?').run(user.id);

  user = promoteIfAdminEmail(user);
  const token = signToken(user);
  res.json({ token, user: { id: user.id, email: user.email } });
});

// Повторная отправка кода подтверждения
router.post('/resend-code', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Укажи email' });
  }
  const normalizedEmail = email.toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  if (user.email_verified) {
    return res.status(400).json({ error: 'Email уже подтверждён, просто войди' });
  }
  if (!isMailerConfigured()) {
    return res.status(503).json({ error: 'Отправка писем не настроена на сервере' });
  }

  const code = generateCode();
  const expires = new Date(Date.now() + CODE_TTL_MS).toISOString();
  db.prepare('UPDATE users SET verification_code = ?, verification_expires = ? WHERE id = ?').run(code, expires, user.id);

  try {
    await sendVerificationEmail(normalizedEmail, code);
  } catch (err) {
    return res.status(502).json({ error: 'Не удалось отправить письмо. Попробуй ещё раз чуть позже.' });
  }

  res.json({ ok: true });
});

// Логин
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Укажи email и пароль' });
  }

  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }

  if (!user.email_verified) {
    return res.status(403).json({ error: 'Email не подтверждён. Проверь почту и введи код.', needsVerification: true, email: user.email });
  }

  user = promoteIfAdminEmail(user);
  const token = signToken(user);
  res.json({ token, user: { id: user.id, email: user.email } });
});

// Текущий пользователь — роль и доступ к поиску (всегда свежие из базы, а не из JWT,
// чтобы отзыв/выдача доступа админом срабатывали сразу, без перелогина).
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, email, role, plan_active, email_verified FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json({
    id: user.id,
    email: user.email,
    role: user.role,
    isAdmin: user.role === 'admin',
    hasSearchAccess: user.role === 'admin' || Boolean(user.plan_active),
  });
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
      .prepare('INSERT INTO users (email, password_hash, google_id, email_verified) VALUES (?, ?, ?, 1)')
      .run(email, '', googleId);
    user = { id: info.lastInsertRowid, email, role: 'user', plan_active: 0 };
  } else if (!user.google_id) {
    // Пользователь раньше регистрировался по email/паролю — привязываем Google к тому же аккаунту
    // и считаем email подтверждённым, раз Google его уже подтвердил.
    db.prepare('UPDATE users SET google_id = ?, email_verified = 1 WHERE id = ?').run(googleId, user.id);
  }

  user = promoteIfAdminEmail(user);
  const token = signToken(user);
  res.json({ token, user: { id: user.id, email: user.email } });
});

module.exports = router;
