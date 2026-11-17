const express = require('express');
const fetch = require('node-fetch');
const db = require('../db/init');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const FB_GRAPH_VERSION = 'v21.0';
const FB_BASE_URL = `https://graph.facebook.com/${FB_GRAPH_VERSION}/ads_archive`;

// Поля, которые отдаёт Meta Ad Library API.
// Полный список и ограничения: https://www.facebook.com/ads/library/api
const FIELDS = [
  'id',
  'page_id',
  'page_name',
  'ad_creation_time',
  'ad_delivery_start_time',
  'ad_delivery_stop_time',
  'ad_creative_bodies',
  'ad_creative_link_titles',
  'ad_creative_link_descriptions',
  'ad_snapshot_url',
  'publisher_platforms',
  'languages',
].join(',');

// Доступ к поиску объявлений — админы всегда, остальные только если им явно включили доступ
// (задел под платную подписку). Проверяем свежие данные из базы, а не поле из JWT, чтобы
// включение/отключение доступа админом срабатывало сразу, без повторного логина пользователя.
function requireSearchAccess(req, res, next) {
  const user = db.prepare('SELECT role, plan_active FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
  if (user.role === 'admin' || user.plan_active) return next();
  return res.status(403).json({
    error: 'Доступ к поиску объявлений пока ограничен. Напиши администратору сервиса, чтобы его включили.',
    accessDenied: true,
  });
}

function daysBetween(fromIso, toIso) {
  if (!fromIso) return null;
  const from = new Date(fromIso).getTime();
  const to = toIso ? new Date(toIso).getTime() : Date.now();
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.max(0, Math.round((to - from) / (1000 * 60 * 60 * 24)));
}

// Поиск объявлений: по ключевому слову или названию страницы.
// GET /api/ads/search?q=nike&country=US&active=true
router.get('/search', requireAuth, requireSearchAccess, async (req, res) => {
  const { q, country, countries, active = 'true', vertical } = req.query;

  if (!q || !q.trim()) {
    return res.status(400).json({ error: 'Укажи поисковый запрос (параметр q)' });
  }

  if (!process.env.FB_ACCESS_TOKEN || process.env.FB_ACCESS_TOKEN === 'paste_your_facebook_access_token_here') {
    return res.status(503).json({
      error: 'FB_ACCESS_TOKEN не настроен на сервере. См. DEPLOY_GUIDE.md, раздел "Facebook Ad Library API".',
    });
  }

  // countries может прийти как "US,UA,PL" (новый мультивыбор) или country=US (старый формат, для совместимости).
  let countryList = [];
  if (countries && countries.trim()) {
    countryList = countries.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean);
  } else if (country && country.trim()) {
    countryList = [country.trim().toUpperCase()];
  }
  // Facebook ждёт "ALL" отдельным словом, не внутри списка стран — если он там есть, игнорируем остальное.
  if (countryList.includes('ALL')) countryList = ['ALL'];
  if (countryList.length === 0) countryList = ['US'];

  const params = new URLSearchParams({
    access_token: process.env.FB_ACCESS_TOKEN,
    search_terms: q.trim(),
    ad_type: 'ALL',
    ad_reached_countries: JSON.stringify(countryList),
    ad_active_status: active === 'false' ? 'ALL' : 'ACTIVE',
    fields: FIELDS,
    limit: '50',
  });

  try {
    const fbRes = await fetch(`${FB_BASE_URL}?${params.toString()}`);
    const data = await fbRes.json();

    if (!fbRes.ok) {
      const msg = data?.error?.message || 'Ошибка запроса к Facebook Ad Library API';
      return res.status(fbRes.status).json({ error: msg, fb_error: data?.error });
    }

    const now = new Date().toISOString();
    const upsert = db.prepare(`
      INSERT INTO ad_cache (fb_ad_id, page_name, page_id, ad_creation_time, first_tracked_at, last_seen_at, times_seen, raw_json)
      VALUES (@fb_ad_id, @page_name, @page_id, @ad_creation_time, @now, @now, 1, @raw_json)
      ON CONFLICT(fb_ad_id) DO UPDATE SET
        last_seen_at = @now,
        times_seen = times_seen + 1,
        is_active = 1
    `);

    const results = (data.data || []).map((ad) => {
      upsert.run({
        fb_ad_id: ad.id,
        page_name: ad.page_name || null,
        page_id: ad.page_id || null,
        ad_creation_time: ad.ad_creation_time || ad.ad_delivery_start_time || null,
        now,
        raw_json: JSON.stringify(ad),
      });

      const cached = db.prepare('SELECT first_tracked_at, times_seen FROM ad_cache WHERE fb_ad_id = ?').get(ad.id);

      return {
        id: ad.id,
        page_name: ad.page_name,
        page_id: ad.page_id,
        creative_text: (ad.ad_creative_bodies || [])[0] || null,
        link_title: (ad.ad_creative_link_titles || [])[0] || null,
        link_description: (ad.ad_creative_link_descriptions || [])[0] || null,
        snapshot_url: ad.ad_snapshot_url,
        platforms: ad.publisher_platforms || [],
        languages: ad.languages || [],
        launch_date: ad.ad_creation_time || ad.ad_delivery_start_time || null,
        stop_date: ad.ad_delivery_stop_time || null,
        running_days: daysBetween(ad.ad_creation_time || ad.ad_delivery_start_time, ad.ad_delivery_stop_time),
        first_tracked_by_us_at: cached?.first_tracked_at || now,
        times_seen_by_us: cached?.times_seen || 1,
      };
    });

    // Группируем по странице, чтобы прикинуть "объём запуска" по числу креативов у одного рекламодателя
    const volumeByPage = {};
    for (const r of results) {
      const key = r.page_name || r.page_id || 'unknown';
      volumeByPage[key] = (volumeByPage[key] || 0) + 1;
    }

    res.json({
      count: results.length,
      ads: results,
      volume_by_page: volumeByPage,
      paging: data.paging || null,
      countries: countryList,
      vertical: vertical || null,
      note: 'Meta не раскрывает точный бюджет/показы обычной коммерческой рекламы. running_days и число активных креативов у страницы — лучшая доступная оценка объёма.',
    });
  } catch (err) {
    console.error('FB API error:', err);
    res.status(500).json({ error: 'Не удалось связаться с Facebook Ad Library API' });
  }
});

// Сохранить поисковый запрос (для отслеживания конкурента)
router.post('/saved-searches', requireAuth, (req, res) => {
  const { label, query_params } = req.body;
  if (!label || !query_params) {
    return res.status(400).json({ error: 'Нужны label и query_params' });
  }
  const info = db
    .prepare('INSERT INTO saved_searches (user_id, label, query_params) VALUES (?, ?, ?)')
    .run(req.user.id, label, JSON.stringify(query_params));
  res.status(201).json({ id: info.lastInsertRowid });
});

router.get('/saved-searches', requireAuth, (req, res) => {
  const rows = db
    .prepare('SELECT id, label, query_params, created_at FROM saved_searches WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.user.id);
  res.json(rows.map((r) => ({ ...r, query_params: JSON.parse(r.query_params) })));
});

router.delete('/saved-searches/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM saved_searches WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.status(204).end();
});

// Избранное
router.post('/favorites', requireAuth, (req, res) => {
  const { fb_ad_id, page_name, snapshot_url, ad_creation_time, raw, vertical } = req.body;
  if (!fb_ad_id) return res.status(400).json({ error: 'Нужен fb_ad_id' });

  try {
    db.prepare(`
      INSERT INTO favorites (user_id, fb_ad_id, page_name, snapshot_url, ad_creation_time, raw_json, vertical)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, fb_ad_id, page_name || null, snapshot_url || null, ad_creation_time || null, JSON.stringify(raw || {}), vertical || null);
    res.status(201).json({ ok: true });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Уже в избранном' });
    }
    throw err;
  }
});

router.get('/favorites', requireAuth, (req, res) => {
  const rows = db
    .prepare('SELECT * FROM favorites WHERE user_id = ? ORDER BY first_seen_at DESC')
    .all(req.user.id);
  res.json(rows);
});

router.delete('/favorites/:fb_ad_id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM favorites WHERE fb_ad_id = ? AND user_id = ?').run(req.params.fb_ad_id, req.user.id);
  res.status(204).end();
});

module.exports = router;
