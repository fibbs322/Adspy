const express = require('express');
const db = require('../db/init');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

async function requireAdmin(req, res, next) {
  try {
    const result = await db.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Доступно только администратору' });
    }
    next();
  } catch (err) {
    next(err);
  }
}

// Список пользователей — для управления доступом к поиску (задел под платную подписку)
router.get('/users', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, email, role, plan_active, email_verified, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Включить/выключить доступ к поиску конкретному пользователю
router.post('/users/:id/access', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { active } = req.body;
    const targetRes = await db.query('SELECT id, role FROM users WHERE id = $1', [req.params.id]);
    const target = targetRes.rows[0];
    if (!target) return res.status(404).json({ error: 'Пользователь не найден' });
    if (target.role === 'admin') {
      return res.status(400).json({ error: 'У администратора доступ и так всегда включён' });
    }
    await db.query('UPDATE users SET plan_active = $1 WHERE id = $2', [active ? 1 : 0, target.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
