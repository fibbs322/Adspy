// Скрейпер публичного сайта Facebook Ad Library (facebook.com/ads/library).
//
// Почему так, а не через официальный Graph API ads_archive:
// официальный эндпоинт требует, чтобы личный аккаунт, которому принадлежит
// access_token, прошёл верификацию личности (facebook.com/ID) — без неё
// Facebook отдаёт ошибку "Application does not have permission for this action"
// на ЛЮБОЙ запрос. Сама же страница facebook.com/ads/library — публичная
// витрина (требование DSA/прозрачности рекламы в ЕС), она отдаёт те же самые
// данные без логина и без какого-либо токена: при открытии страницы Facebook
// встраивает JSON с результатами прямо в HTML (в <script type="application/json">,
// как часть внутреннего relay-кэша). Мы просто делаем тот же GET-запрос, что
// делает браузер, и достаём оттуда этот JSON.
//
// Важно: это не официальный, не документированный интерфейс — Facebook может
// менять разметку без предупреждения, и формально это скрейпинг публичной
// страницы (см. предупреждение в DEPLOY_GUIDE.md). Если верстка изменится и
// парсинг перестанет находить блок с результатами — см. extractSearchResults ниже.

const BASE_URL = 'https://www.facebook.com/ads/library/';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Site': 'none',
  'Upgrade-Insecure-Requests': '1',
};

// Простой cookie jar на весь процесс: FB охотнее отдаёт данные, когда видит
// "знакомого" визитёра (с уже выданными cookie datr/sb и т.п.), а не нового
// анонима на каждый запрос. Переживает между запросами, пока жив процесс.
let cookieJar = {};

function applySetCookie(setCookieHeaders) {
  if (!setCookieHeaders) return;
  const list = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  for (const raw of list) {
    const first = raw.split(';')[0];
    const eq = first.indexOf('=');
    if (eq === -1) continue;
    const name = first.slice(0, eq).trim();
    const value = first.slice(eq + 1).trim();
    if (name) cookieJar[name] = value;
  }
}

function cookieHeader() {
  return Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ');
}

function buildUrl({ country, keyword, activeStatus }) {
  const params = new URLSearchParams({
    active_status: activeStatus === 'all' ? 'all' : 'active',
    ad_type: 'all',
    country: country || 'ALL',
    is_targeted_country: 'false',
    media_type: 'all',
    search_type: 'keyword_unordered',
  });
  if (keyword) params.set('q', keyword);
  return `${BASE_URL}?${params.toString()}`;
}

// Достаёт из HTML страницы встроенный JSON с результатами поиска.
// Facebook рассыпает начальные данные по нескольким <script type="application/json">
// блокам (в составе "require"-протокола their comet/relay фреймворка) — ищем среди
// них тот, что содержит ad_library_main.search_results_connection.
function extractSearchResults(html) {
  const scriptRegex = /<script type="application\/json"[^>]*>([\s\S]*?)<\/script>/g;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    const raw = match[1];
    if (!raw.includes('search_results_connection')) continue;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (_) {
      continue;
    }
    const found = deepFindSearchConnection(parsed);
    if (found) return found;
  }
  return null;
}

function deepFindSearchConnection(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 25) return null;
  if (node.ad_library_main && node.ad_library_main.search_results_connection) {
    return node.ad_library_main.search_results_connection;
  }
  for (const key of Object.keys(node)) {
    const val = node[key];
    if (val && typeof val === 'object') {
      const found = deepFindSearchConnection(val, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function toIso(unixSeconds) {
  if (!unixSeconds) return null;
  return new Date(unixSeconds * 1000).toISOString();
}

// Преобразует один "collated_results" элемент в форму, которую ожидает
// остальной код в routes/ads.js (такую же, как отдаёт официальный Graph API
// ads_archive — id, page_name, ad_creative_bodies, ...), чтобы не трогать
// логику ниже по пайплайну (кэш в БД, подсчёт объёма по странице и т.д.).
function mapNode(node) {
  const snapshot = node.snapshot || {};
  const cards = snapshot.cards || [];
  const firstCard = cards[0] || {};
  const body = firstCard.body || (snapshot.body && snapshot.body.text) || null;
  const title = firstCard.title || snapshot.title || null;
  const linkDescription = firstCard.link_description || snapshot.link_description || null;

  return {
    id: node.ad_archive_id,
    page_id: node.page_id || snapshot.page_id || null,
    page_name: node.page_name || snapshot.page_name || null,
    ad_creation_time: toIso(node.start_date),
    ad_delivery_start_time: toIso(node.start_date),
    ad_delivery_stop_time: node.is_active ? null : toIso(node.end_date),
    ad_creative_bodies: body ? [body] : [],
    ad_creative_link_titles: title ? [title] : [],
    ad_creative_link_descriptions: linkDescription ? [linkDescription] : [],
    ad_snapshot_url: `https://www.facebook.com/ads/library/?id=${node.ad_archive_id}`,
    publisher_platforms: node.publisher_platform || [],
    languages: [],
  };
}

// Выполняет один поисковый запрос к публичной библиотеке.
// Возвращает { ads, count, captchaRequired, blocked }.
async function scrapeOnce({ country, keyword, activeStatus }) {
  const url = buildUrl({ country, keyword, activeStatus });
  const headers = { ...BROWSER_HEADERS };
  const cookies = cookieHeader();
  if (cookies) headers['Cookie'] = cookies;

  const res = await fetch(url, { headers });
  applySetCookie(res.headers.raw ? res.headers.raw()['set-cookie'] : res.headers.get('set-cookie'));

  if (!res.ok) {
    return { ads: [], count: 0, blocked: true, status: res.status };
  }

  const html = await res.text();

  if (html.includes('xfb_ad_library_is_captcha_required":true')) {
    return { ads: [], count: 0, captchaRequired: true };
  }

  const connection = extractSearchResults(html);
  if (!connection) {
    return { ads: [], count: 0, blocked: true, reason: 'no_data_block_found' };
  }

  const ads = [];
  for (const edge of connection.edges || []) {
    const collated = (edge.node && edge.node.collated_results) || [];
    for (const node of collated) {
      if (!node || !node.ad_archive_id) continue;
      ads.push(mapNode(node));
    }
  }

  return { ads, count: connection.count || ads.length, captchaRequired: false, blocked: false };
}

// Поиск по нескольким странам и/или нескольким ключевым словам (для режима
// "Все вертикали") одним вызовом, с объединением и удалением дублей по id.
async function scrapeAdLibrary({ countries, keywords, activeStatus }) {
  const countryList = (countries && countries.length ? countries : ['ALL']);
  const keywordList = (keywords && keywords.length ? keywords : [null]);

  const tasks = [];
  for (const country of countryList) {
    for (const keyword of keywordList) {
      tasks.push(scrapeOnce({ country, keyword, activeStatus }));
    }
  }

  const settled = await Promise.allSettled(tasks);
  const seen = new Set();
  const ads = [];
  let anyCaptcha = false;
  let anyBlocked = false;
  let anySuccess = false;
  let totalCount = 0;

  for (const result of settled) {
    if (result.status !== 'fulfilled') continue;
    const value = result.value;
    if (value.captchaRequired) anyCaptcha = true;
    if (value.blocked) anyBlocked = true;
    if (!value.blocked && !value.captchaRequired) anySuccess = true;
    totalCount += value.count || 0;
    for (const ad of value.ads) {
      if (seen.has(ad.id)) continue;
      seen.add(ad.id);
      ads.push(ad);
    }
  }

  return {
    ads,
    count: totalCount,
    captchaRequired: anyCaptcha,
    blocked: !anySuccess && (anyBlocked || anyCaptcha),
  };
}

module.exports = { scrapeAdLibrary };
