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
async function promoteIfAdminEmail(user) {
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  if (!adminEmail || user.email.toLowerCase() !== adminEmail) return user;
  if (user.role === 'admin' && user.plan_active) return user;
  await db.query('UPDATE users SET role = $1, plan_active = 1 WHERE id = $2', ['admin', user.id]);
  return { ...user, role: 'admin', plan_active: 1 };
}

// Регистрация
router.post('/register', async (req, res, next) => {
  try {
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
    const existingRes = await db.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existingRes.rows[0]) {
      return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
    }

    const hash = await bcrypt.hash(password, 10);
    const mailerReady = isMailerConfigured();

    if (!mailerReady) {
      // Отправка писем не настроена на сервере — создаём аккаунт сразу без подтверждения,
      // чтобы регистрация не сломалась.
      const insertRes = await db.query(
        'INSERT INTO users (email, password_hash, email_verified) VALUES ($1, $2, 1) RETURNING id',
        [normalizedEmail, hash]
      );
      let user = { id: insertRes.rows[0].id, email: normalizedEmail, role: 'user', plan_active: 0 };
      user = await promoteIfAdminEmail(user);
      const token = signToken(user);
      return res.status(201).json({ token, user: { id: user.id, email: user.email } });
    }

    const code = generateCode();
    const expires = new Date(Date.now() + CODE_TTL_MS).toISOString();

    const insertRes = await db.query(
      'INSERT INTO users (email, password_hash, email_verified, verification_code, verification_expires) VALUES ($1, $2, 0, $3, $4) RETURNING id',
      [normalizedEmail, hash, code, expires]
    );
    const newUserId = insertRes.rows[0].id;

    try {
      await sendVerificationEmail(normalizedEmail, code);
    } catch (err) {
      await db.query('DELETE FROM users WHERE id = $1', [newUserId]);
      return res.status(502).json({ error: 'Не удалось отправить письмо с кодом. Попробуй ещё раз чуть позже.' });
    }

    res.status(201).json({ needsVerification: true, email: normalizedEmail });
  } catch (err) {
    next(err);
  }
});

// Подтверждение email кодом из письма
router.post('/verify-email', async (req, res, next) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Укажи email и код' });
    }
    const normalizedEmail = email.toLowerCase();
    const userRes = await db.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    let user = userRes.rows[0];
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

    await db.query(
      'UPDATE users SET email_verified = 1, verification_code = NULL, verification_expires = NULL WHERE id = $1',
      [user.id]
    );

    user = await promoteIfAdminEmail(user);
    const token = signToken(user);
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    next(err);
  }
});

// Повторная отправка кода подтверждения
router.post('/resend-code', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Укажи email' });
    }
    const normalizedEmail = email.toLowerCase();
    const userRes = await db.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    const user = userRes.rows[0];
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
    await db.query('UPDATE users SET verification_code = $1, verification_expires = $2 WHERE id = $3', [code, expires, user.id]);

    try {
      await sendVerificationEmail(normalizedEmail, code);
    } catch (err) {
      return res.status(502).json({ error: 'Не удалось отправить письмо. Попробуй ещё раз чуть позже.' });
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Логин
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Укажи email и пароль' });
    }

    const userRes = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    let user = userRes.rows[0];
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

    user = await promoteIfAdminEmail(user);
    const token = signToken(user);
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    next(err);
  }
});

// Текущий пользователь — роль и доступ к поиску (всегда свежие из базы, а не из JWT,
// чтобы отзыв/выдача доступа админом срабатывали сразу, без перелогина).
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const userRes = await db.query(
      'SELECT id, email, role, plan_active, email_verified FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      isAdmin: user.role === 'admin',
      hasSearchAccess: user.role === 'admin' || Boolean(user.plan_active),
    });
  } catch (err) {
    next(err);
  }
});

// Вход/регистрация через Google (ID-токен от Google Identity Services на фронтенде)
router.post('/google', async (req, res, next) => {
  try {
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

    const userRes = await db.query('SELECT * FROM users WHERE google_id = $1 OR email = $2', [googleId, email]);
    let user = userRes.rows[0];

    if (!user) {
      const insertRes = await db.query(
        'INSERT INTO users (email, password_hash, google_id, email_verified) VALUES ($1, $2, $3, 1) RETURNING id',
        [email, '', googleId]
      );
      user = { id: insertRes.rows[0].id, email, role: 'user', plan_active: 0 };
    } else if (!user.google_id) {
      // Пользователь раньше регистрировался по email/паролю — привязываем Google к тому же аккаунту
      // и считаем email подтверждённым, раз Google его уже подтвердил.
      await db.query('UPDATE users SET google_id = $1, email_verified = 1 WHERE id = $2', [googleId, user.id]);
    }

    user = await promoteIfAdminEmail(user);
    const token = signToken(user);
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
