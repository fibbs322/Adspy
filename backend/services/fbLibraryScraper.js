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

function buildUrl({ country, keyword, pageId, activeStatus, mediaType }) {
  const params = new URLSearchParams({
    active_status: activeStatus === 'all' ? 'all' : 'active',
    ad_type: 'all',
    country: country || 'ALL',
    is_targeted_country: 'false',
    media_type: mediaType === 'image' || mediaType === 'video' ? mediaType : 'all',
  });
  // "Все объявления этой страницы" — отдельный режим поиска у Facebook, не то же самое,
  // что искать числовой page_id как текст в объявлении (q=12345 не находит ничего,
  // это как раз баг, который чинит этот if). У публичной библиотеки свой параметр —
  // view_all_page_id + search_type=page, без q вообще.
  if (pageId) {
    params.set('search_type', 'page');
    params.set('view_all_page_id', pageId);
  } else {
    params.set('search_type', 'keyword_unordered');
    if (keyword) params.set('q', keyword);
  }
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

// Определяет тип медиа и достаёт превью/видео из одного "collated_results" элемента.
// Facebook хранит медиа по-разному в зависимости от формата объявления: у простых
// (IMAGE/VIDEO) — в snapshot.images[]/snapshot.videos[], у динамических (DCO/DPA/
// карусели) — внутри snapshot.cards[]. Проверяем оба места.
function extractMedia(node) {
  const snapshot = node.snapshot || {};
  const cards = snapshot.cards || [];
  const firstCard = cards[0] || {};
  const topVideo = (snapshot.videos || [])[0] || null;
  const topImage = (snapshot.images || [])[0] || null;

  const videoUrl = (topVideo && (topVideo.video_hd_url || topVideo.video_sd_url))
    || firstCard.video_hd_url || firstCard.video_sd_url || null;
  const videoPreview = (topVideo && topVideo.video_preview_image_url) || firstCard.video_preview_image_url || null;
  const imageUrl = (topImage && (topImage.original_image_url || topImage.resized_image_url))
    || firstCard.original_image_url || firstCard.resized_image_url || null;

  let mediaType = 'unknown';
  if (snapshot.display_format === 'VIDEO' || videoUrl) mediaType = 'video';
  else if (imageUrl || snapshot.display_format === 'IMAGE' || snapshot.display_format === 'DPA' || snapshot.display_format === 'CAROUSEL') mediaType = 'image';

  const thumbnailUrl = videoPreview || imageUrl || snapshot.page_profile_picture_url || null;

  return { mediaType, thumbnailUrl, videoUrl };
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
  const media = extractMedia(node);

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
    media_type: media.mediaType,
    thumbnail_url: media.thumbnailUrl,
    video_url: media.videoUrl,
  };
}

function setCookieFromResponse(res) {
  applySetCookie(res.headers.raw ? res.headers.raw()['set-cookie'] : res.headers.get('set-cookie'));
}

// Facebook отдаёт серверным (дата-центровым) запросам без исполнения JS не 403 "доступ
// запрещён", а лёгкую анти-бот проверку — HTML-страницу с инлайн-скриптом, который делает
// один POST на одноразовый эндпоинт вида /__rd_verify_...?challenge=N, после чего обычный
// браузер перезагружает страницу и получает настоящий контент. Это не капча — конкретно
// эта проверка не требует решать ничего, просто "исполни JS хотя бы один раз", так что мы
// можем пройти её напрямую: распарсить URL из тела ответа, сходить туда POST-ом (это выдаёт
// нужный cookie), и повторить исходный запрос.
function extractChallengeUrl(html) {
  const match = html.match(/fetch\('(\/__rd_verify[^']+)'/);
  return match ? match[1] : null;
}

async function solveClientChallenge(challengePath, refererUrl) {
  const url = `https://www.facebook.com${challengePath}`;
  const headers = { ...BROWSER_HEADERS, Referer: refererUrl, Origin: 'https://www.facebook.com' };
  const cookies = cookieHeader();
  if (cookies) headers['Cookie'] = cookies;
  const res = await fetch(url, { method: 'POST', headers });
  setCookieFromResponse(res);
  try { await res.text(); } catch (_) {}
  return res.ok;
}

// Выполняет один поисковый запрос к публичной библиотеке.
// Возвращает { ads, count, captchaRequired, blocked }.
async function scrapeOnce({ country, keyword, pageId, activeStatus, mediaType }, attempt = 0) {
  const url = buildUrl({ country, keyword, pageId, activeStatus, mediaType });
  const headers = { ...BROWSER_HEADERS };
  const cookies = cookieHeader();
  if (cookies) headers['Cookie'] = cookies;

  const res = await fetch(url, { headers });
  setCookieFromResponse(res);

  if (!res.ok) {
    let bodySnippet = '';
    try { bodySnippet = (await res.text()).slice(0, 1500); } catch (_) {}

    if (res.status === 403 && attempt === 0) {
      const challengePath = extractChallengeUrl(bodySnippet);
      if (challengePath) {
        const solved = await solveClientChallenge(challengePath, url);
        if (solved) return scrapeOnce({ country, keyword, pageId, activeStatus, mediaType }, attempt + 1);
      }
    }

    return {
      ads: [],
      count: 0,
      blocked: true,
      debug: { status: res.status, statusText: res.statusText, bodySnippet, requestUrl: url },
    };
  }

  const html = await res.text();

  if (html.includes('xfb_ad_library_is_captcha_required":true')) {
    return { ads: [], count: 0, captchaRequired: true };
  }

  const connection = extractSearchResults(html);
  if (!connection) {
    return {
      ads: [],
      count: 0,
      blocked: true,
      reason: 'no_data_block_found',
      debug: { status: res.status, htmlLength: html.length, htmlSnippet: html.slice(0, 800), requestUrl: url },
    };
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

// Максимум сколько комбинаций (страна × слово) реально отправляем в одном поиске.
// Инцидент 18.11: выбрали регион "Европа" (35 стран) + вертикаль "Гемблинг" (84 слова)
// => 2940 комбинаций разом. Promise.allSettled запускает их ВСЕ одновременно, и даже
// с неблокирующим fetch разбор каждого большого HTML-ответа FB (регэксп + JSON.parse в
// extractSearchResults) — синхронный, CPU-bound код на единственном потоке event loop.
// Тысячи таких разборов почти одновременно забивают единственный поток под завязку —
// сервис перестаёт отвечать вообще на всё (включая /api/config), не только на поиск.
// Фикс в два слоя: (1) жёсткий потолок на число комбинаций — лишние слова обрезаются,
// а не страны (явный выбор стран — осознанное решение пользователя, слова — подставлены
// автоматически под капотом, их и урезаем); (2) ограничение параллелизма (runWithLimit
// ниже), чтобы даже в рамках потолка не улетало больше нескольких запросов разом.
// 150 — с запасом выше уже проверенных в проде безопасных случаев (84 слова × 1 страна
// = 84 комбинации отработали быстро и без проблем), но далеко ниже того, что реально
// положило сервис (2940). Для 1-2 стран это не обрезает список слов вообще.
const MAX_FANOUT_COMBINATIONS = 150;
const SCRAPE_CONCURRENCY = 8;

// Простой пул воркеров без внешних зависимостей (p-limit и т.п.): берёт задачи по
// очереди, не больше `limit` одновременно — в отличие от Promise.allSettled(tasks),
// который стартует все задачи в тот же тик.
async function runWithLimit(taskFns, limit) {
  const results = new Array(taskFns.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < taskFns.length) {
      const i = nextIndex++;
      try {
        results[i] = { status: 'fulfilled', value: await taskFns[i]() };
      } catch (err) {
        results[i] = { status: 'rejected', reason: err };
      }
    }
  }
  const workerCount = Math.max(1, Math.min(limit, taskFns.length));
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

// Поиск по нескольким странам и/или нескольким ключевым словам (для режима
// "Все вертикали") одним вызовом, с объединением и удалением дублей по id.
async function scrapeAdLibrary({ countries, keywords, pageId, activeStatus, mediaType }) {
  const countryList = (countries && countries.length ? countries : ['ALL']);
  // Поиск "все объявления этой страницы" (pageId) — отдельный режим, не комбинируется
  // с перебором ключевых слов: он одним запросом возвращает все креативы страницы.
  let keywordList = pageId ? [null] : (keywords && keywords.length ? keywords : [null]);

  // Если комбинаций больше потолка — обрезаем именно список слов (см. комментарий выше
  // про MAX_FANOUT_COMBINATIONS), стран не трогаем.
  let fanoutTrimmed = false;
  if (!pageId && countryList.length * keywordList.length > MAX_FANOUT_COMBINATIONS) {
    const maxKeywords = Math.max(1, Math.floor(MAX_FANOUT_COMBINATIONS / countryList.length));
    if (keywordList.length > maxKeywords) {
      keywordList = keywordList.slice(0, maxKeywords);
      fanoutTrimmed = true;
    }
  }

  const taskFns = [];
  for (const country of countryList) {
    for (const keyword of keywordList) {
      taskFns.push(() => scrapeOnce({ country, keyword, pageId, activeStatus, mediaType }));
    }
  }

  const settled = await runWithLimit(taskFns, SCRAPE_CONCURRENCY);
  const seen = new Set();
  const ads = [];
  let anyCaptcha = false;
  let anyBlocked = false;
  let anySuccess = false;
  let totalCount = 0;
  let firstDebug = null;
  let firstRejection = null;

  for (const result of settled) {
    if (result.status !== 'fulfilled') {
      if (!firstRejection) firstRejection = String(result.reason && result.reason.message || result.reason);
      continue;
    }
    const value = result.value;
    if (value.captchaRequired) anyCaptcha = true;
    if (value.blocked) anyBlocked = true;
    if (value.debug && !firstDebug) firstDebug = value.debug;
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
    debug: firstDebug,
    rejection: firstRejection,
    captchaRequired: anyCaptcha,
    blocked: !anySuccess && (anyBlocked || anyCaptcha),
    fanoutTrimmed,
    keywordsUsedCount: keywordList.length,
  };
}

module.exports = { scrapeAdLibrary };
