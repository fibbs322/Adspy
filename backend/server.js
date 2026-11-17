require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const adsRoutes = require('./routes/ads');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// Общий лимит запросов, чтобы не положить сервер и не выжечь квоту FB API
const limiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
app.use('/api', limiter);

app.use('/api/auth', authRoutes);
// Путь специально НЕ /api/ads — классические списки блокировщиков рекламы (EasyList и т.п.)
// по умолчанию режут любой URL с "/ads/" в пути, не разбирая, чей это сайт. Из-за этого наш
// же собственный поиск падал с "Failed to fetch" у людей с обычным uBlock/AdBlock без
// доп. настройки — тот же JS, тот же бэкенд, просто другое слово в адресе.
app.use('/api/creatives', adsRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Отдаёт фронтенду публичные настройки (например, включена ли кнопка "Войти через Google")
app.get('/api/config', (req, res) => {
  const fbConfigured = Boolean(
    process.env.FB_ACCESS_TOKEN && process.env.FB_ACCESS_TOKEN !== 'paste_your_facebook_access_token_here'
  );
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || null, fbConfigured });
});

// Отдаём статический фронтенд (папка ../frontend)
const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(frontendDir, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(PORT, () => {
  console.log(`AdSpy backend запущен на порту ${PORT}`);
});
