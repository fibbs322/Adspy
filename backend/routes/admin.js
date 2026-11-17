const express = require('express');
const db = require('../db/init');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function requireAdmin(req, res, next) {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступно только администратору' });
  }
  next();
}

// Список пользователей — для управления доступом к поиску (задел под платную подписку)
router.get('/users', requireAuth, requireAdmin, (req, res) => {
  const rows = db
    .prepare('SELECT id, email, role, plan_active, email_verified, created_at FROM users ORDER BY created_at DESC')
    .all();
  res.json(rows);
});

// Включить/выключить доступ к поиску конкретному пользователю
router.post('/users/:id/access', requireAuth, requireAdmin, (req, res) => {
  const { active } = req.body;
  const target = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'Пользователь не найден' });
  if (target.role === 'admin') {
    return res.status(400).json({ error: 'У администратора доступ и так всегда включён' });
  }
  db.prepare('UPDATE users SET plan_active = ? WHERE id = ?').run(active ? 1 : 0, target.id);
  res.json({ ok: true });
});

module.exports = router;
