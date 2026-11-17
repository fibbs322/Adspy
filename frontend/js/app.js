// --- Справочники: вертикали и страны ---
// "Вертикаль" — это наш собственный тег поверх данных Facebook (у Ad Library API нет категорий
// рекламы), он просто помогает организовать сохранённые поиски и избранное по нишам.
// hasSeedKeywords — если выбрана эта вертикаль, но поле "Ключевое слово" оставлено пустым,
// сервер сам подставляет НАБОР типовых анкорных слов этой ниши (не одно слово, см.
// VERTICAL_SEED_KEYWORDS в backend/routes/ads.js) и склеивает результаты по ним. У Meta Ad
// Library нет режима "без фильтров вообще" — он требует search_terms или search_page_ids.
const VERTICALS = [
  { id: 'ecommerce', label: 'E-commerce', color: 'var(--v-ecommerce)', hasSeedKeywords: true },
  { id: 'dating', label: 'Дейтинг', color: 'var(--v-dating)', hasSeedKeywords: true },
  { id: 'finance', label: 'Финансы/Крипто', color: 'var(--v-finance)', hasSeedKeywords: true },
  { id: 'gaming', label: 'Игры', color: 'var(--v-gaming)', hasSeedKeywords: true },
  { id: 'beauty', label: 'Здоровье/Красота', color: 'var(--v-beauty)', hasSeedKeywords: true },
  { id: 'saas', label: 'SaaS/Приложения', color: 'var(--v-saas)', hasSeedKeywords: true },
  { id: 'education', label: 'Образование', color: 'var(--v-education)', hasSeedKeywords: true },
  { id: 'travel', label: 'Путешествия', color: 'var(--v-travel)', hasSeedKeywords: true },
  { id: 'gambling', label: 'Гемблинг', color: 'var(--v-gambling)', hasSeedKeywords: true },
  { id: 'other', label: 'Другое', color: 'var(--v-other)', hasSeedKeywords: false },
];
function verticalInfo(id) {
  return VERTICALS.find((v) => v.id === id) || null;
}

const COUNTRIES = [
  { code: 'US', label: 'США' },
  { code: 'UA', label: 'Украина' },
  { code: 'PL', label: 'Польша' },
  { code: 'DE', label: 'Германия' },
  { code: 'GB', label: 'Великобритания' },
  { code: 'FR', label: 'Франция' },
  { code: 'CA', label: 'Канада' },
  { code: 'AU', label: 'Австралия' },
  { code: 'ES', label: 'Испания' },
  { code: 'IT', label: 'Италия' },
];

let selectedCountries = ['US'];
let activeVertical = null; // null = все вертикали

// --- Статус подключения FB Ad Library API ---
async function initFbStatus() {
  const el = document.getElementById('fb-status');
  try {
    const config = await API.getConfig();
    el.classList.remove('hidden');
    if (config.fbConfigured) {
      el.className = 'fb-status ok';
      el.innerHTML = '<span class="dot"></span> FB API подключён';
    } else {
      el.className = 'fb-status off';
      el.innerHTML = '<span class="dot"></span> FB API не настроен';
    }
  } catch (err) {
    el.classList.add('hidden');
  }
}

// --- Мультиселект стран ---
function renderCountryPanel() {
  const panel = document.getElementById('country-panel');
  panel.innerHTML = `
    <label><input type="checkbox" value="ALL" ${selectedCountries.includes('ALL') ? 'checked' : ''}/> Все страны</label>
    <hr/>
    ${COUNTRIES.map((c) => `<label><input type="checkbox" value="${c.code}" ${selectedCountries.includes(c.code) ? 'checked' : ''}/> ${c.label}</label>`).join('')}
  `;
  panel.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.value === 'ALL') {
        selectedCountries = cb.checked ? ['ALL'] : ['US'];
      } else {
        if (selectedCountries.includes('ALL')) selectedCountries = [];
        if (cb.checked) selectedCountries.push(cb.value);
        else selectedCountries = selectedCountries.filter((c) => c !== cb.value);
        if (selectedCountries.length === 0) selectedCountries = ['US'];
      }
      renderCountryPanel();
      updateCountryToggleLabel();
    });
  });
}

function updateCountryToggleLabel() {
  const label = document.getElementById('country-toggle-label');
  if (selectedCountries.includes('ALL')) {
    label.textContent = 'Все страны';
  } else if (selectedCountries.length === 1) {
    const c = COUNTRIES.find((x) => x.code === selectedCountries[0]);
    label.textContent = c ? c.label : selectedCountries[0];
  } else {
    label.textContent = `Страны: ${selectedCountries.join(', ')}`;
  }
}

function setSelectedCountries(list) {
  selectedCountries = (list && list.length) ? list : ['US'];
  renderCountryPanel();
  updateCountryToggleLabel();
}

document.getElementById('country-toggle').addEventListener('click', () => {
  document.getElementById('country-panel').classList.toggle('hidden');
});
document.addEventListener('click', (e) => {
  const ms = document.getElementById('country-multiselect');
  if (!ms.contains(e.target)) document.getElementById('country-panel').classList.add('hidden');
});
renderCountryPanel();
updateCountryToggleLabel();

// --- Фильтр по вертикали (чипы в сайдбаре + вкладки в шапке, всегда синхронизированы) ---
function renderVerticalPickers() {
  const sidebarEl = document.getElementById('vertical-filter');
  const topbarEl = document.getElementById('vertical-tabs');

  const chipHtml = (v) => `
    <span class="v-chip ${activeVertical === v.id ? 'active' : ''}" data-id="${v.id}" style="${activeVertical === v.id ? `color:${v.color}` : ''}">
      <span class="v-dot" style="background:${v.color}"></span>${v.label}
    </span>`;

  sidebarEl.innerHTML = `
    <span class="v-chip ${activeVertical === null ? 'active' : ''}" data-id="">Все</span>
    ${VERTICALS.map(chipHtml).join('')}
  `;

  topbarEl.classList.remove('hidden');
  topbarEl.innerHTML = `
    <button type="button" data-id="" class="${activeVertical === null ? 'active' : ''}">Все</button>
    ${VERTICALS.map((v) => `<button type="button" data-id="${v.id}" class="${activeVertical === v.id ? 'active' : ''}" style="${activeVertical === v.id ? `background:${v.color}` : ''}">${v.label}</button>`).join('')}
  `;

  const handlers = (el) => {
    el.querySelectorAll('[data-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeVertical = btn.dataset.id || null;
        renderVerticalPickers();
      });
    });
  };
  handlers(sidebarEl);
  handlers(topbarEl);
}
renderVerticalPickers();

function populateVerticalSelect(selectEl, value) {
  selectEl.innerHTML = '<option value="">— без вертикали —</option>' +
    VERTICALS.map((v) => `<option value="${v.id}">${v.label}</option>`).join('');
  selectEl.value = value || '';
}

// --- Переключение вкладок авторизации ---
const tabBtns = document.querySelectorAll('.tab-btn');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const verifyForm = document.getElementById('verify-form');

// --- Показать/скрыть пароль ---
document.querySelectorAll('.toggle-eye').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = btn.previousElementSibling;
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    btn.textContent = showing ? '👁' : '🙈';
    btn.setAttribute('aria-label', showing ? 'Показать пароль' : 'Скрыть пароль');
  });
});

tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    verifyForm.classList.add('hidden');
    if (btn.dataset.tab === 'login') {
      loginForm.classList.remove('hidden');
      registerForm.classList.add('hidden');
    } else {
      registerForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
    }
  });
});

function showVerifyStep(email) {
  loginForm.classList.add('hidden');
  registerForm.classList.add('hidden');
  verifyForm.classList.remove('hidden');
  verifyForm.dataset.email = email;
  document.getElementById('verify-email-label').textContent = email;
  document.getElementById('verify-error').textContent = '';
}

// --- Вход через Google ---
function waitForGoogleScript(timeoutMs = 4000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      if (window.google && window.google.accounts && window.google.accounts.id) return resolve(true);
      if (Date.now() - start > timeoutMs) return resolve(false);
      setTimeout(check, 100);
    };
    check();
  });
}

async function initGoogleSignIn() {
  try {
    const config = await API.getConfig();
    if (!config.googleClientId) return;
    const ready = await waitForGoogleScript();
    if (!ready) return;

    const box = document.getElementById('google-signin-box');
    box.classList.remove('hidden');

    window.google.accounts.id.initialize({
      client_id: config.googleClientId,
      callback: async (response) => {
        const errEls = [document.getElementById('login-error'), document.getElementById('register-error')];
        errEls.forEach((el) => { if (el) el.textContent = ''; });
        try {
          const data = await API.googleLogin(response.credential);
          API.setToken(data.token);
          showDashboard();
        } catch (err) {
          errEls.forEach((el) => { if (el) el.textContent = err.message; });
        }
      },
    });

    window.google.accounts.id.renderButton(document.getElementById('google-signin-button'), {
      theme: 'filled_black',
      size: 'large',
      width: 300,
      text: 'continue_with',
    });
  } catch (err) {
    // Если бэкенд недоступен или конфиг не отдаётся — просто не показываем кнопку Google
  }
}

const authView = document.getElementById('auth-view');
const dashboardView = document.getElementById('dashboard-view');
const nav = document.getElementById('nav');

function renderNav() {
  const navButtons = document.getElementById('nav-buttons');
  navButtons.innerHTML = '';
  if (API.getToken()) {
    const logoutBtn = document.createElement('button');
    logoutBtn.textContent = 'Выйти';
    logoutBtn.onclick = () => {
      API.clearToken();
      showAuth();
    };
    navButtons.appendChild(logoutBtn);
  }
}

function showAuth() {
  authView.classList.remove('hidden');
  dashboardView.classList.add('hidden');
  document.getElementById('vertical-tabs').classList.add('hidden');
  document.getElementById('fb-status').classList.add('hidden');
  document.getElementById('admin-btn').classList.add('hidden');
  document.getElementById('access-banner').classList.add('hidden');
  currentUser = null;
  renderNav();
}

let currentUser = null;

async function initCurrentUser() {
  const adminBtn = document.getElementById('admin-btn');
  const banner = document.getElementById('access-banner');
  try {
    currentUser = await API.getMe();
    adminBtn.classList.toggle('hidden', !currentUser.isAdmin);
    const hasAccess = currentUser.isAdmin || currentUser.hasSearchAccess;
    banner.classList.toggle('hidden', hasAccess);
    return hasAccess;
  } catch (err) {
    currentUser = null;
    adminBtn.classList.add('hidden');
    banner.classList.add('hidden');
    return false;
  }
}

function showDashboard() {
  authView.classList.add('hidden');
  dashboardView.classList.remove('hidden');
  renderNav();
  initFbStatus();
  loadSavedSearches();
  loadFavorites();
  // Сразу показываем какие-то креативы при входе, без ручного нажатия "Найти" —
  // по умолчанию вертикаль "Все" уже выбрана, этого достаточно для первого запроса.
  // Если открыли по ссылке "↗ в новой вкладке" (?page=...&pageName=...) — сразу ищем
  // креативы именно этой страницы, а не дефолтный срез по всем нишам.
  initCurrentUser().then((hasAccess) => {
    if (!hasAccess || lastResults) return;
    const params = new URLSearchParams(window.location.search);
    const pageParam = params.get('page');
    if (pageParam) {
      searchByPage(pageParam, params.get('pageName') || '');
    } else {
      searchForm.requestSubmit();
    }
  });
}

// --- Админка ---
const adminModal = document.getElementById('admin-modal');
document.getElementById('admin-btn').addEventListener('click', async () => {
  adminModal.classList.remove('hidden');
  await loadAdminUsers();
});
document.getElementById('admin-close').addEventListener('click', () => adminModal.classList.add('hidden'));
adminModal.addEventListener('click', (e) => { if (e.target === adminModal) adminModal.classList.add('hidden'); });

async function loadAdminUsers() {
  const body = document.getElementById('admin-users-body');
  body.innerHTML = '<tr><td colspan="3">Загружаем…</td></tr>';
  try {
    const users = await API.adminListUsers();
    body.innerHTML = users.map((u) => {
      const isAdmin = u.role === 'admin';
      const hasAccess = isAdmin || Boolean(u.plan_active);
      return `
        <tr data-id="${u.id}">
          <td>${escapeHtml(u.email)}</td>
          <td class="${isAdmin ? 'role-admin' : ''}">${isAdmin ? 'Админ' : 'Пользователь'}</td>
          <td>
            <button type="button" class="access-toggle ${hasAccess ? 'on' : ''}" ${isAdmin ? 'disabled' : ''}>
              ${hasAccess ? '✅ Включён' : '⛔ Выключен'}
            </button>
          </td>
        </tr>
      `;
    }).join('');

    body.querySelectorAll('.access-toggle:not(:disabled)').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.closest('tr').dataset.id;
        const nowOn = btn.classList.contains('on');
        try {
          await API.adminSetAccess(id, !nowOn);
          loadAdminUsers();
        } catch (err) {
          alert(err.message);
        }
      });
    });
  } catch (err) {
    body.innerHTML = `<tr><td colspan="3">${escapeHtml(err.message)}</td></tr>`;
  }
}

// --- Авторизация ---
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  const fd = new FormData(loginForm);
  try {
    const data = await API.login(fd.get('email'), fd.get('password'));
    API.setToken(data.token);
    showDashboard();
  } catch (err) {
    if (err.data && err.data.needsVerification) {
      showVerifyStep(err.data.email);
    } else {
      errEl.textContent = err.message;
    }
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('register-error');
  errEl.textContent = '';
  const fd = new FormData(registerForm);
  const password = fd.get('password');
  const password2 = fd.get('password2');
  if (password !== password2) {
    errEl.textContent = 'Пароли не совпадают';
    return;
  }
  try {
    const data = await API.register(fd.get('email'), password);
    if (data.needsVerification) {
      showVerifyStep(data.email);
    } else {
      API.setToken(data.token);
      showDashboard();
    }
  } catch (err) {
    errEl.textContent = err.message;
  }
});

verifyForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('verify-error');
  errEl.textContent = '';
  const fd = new FormData(verifyForm);
  try {
    const data = await API.verifyEmail(verifyForm.dataset.email, fd.get('code'));
    API.setToken(data.token);
    showDashboard();
  } catch (err) {
    errEl.textContent = err.message;
  }
});

document.getElementById('resend-code-btn').addEventListener('click', async (e) => {
  const btn = e.target;
  const errEl = document.getElementById('verify-error');
  errEl.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Отправляем…';
  try {
    await API.resendCode(verifyForm.dataset.email);
    btn.textContent = 'Код отправлен повторно';
  } catch (err) {
    errEl.textContent = err.message;
    btn.textContent = 'Отправить код ещё раз';
  } finally {
    setTimeout(() => {
      btn.disabled = false;
      if (btn.textContent !== 'Отправить код ещё раз') btn.textContent = 'Отправить код ещё раз';
    }, 15000);
  }
});

// --- Поиск объявлений ---
const searchForm = document.getElementById('search-form');
const resultsEl = document.getElementById('results');
const searchMetaEl = document.getElementById('search-meta');

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ru-RU', { year: 'numeric', month: 'short', day: 'numeric' });
}

function updateStat(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function thumbHtml(ad) {
  if (ad.media_type === 'video' && (ad.video_url || ad.thumbnail_url)) {
    const poster = ad.thumbnail_url ? ` poster="${escapeHtml(ad.thumbnail_url)}"` : '';
    if (ad.video_url) {
      return `<video src="${escapeHtml(ad.video_url)}"${poster} muted loop playsinline preload="metadata"></video><span class="play-badge">▶</span>`;
    }
    return `<img src="${escapeHtml(ad.thumbnail_url)}" loading="lazy" alt="" /><span class="play-badge">▶</span>`;
  }
  if (ad.thumbnail_url) {
    return `<img src="${escapeHtml(ad.thumbnail_url)}" loading="lazy" alt="" />`;
  }
  return '<div class="no-media">Нет превью</div>';
}

function renderAds(payload) {
  const { ads, count, volume_by_page } = payload;
  updateStat('stat-results', count || 0);

  if (!ads || ads.length === 0) {
    resultsEl.innerHTML = '<div class="empty-state">Ничего не найдено. Попробуй другой запрос, вертикаль или страну.</div>';
    searchMetaEl.innerHTML = '';
    return;
  }

  const vInfo = activeVertical ? verticalInfo(activeVertical) : null;

  const showBackBtn = Boolean(previousQuery) && Boolean(lastQuery && lastQuery.page);

  searchMetaEl.innerHTML = `
    <span>
      ${showBackBtn ? '<button type="button" id="back-to-search-btn" class="btn-back">← Назад к поиску</button>' : ''}
      Найдено объявлений: ${count}. Уникальных рекламодателей: ${Object.keys(volume_by_page).length}.
    ${payload.vertical_seed_keywords_used ? ` Слово не вводили — искали по набору слов «${escapeHtml(payload.vertical_seed_keywords_used.join(', '))}» для вертикали «${vInfo ? vInfo.label : ''}».` : ''}
    ${payload.multi_keywords_used ? ` Искали по любому из слов: «${escapeHtml(payload.multi_keywords_used.join(', '))}».` : ''}
    ${payload.all_verticals_used ? ' Слово не вводили — показан срез сразу по всем нишам (без привязки к одной вертикали).' : ''}
    ${payload.fb_library_url ? ` <a href="${escapeHtml(payload.fb_library_url)}" target="_blank" rel="noopener" class="fb-lib-link">Открыть в FB Ad Library ↗</a>` : ''}</span>
    <span class="fb-note">${escapeHtml(payload.note || '')}</span>
  `;
  const backBtn = document.getElementById('back-to-search-btn');
  if (backBtn) backBtn.addEventListener('click', goBackToPreviousSearch);

  resultsEl.innerHTML = ads.map((ad) => `
    <div class="creative-card" data-creative='${escapeHtml(JSON.stringify(ad))}'>
      <div class="thumb-wrap">${thumbHtml(ad)}</div>
      <div class="card-top">
        ${vInfo ? `<span class="v-badge" style="background:${vInfo.color}">${vInfo.label}</span>` : '<span></span>'}
        <div class="platforms">${(ad.platforms || []).slice(0, 3).map((p) => `<span>${escapeHtml(p)}</span>`).join('')}</div>
      </div>
      <div class="page-name-row">
        <button type="button" class="page-link" title="Показать все найденные креативы этой страницы">${escapeHtml(ad.page_name || 'Без названия')}</button>
        ${ad.page_id ? `<button type="button" class="page-link-newtab" title="Открыть все креативы этой страницы в новой вкладке">↗</button>` : ''}
      </div>
      <div class="badge">Креативов у страницы (в этой выдаче): ${volume_by_page[ad.page_name || ad.page_id] || 1}</div>
      <div class="creative-text">${escapeHtml(ad.creative_text || ad.link_title || 'Текст креатива недоступен')}</div>
      <div class="meta-row">
        <span>Запуск: ${formatDate(ad.launch_date)}</span>
        <span class="running-days">${ad.running_days != null ? ad.running_days + ' дн.' : '—'}</span>
      </div>
      <div class="status-row">
        <span class="status-pill ${ad.is_active ? 'active' : 'stopped'}">${ad.is_active ? '🟢 Активна' : '⏹ Остановлена'}</span>
        <span>${ad.stop_date ? 'до ' + formatDate(ad.stop_date) : ''}</span>
      </div>
      <div class="actions">
        <button class="preview-btn">🔍 Превью</button>
        <a href="${ad.snapshot_url || '#'}" target="_blank" rel="noopener">Открыть в FB</a>
        <button class="fav-btn">⭐ В избранное</button>
      </div>
    </div>
  `).join('');

  resultsEl.querySelectorAll('.page-link').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const card = e.target.closest('.creative-card');
      const ad = JSON.parse(card.dataset.creative);
      if (!ad.page_id) { alert('У этого объявления нет ID страницы от Facebook.'); return; }
      searchByPage(ad.page_id, ad.page_name);
    });
  });

  resultsEl.querySelectorAll('.page-link-newtab').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const card = e.target.closest('.creative-card');
      const ad = JSON.parse(card.dataset.creative);
      searchByPage(ad.page_id, ad.page_name, { newTab: true });
    });
  });

  resultsEl.querySelectorAll('.preview-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const card = e.target.closest('.creative-card');
      const ad = JSON.parse(card.dataset.creative);
      openPreview(ad);
    });
  });

  resultsEl.querySelectorAll('.thumb-wrap').forEach((el) => {
    el.addEventListener('click', (e) => {
      const card = e.target.closest('.creative-card');
      const ad = JSON.parse(card.dataset.creative);
      openPreview(ad);
    });
    el.addEventListener('mouseenter', () => {
      const video = el.querySelector('video');
      if (video) video.play().catch(() => {});
    });
    el.addEventListener('mouseleave', () => {
      const video = el.querySelector('video');
      if (video) { video.pause(); video.currentTime = 0; }
    });
  });

  resultsEl.querySelectorAll('.fav-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const card = e.target.closest('.creative-card');
      const ad = JSON.parse(card.dataset.creative);
      try {
        await API.addFavorite({
          fb_ad_id: ad.id,
          page_name: ad.page_name,
          snapshot_url: ad.snapshot_url,
          ad_creation_time: ad.launch_date,
          raw: ad,
          vertical: activeVertical || null,
        });
        btn.textContent = '✅ Добавлено';
        btn.classList.add('is-fav');
        loadFavorites();
      } catch (err) {
        btn.textContent = err.message.includes('избранном') ? 'Уже в избранном' : 'Ошибка';
      }
    });
  });
}

function previewMediaHtml(ad) {
  if (ad.media_type === 'video' && ad.video_url) {
    const poster = ad.thumbnail_url ? ` poster="${escapeHtml(ad.thumbnail_url)}"` : '';
    return `<video src="${escapeHtml(ad.video_url)}"${poster} controls playsinline style="width:100%;border-radius:8px;margin-bottom:12px;max-height:480px;background:#000"></video>`;
  }
  if (ad.thumbnail_url) {
    return `<img src="${escapeHtml(ad.thumbnail_url)}" alt="" style="width:100%;border-radius:8px;margin-bottom:12px;max-height:480px;object-fit:contain;background:#000" />`;
  }
  return '';
}

function openPreview(ad) {
  const vInfo = activeVertical ? verticalInfo(activeVertical) : null;
  document.getElementById('preview-body').innerHTML = `
    ${previewMediaHtml(ad)}
    ${vInfo ? `<span class="v-badge" style="background:${vInfo.color}">${vInfo.label}</span>` : ''}
    <div class="page-name">${escapeHtml(ad.page_name || 'Без названия')}</div>
    <div class="creative-text">${escapeHtml(ad.creative_text || ad.link_title || 'Текст креатива недоступен')}</div>
    ${ad.link_description ? `<div class="creative-text">${escapeHtml(ad.link_description)}</div>` : ''}
    <div class="meta-row">
      <span>Запуск: ${formatDate(ad.launch_date)}</span>
      <span class="running-days">${ad.running_days != null ? ad.running_days + ' дн.' : '—'}</span>
    </div>
    <div class="status-row" style="margin-bottom:10px">
      <span class="status-pill ${ad.is_active ? 'active' : 'stopped'}">${ad.is_active ? '🟢 Активна' : '⏹ Остановлена'}</span>
      <span>${ad.stop_date ? 'Остановлена: ' + formatDate(ad.stop_date) : ''}</span>
    </div>
    <div class="platforms">${(ad.platforms || []).map((p) => `<span>${escapeHtml(p)}</span>`).join('')}</div>
    <div class="actions" style="margin-top:14px">
      <a href="${ad.snapshot_url || '#'}" target="_blank" rel="noopener">Открыть оригинал в Facebook</a>
      ${ad.page_id ? `
        <button type="button" id="preview-page-btn">📄 Все креативы этой страницы</button>
        <button type="button" id="preview-page-newtab-btn">↗ В новой вкладке</button>
      ` : ''}
    </div>
  `;
  const pageBtn = document.getElementById('preview-page-btn');
  if (pageBtn) {
    pageBtn.addEventListener('click', () => {
      document.getElementById('preview-modal').classList.add('hidden');
      searchByPage(ad.page_id, ad.page_name);
    });
  }
  const pageNewTabBtn = document.getElementById('preview-page-newtab-btn');
  if (pageNewTabBtn) {
    pageNewTabBtn.addEventListener('click', () => {
      searchByPage(ad.page_id, ad.page_name, { newTab: true });
    });
  }
  document.getElementById('preview-modal').classList.remove('hidden');
}
document.getElementById('preview-close').addEventListener('click', () => {
  document.getElementById('preview-modal').classList.add('hidden');
});
document.getElementById('preview-modal').addEventListener('click', (e) => {
  if (e.target.id === 'preview-modal') e.target.classList.add('hidden');
});

let lastQuery = null;
let lastResults = null;
// Запоминаем состояние поиска ДО перехода "все креативы этой страницы", чтобы можно
// было вернуться к нему одной кнопкой, не переcобирая фильтры заново.
let previousQuery = null;
let previousResults = null;

function sortAds(ads, volumeByPage, sortMode) {
  const list = [...ads];
  const volumeOf = (ad) => volumeByPage[ad.page_name || ad.page_id] || 0;
  switch (sortMode) {
    case 'date_asc':
      return list.sort((a, b) => new Date(a.launch_date || 0) - new Date(b.launch_date || 0));
    case 'running_desc':
      return list.sort((a, b) => (b.running_days ?? -1) - (a.running_days ?? -1));
    case 'volume_desc':
      return list.sort((a, b) => volumeOf(b) - volumeOf(a));
    case 'date_desc':
    default:
      return list.sort((a, b) => new Date(b.launch_date || 0) - new Date(a.launch_date || 0));
  }
}

searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('search-form-error');
  errEl.textContent = '';

  let q = document.getElementById('search-q').value.trim();
  const page = document.getElementById('search-page').value.trim();
  let usedAllVerticals = false;

  if (!q && !page) {
    if (activeVertical === null) {
      // Выбрано "Все" и ключевое слово не ввели — ищем сразу по всем нишам и склеиваем
      // результат (у Facebook API нет режима "вообще без фильтров и без привязки к слову").
      usedAllVerticals = true;
    } else {
      // Выбрана конкретная вертикаль без своего слова — сервер сам подставит целый набор
      // анкорных слов этой ниши (не одно "casino", а весь список) и склеит результаты.
      const vInfo = verticalInfo(activeVertical);
      if (!vInfo || !vInfo.hasSeedKeywords) {
        errEl.textContent = 'У вертикали "Другое" нет типовых слов для автоподбора — укажи ключевое слово, fan page, или выбери "Все"/другую вертикаль.';
        return;
      }
    }
  }

  const active = document.getElementById('search-active').checked;
  const dateFrom = document.getElementById('search-date-from').value || null;
  const dateTo = document.getElementById('search-date-to').value || null;
  const sort = document.getElementById('search-sort').value;
  const mediaTypeInput = document.querySelector('input[name="media-type"]:checked');
  const mediaType = mediaTypeInput ? mediaTypeInput.value : 'all';
  lastQuery = { q, page, countries: [...selectedCountries], active, vertical: activeVertical, dateFrom, dateTo, sort, allVerticals: usedAllVerticals, mediaType };

  resultsEl.innerHTML = '<div class="empty-state">Ищем…</div>';
  try {
    const data = await API.searchAds(lastQuery);
    lastResults = data;
    data.ads = sortAds(data.ads || [], data.volume_by_page || {}, sort);
    renderAds(data);
  } catch (err) {
    resultsEl.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
});

document.getElementById('search-sort').addEventListener('change', () => {
  if (!lastResults) return;
  const sort = document.getElementById('search-sort').value;
  lastQuery.sort = sort;
  lastResults.ads = sortAds(lastResults.ads || [], lastResults.volume_by_page || {}, sort);
  renderAds(lastResults);
});

// Клик по названию страницы объявления — показывает все найденные у неё креативы
// (поиск view_all_page_id вместо ключевого слова). newTab=true открывает это в новой
// вкладке (по ссылке с ?page=...), ничего не трогая в текущей.
function searchByPage(pageId, pageName, { newTab = false } = {}) {
  if (newTab) {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('page', pageId);
    if (pageName) url.searchParams.set('pageName', pageName);
    window.open(url.toString(), '_blank', 'noopener');
    return;
  }
  // Запоминаем, откуда пришли, чтобы кнопка "Назад" могла восстановить этот поиск.
  if (lastQuery) {
    previousQuery = { ...lastQuery };
    previousResults = lastResults;
  }
  document.getElementById('search-q').value = '';
  document.getElementById('search-page').value = pageId;
  document.getElementById('search-form-error').textContent = '';
  searchForm.requestSubmit();
}

// Кнопка "Назад к поиску" — восстанавливает состояние формы и результаты, которые были
// до перехода на "все креативы этой страницы", без повторного похода на сервер.
function goBackToPreviousSearch() {
  if (!previousQuery) return;
  applyQueryToForm(previousQuery);
  lastQuery = previousQuery;
  lastResults = previousResults;
  previousQuery = null;
  previousResults = null;
  if (lastResults) {
    renderAds(lastResults);
  } else {
    searchForm.requestSubmit();
  }
}

// --- Модалка "Сохранить поиск" (вместо нативного prompt()) ---
const saveModal = document.getElementById('save-search-modal');
document.getElementById('save-search-btn').addEventListener('click', () => {
  if (!lastQuery || (!lastQuery.q && !lastQuery.page)) {
    alert('Сначала выполни поиск.');
    return;
  }
  document.getElementById('save-search-label').value = lastQuery.q || lastQuery.page;
  populateVerticalSelect(document.getElementById('save-search-vertical'), lastQuery.vertical);
  saveModal.classList.remove('hidden');
});
document.getElementById('save-search-cancel').addEventListener('click', () => saveModal.classList.add('hidden'));
saveModal.addEventListener('click', (e) => { if (e.target === saveModal) saveModal.classList.add('hidden'); });
document.getElementById('save-search-confirm').addEventListener('click', async () => {
  const label = document.getElementById('save-search-label').value.trim();
  if (!label) return;
  const vertical = document.getElementById('save-search-vertical').value || null;
  await API.saveSearch(label, { ...lastQuery, vertical });
  saveModal.classList.add('hidden');
  loadSavedSearches();
});

function vDotHtml(verticalId) {
  const v = verticalId ? verticalInfo(verticalId) : null;
  return v ? `<span class="v-dot" style="background:${v.color}"></span>` : '';
}

// Заполняет форму полями сохранённого/предыдущего запроса (без самого запроса к API —
// вызывающий код сам решает, нужно ли сразу искать или просто показать уже готовый результат).
function applyQueryToForm(qp) {
  document.getElementById('search-q').value = qp.q || '';
  document.getElementById('search-page').value = qp.page || '';
  document.getElementById('search-date-from').value = qp.dateFrom || '';
  document.getElementById('search-date-to').value = qp.dateTo || '';
  document.getElementById('search-sort').value = qp.sort || 'date_desc';
  setSelectedCountries(qp.countries || (qp.country ? [qp.country] : ['US']));
  document.getElementById('search-active').checked = qp.active;
  const mediaRadio = document.querySelector(`input[name="media-type"][value="${qp.mediaType || 'all'}"]`);
  if (mediaRadio) mediaRadio.checked = true;
  activeVertical = qp.vertical || null;
  renderVerticalPickers();
}

// --- Сохранённые поиски ---
async function loadSavedSearches() {
  const listEl = document.getElementById('saved-list');
  try {
    const items = await API.getSavedSearches();
    updateStat('stat-saved', items.length);
    if (items.length === 0) {
      listEl.innerHTML = '<li style="opacity:.6">Пока пусто</li>';
      return;
    }
    listEl.innerHTML = items.map((it) => `
      <li data-id="${it.id}">
        <span class="run-saved">${vDotHtml(it.query_params.vertical)}${escapeHtml(it.label)}</span>
        <button class="del-saved">✕</button>
      </li>
    `).join('');

    listEl.querySelectorAll('.run-saved').forEach((el, idx) => {
      el.addEventListener('click', () => {
        applyQueryToForm(items[idx].query_params);
        searchForm.requestSubmit();
      });
    });
    listEl.querySelectorAll('.del-saved').forEach((el, idx) => {
      el.addEventListener('click', async () => {
        await API.deleteSavedSearch(items[idx].id);
        loadSavedSearches();
      });
    });
  } catch (err) {
    listEl.innerHTML = '';
  }
}

// --- Избранное ---
async function loadFavorites() {
  const listEl = document.getElementById('fav-list');
  try {
    const items = await API.getFavorites();
    updateStat('stat-favs', items.length);
    if (items.length === 0) {
      listEl.innerHTML = '<li style="opacity:.6">Пока пусто</li>';
      return;
    }
    listEl.innerHTML = items.map((it) => `
      <li data-id="${escapeHtml(it.fb_ad_id)}">
        <a class="run-fav" href="${it.snapshot_url || '#'}" target="_blank" rel="noopener">${vDotHtml(it.vertical)}${escapeHtml(it.page_name || it.fb_ad_id)}</a>
        <button class="del-fav">✕</button>
      </li>
    `).join('');
    listEl.querySelectorAll('.del-fav').forEach((el) => {
      el.addEventListener('click', async (e) => {
        const id = e.target.closest('li').dataset.id;
        await API.removeFavorite(id);
        loadFavorites();
      });
    });
  } catch (err) {
    listEl.innerHTML = '';
  }
}

// --- Старт ---
if (API.getToken()) {
  showDashboard();
} else {
  showAuth();
}
initGoogleSignIn();
