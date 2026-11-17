// --- Переключение вкладок авторизации ---
const tabBtns = document.querySelectorAll('.tab-btn');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    if (btn.dataset.tab === 'login') {
      loginForm.classList.remove('hidden');
      registerForm.classList.add('hidden');
    } else {
      registerForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
    }
  });
});

const authView = document.getElementById('auth-view');
const dashboardView = document.getElementById('dashboard-view');
const nav = document.getElementById('nav');

function renderNav() {
  nav.innerHTML = '';
  if (API.getToken()) {
    const logoutBtn = document.createElement('button');
    logoutBtn.textContent = 'Выйти';
    logoutBtn.onclick = () => {
      API.clearToken();
      showAuth();
    };
    nav.appendChild(logoutBtn);
  }
}

function showAuth() {
  authView.classList.remove('hidden');
  dashboardView.classList.add('hidden');
  renderNav();
}

function showDashboard() {
  authView.classList.add('hidden');
  dashboardView.classList.remove('hidden');
  renderNav();
  loadSavedSearches();
  loadFavorites();
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
    errEl.textContent = err.message;
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('register-error');
  errEl.textContent = '';
  const fd = new FormData(registerForm);
  try {
    const data = await API.register(fd.get('email'), fd.get('password'));
    API.setToken(data.token);
    showDashboard();
  } catch (err) {
    errEl.textContent = err.message;
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

function renderAds(payload) {
  const { ads, count, volume_by_page } = payload;
  if (!ads || ads.length === 0) {
    resultsEl.innerHTML = '<div class="empty-state">Ничего не найдено. Попробуй другой запрос или страну.</div>';
    searchMetaEl.textContent = '';
    return;
  }

  searchMetaEl.textContent = `Найдено объявлений: ${count}. Уникальных рекламодателей: ${Object.keys(volume_by_page).length}.`;

  resultsEl.innerHTML = ads.map((ad) => `
    <div class="ad-card" data-ad='${escapeHtml(JSON.stringify(ad))}'>
      <div class="page-name">${escapeHtml(ad.page_name || 'Без названия')}</div>
      <div class="badge">Креативов у страницы: ${volume_by_page[ad.page_name || ad.page_id] || 1}</div>
      <div class="creative-text">${escapeHtml(ad.creative_text || ad.link_title || 'Текст креатива недоступен')}</div>
      <div class="meta-row">
        <span>Запуск: ${formatDate(ad.launch_date)}</span>
        <span class="running-days">${ad.running_days != null ? ad.running_days + ' дн.' : '—'}</span>
      </div>
      <div class="actions">
        <a href="${ad.snapshot_url || '#'}" target="_blank" rel="noopener">Открыть в FB</a>
        <button class="fav-btn">⭐ В избранное</button>
      </div>
    </div>
  `).join('');

  resultsEl.querySelectorAll('.fav-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const card = e.target.closest('.ad-card');
      const ad = JSON.parse(card.dataset.ad);
      try {
        await API.addFavorite({
          fb_ad_id: ad.id,
          page_name: ad.page_name,
          snapshot_url: ad.snapshot_url,
          ad_creation_time: ad.launch_date,
          raw: ad,
        });
        btn.textContent = '✅ Добавлено';
        loadFavorites();
      } catch (err) {
        btn.textContent = err.message.includes('избранном') ? 'Уже в избранном' : 'Ошибка';
      }
    });
  });
}

let lastQuery = null;

searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = document.getElementById('search-q').value.trim();
  const country = document.getElementById('search-country').value;
  const active = document.getElementById('search-active').checked;
  lastQuery = { q, country, active };

  resultsEl.innerHTML = '<div class="empty-state">Ищем…</div>';
  try {
    const data = await API.searchAds(lastQuery);
    renderAds(data);
  } catch (err) {
    resultsEl.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
});

document.getElementById('save-search-btn').addEventListener('click', async () => {
  if (!lastQuery || !lastQuery.q) {
    alert('Сначала выполни поиск.');
    return;
  }
  const label = prompt('Название для сохранённого поиска:', lastQuery.q);
  if (!label) return;
  await API.saveSearch(label, lastQuery);
  loadSavedSearches();
});

// --- Сохранённые поиски ---
async function loadSavedSearches() {
  const listEl = document.getElementById('saved-list');
  try {
    const items = await API.getSavedSearches();
    if (items.length === 0) {
      listEl.innerHTML = '<li style="opacity:.6">Пока пусто</li>';
      return;
    }
    listEl.innerHTML = items.map((it) => `
      <li data-id="${it.id}">
        <span class="run-saved">${escapeHtml(it.label)}</span>
        <button class="del-saved">✕</button>
      </li>
    `).join('');

    listEl.querySelectorAll('.run-saved').forEach((el, idx) => {
      el.addEventListener('click', () => {
        const qp = items[idx].query_params;
        document.getElementById('search-q').value = qp.q;
        document.getElementById('search-country').value = qp.country;
        document.getElementById('search-active').checked = qp.active;
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
    if (items.length === 0) {
      listEl.innerHTML = '<li style="opacity:.6">Пока пусто</li>';
      return;
    }
    listEl.innerHTML = items.map((it) => `
      <li data-id="${escapeHtml(it.fb_ad_id)}">
        <a class="run-fav" href="${it.snapshot_url || '#'}" target="_blank" rel="noopener">${escapeHtml(it.page_name || it.fb_ad_id)}</a>
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
