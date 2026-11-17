const express = require('express');
const fetch = require('node-fetch');
const db = require('../db/init');
const { requireAuth } = require('../middleware/auth');
const { scrapeAdLibrary } = require('../services/fbLibraryScraper');

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
async function requireSearchAccess(req, res, next) {
  try {
    const result = await db.query('SELECT role, plan_active FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
    if (user.role === 'admin' || user.plan_active) return next();
    return res.status(403).json({
      error: 'Доступ к поиску объявлений пока ограничен. Напиши администратору сервиса, чтобы его включили.',
      accessDenied: true,
    });
  } catch (err) {
    next(err);
  }
}

function daysBetween(fromIso, toIso) {
  if (!fromIso) return null;
  const from = new Date(fromIso).getTime();
  const to = toIso ? new Date(toIso).getTime() : Date.now();
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.max(0, Math.round((to - from) / (1000 * 60 * 60 * 24)));
}

// Принимает число (готовый Page ID) или ссылку вида facebook.com/NikeRunning — вытаскивает
// последний сегмент пути и просит Graph API превратить его в числовой Page ID.
async function resolvePageId(rawInput) {
  const trimmed = rawInput.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;

  let candidate = trimmed.replace(/^@/, '');
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProtocol);
    if (url.hostname.includes('facebook.com')) {
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length) candidate = parts[parts.length - 1];
    }
  } catch (_) {
    // не похоже на URL — используем как есть (например, просто "nike")
  }

  const params = new URLSearchParams({ fields: 'id,name', access_token: process.env.FB_ACCESS_TOKEN });
  const res = await fetch(`https://graph.facebook.com/${FB_GRAPH_VERSION}/${encodeURIComponent(candidate)}?${params.toString()}`);
  const data = await res.json();
  if (!res.ok || !data.id) {
    throw new Error(data?.error?.message || `Не удалось найти страницу Facebook по «${rawInput}»`);
  }
  return data.id;
}

// Типовые слова каждой ниши (держим в синхроне со списком VERTICALS во frontend/js/app.js).
// Используются как широкие анкеры, когда выбрана вертикаль без своего ключевого слова,
// а также все вместе — когда нажали "Все" и ничего не ввели (см. allVerticalsMode ниже).
const ALL_VERTICALS_SEED_KEYWORDS = ['shop', 'dating', 'crypto', 'game', 'beauty', 'app', 'course', 'travel', 'casino'];

// Поиск объявлений: по ключевому слову и/или по конкретной fan page.
// GET /api/ads/search?q=nike&countries=US,UA&active=true&page=facebook.com/nike&dateFrom=2026-01-01&dateTo=2026-02-01
// &allVerticals=1 — специальный режим кнопки "Все": ключевого слова нет, ищем сразу по всем
// типовым словам ниш и склеиваем результат (у Meta Ad Library API нет параметра "без фильтра
// вообще" и нет OR-поиска по нескольким словам в одном запросе — search_terms всегда матчит
// ad по всем словам сразу, пусть и в любом порядке, так что единственный честный способ
// получить вперемешку объявления разных ниш — сделать несколько параллельных запросов).
router.get('/search', requireAuth, requireSearchAccess, async (req, res, next) => {
  try {
  const { q, country, countries, active = 'true', vertical, page, dateFrom, dateTo, allVerticals } = req.query;

  const keyword = (q || '').trim();
  const pageQuery = (page || '').trim();
  const allVerticalsMode = !keyword && !pageQuery && String(allVerticals) === '1';

  if (!keyword && !pageQuery && !allVerticalsMode) {
    return res.status(400).json({
      error: 'Укажи ключевое слово или fan page — у Meta Ad Library API обязателен хотя бы один из этих двух параметров.',
    });
  }

  // countries может прийти как "US,UA,PL" (новый мультивыбор) или country=US (старый формат, для совместимости).
  let countryList = [];
  if (countries && countries.trim()) {
    countryList = countries.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean);
  } else if (country && country.trim()) {
    countryList = [country.trim().toUpperCase()];
  }
  if (countryList.includes('ALL')) countryList = ['ALL'];
  if (countryList.length === 0) countryList = ['ALL'];

  // Facebook Ad Library API (официальный, через access_token) требует, чтобы личный
  // аккаунт за токеном прошёл verification личности — пока это не сделано, он отдаёт
  // ошибку на любой запрос. Поэтому ищем через ту же публичную страницу
  // facebook.com/ads/library, которую видит любой человек в браузере без логина —
  // она отдаёт те же данные, просто без официального API. Подробнее — в самом скрейпере.
  let keywordsForScrape;
  if (allVerticalsMode) {
    keywordsForScrape = ALL_VERTICALS_SEED_KEYWORDS;
  } else if (pageQuery) {
    // Ищем по имени страницы/рекламодателя как по обычному ключевому слову —
    // поиск на facebook.com/ads/library матчит и текст объявлений, и имя страницы.
    keywordsForScrape = [pageQuery];
  } else {
    keywordsForScrape = [keyword];
  }

  let scrapeResult;
  try {
    scrapeResult = await scrapeAdLibrary({
      countries: countryList,
      keywords: keywordsForScrape,
      activeStatus: active === 'false' ? 'all' : 'active',
    });
  } catch (err) {
    console.error('FB scrape error:', err);
    return res.status(500).json({ error: 'Не удалось связаться с Facebook Ad Library' });
  }

  if (scrapeResult.captchaRequired) {
    return res.status(503).json({
      error: 'Facebook временно запросил капчу на странице Библиотеки рекламы — попробуй ещё раз через пару минут.',
    });
  }
  if (scrapeResult.blocked) {
    console.error('FB Ad Library scrape blocked:', JSON.stringify(scrapeResult.debug || scrapeResult.rejection));
    return res.status(502).json({
      error: 'Facebook не отдал данные Библиотеки рекламы (возможно, изменилась вёрстка страницы или временная блокировка). Попробуй ещё раз чуть позже.',
    });
  }

  let rawAds = scrapeResult.ads;
  const paging = null;

  // Необязательная фильтрация по датам (сам скрейпер их не умеет — фильтруем после получения).
  if (dateFrom || dateTo) {
    const fromTime = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTime = dateTo ? new Date(dateTo).getTime() : null;
    rawAds = rawAds.filter((ad) => {
      const started = ad.ad_creation_time || ad.ad_delivery_start_time;
      if (!started) return true;
      const t = new Date(started).getTime();
      if (fromTime && t < fromTime) return false;
      if (toTime && t > toTime) return false;
      return true;
    });
  }

  const now = new Date().toISOString();
  const results = [];
  for (const ad of rawAds) {
    await db.query(
      `INSERT INTO ad_cache (fb_ad_id, page_name, page_id, ad_creation_time, first_tracked_at, last_seen_at, times_seen, raw_json)
       VALUES ($1, $2, $3, $4, $5, $5, 1, $6)
       ON CONFLICT (fb_ad_id) DO UPDATE SET
         last_seen_at = $5,
         times_seen = ad_cache.times_seen + 1,
         is_active = 1`,
      [ad.id, ad.page_name || null, ad.page_id || null, ad.ad_creation_time || ad.ad_delivery_start_time || null, now, JSON.stringify(ad)]
    );

    const cachedRes = await db.query('SELECT first_tracked_at, times_seen FROM ad_cache WHERE fb_ad_id = $1', [ad.id]);
    const cached = cachedRes.rows[0];

    results.push({
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
      is_active: !ad.ad_delivery_stop_time,
      running_days: daysBetween(ad.ad_creation_time || ad.ad_delivery_start_time, ad.ad_delivery_stop_time),
      first_tracked_by_us_at: cached?.first_tracked_at || now,
      times_seen_by_us: cached?.times_seen || 1,
    });
  }

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
    paging,
    countries: countryList,
    vertical: vertical || null,
    all_verticals_used: allVerticalsMode,
    note: 'Данные берутся с публичной страницы facebook.com/ads/library. Meta не раскрывает точный бюджет/показы обычной коммерческой рекламы — running_days и число активных креативов у страницы остаются лучшей доступной оценкой объёма.'
      + (allVerticalsMode ? ' Показан срез сразу по нескольким типовым нишам (без привязки к одной вертикали) — не весь архив Facebook, а обзор.' : ''),
  });
  } catch (err) {
    next(err);
  }
});

// Сохранить поисковый запрос (для отслеживания конкурента)
router.post('/saved-searches', requireAuth, async (req, res, next) => {
  try {
    const { label, query_params } = req.body;
    if (!label || !query_params) {
      return res.status(400).json({ error: 'Нужны label и query_params' });
    }
    const result = await db.query(
      'INSERT INTO saved_searches (user_id, label, query_params) VALUES ($1, $2, $3) RETURNING id',
      [req.user.id, label, JSON.stringify(query_params)]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

router.get('/saved-searches', requireAuth, async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, label, query_params, created_at FROM saved_searches WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows.map((r) => ({ ...r, query_params: JSON.parse(r.query_params) })));
  } catch (err) {
    next(err);
  }
});

router.delete('/saved-searches/:id', requireAuth, async (req, res, next) => {
  try {
    await db.query('DELETE FROM saved_searches WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Избранное
router.post('/favorites', requireAuth, async (req, res, next) => {
  try {
    const { fb_ad_id, page_name, snapshot_url, ad_creation_time, raw, vertical } = req.body;
    if (!fb_ad_id) return res.status(400).json({ error: 'Нужен fb_ad_id' });

    await db.query(
      `INSERT INTO favorites (user_id, fb_ad_id, page_name, snapshot_url, ad_creation_time, raw_json, vertical)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [req.user.id, fb_ad_id, page_name || null, snapshot_url || null, ad_creation_time || null, JSON.stringify(raw || {}), vertical || null]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Уже в избранном' });
    }
    next(err);
  }
});

router.get('/favorites', requireAuth, async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM favorites WHERE user_id = $1 ORDER BY first_seen_at DESC', [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.delete('/favorites/:fb_ad_id', requireAuth, async (req, res, next) => {
  try {
    await db.query('DELETE FROM favorites WHERE fb_ad_id = $1 AND user_id = $2', [req.params.fb_ad_id, req.user.id]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
