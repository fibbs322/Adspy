require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const adsRoutes = require('./routes/ads');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// Общий лимит запросов, чтобы не положить сервер и не выжечь квоту FB API
const limiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
app.use('/api', limiter);

app.use('/api/auth', authRoutes);
app.use('/api/ads', adsRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

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
