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

// Расширенный пул стран (раньше было 10 — мало по сравнению с конкурентами типа Тайвера).
// Коды — стандартный ISO 3166-1 alpha-2, который и ожидает параметр country у Facebook
// Ad Library. Список не исчерпывающий (у Facebook их около 200), но покрывает все основные
// гео для баинга: Северная Америка, вся Европа, СНГ, Латам, Азия, Ближний Восток, Африка, Океания.
const COUNTRIES = [
  // Северная Америка
  { code: 'US', label: 'США', region: 'na' },
  { code: 'CA', label: 'Канада', region: 'na' },
  { code: 'MX', label: 'Мексика', region: 'na' },
  // СНГ и соседи
  { code: 'UA', label: 'Украина', region: 'cis' },
  { code: 'PL', label: 'Польша', region: 'cis' },
  { code: 'MD', label: 'Молдова', region: 'cis' },
  { code: 'GE', label: 'Грузия', region: 'cis' },
  { code: 'AM', label: 'Армения', region: 'cis' },
  { code: 'AZ', label: 'Азербайджан', region: 'cis' },
  { code: 'KZ', label: 'Казахстан', region: 'cis' },
  { code: 'UZ', label: 'Узбекистан', region: 'cis' },
  { code: 'KG', label: 'Киргизия', region: 'cis' },
  // Европа
  { code: 'GB', label: 'Великобритания', region: 'europe' },
  { code: 'DE', label: 'Германия', region: 'europe' },
  { code: 'FR', label: 'Франция', region: 'europe' },
  { code: 'ES', label: 'Испания', region: 'europe' },
  { code: 'IT', label: 'Италия', region: 'europe' },
  { code: 'PT', label: 'Португалия', region: 'europe' },
  { code: 'NL', label: 'Нидерланды', region: 'europe' },
  { code: 'BE', label: 'Бельгия', region: 'europe' },
  { code: 'CH', label: 'Швейцария', region: 'europe' },
  { code: 'AT', label: 'Австрия', region: 'europe' },
  { code: 'SE', label: 'Швеция', region: 'europe' },
  { code: 'NO', label: 'Норвегия', region: 'europe' },
  { code: 'DK', label: 'Дания', region: 'europe' },
  { code: 'FI', label: 'Финляндия', region: 'europe' },
  { code: 'IE', label: 'Ирландия', region: 'europe' },
  { code: 'IS', label: 'Исландия', region: 'europe' },
  { code: 'CZ', label: 'Чехия', region: 'europe' },
  { code: 'SK', label: 'Словакия', region: 'europe' },
  { code: 'HU', label: 'Венгрия', region: 'europe' },
  { code: 'RO', label: 'Румыния', region: 'europe' },
  { code: 'BG', label: 'Болгария', region: 'europe' },
  { code: 'GR', label: 'Греция', region: 'europe' },
  { code: 'HR', label: 'Хорватия', region: 'europe' },
  { code: 'RS', label: 'Сербия', region: 'europe' },
  { code: 'SI', label: 'Словения', region: 'europe' },
  { code: 'LT', label: 'Литва', region: 'europe' },
  { code: 'LV', label: 'Латвия', region: 'europe' },
  { code: 'EE', label: 'Эстония', region: 'europe' },
  { code: 'CY', label: 'Кипр', region: 'europe' },
  { code: 'MT', label: 'Мальта', region: 'europe' },
  { code: 'LU', label: 'Люксембург', region: 'europe' },
  { code: 'AL', label: 'Албания', region: 'europe' },
  { code: 'BA', label: 'Босния и Герцеговина', region: 'europe' },
  { code: 'MK', label: 'Северная Македония', region: 'europe' },
  { code: 'ME', label: 'Черногория', region: 'europe' },
  // Ближний Восток
  { code: 'TR', label: 'Турция', region: 'mena' },
  { code: 'IL', label: 'Израиль', region: 'mena' },
  { code: 'AE', label: 'ОАЭ', region: 'mena' },
  { code: 'SA', label: 'Саудовская Аравия', region: 'mena' },
  { code: 'QA', label: 'Катар', region: 'mena' },
  { code: 'KW', label: 'Кувейт', region: 'mena' },
  { code: 'BH', label: 'Бахрейн', region: 'mena' },
  { code: 'OM', label: 'Оман', region: 'mena' },
  { code: 'JO', label: 'Иордания', region: 'mena' },
  { code: 'LB', label: 'Ливан', region: 'mena' },
  { code: 'EG', label: 'Египет', region: 'mena' },
  // Азия
  { code: 'IN', label: 'Индия', region: 'asia' },
  { code: 'PK', label: 'Пакистан', region: 'asia' },
  { code: 'BD', label: 'Бангладеш', region: 'asia' },
  { code: 'ID', label: 'Индонезия', region: 'asia' },
  { code: 'MY', label: 'Малайзия', region: 'asia' },
  { code: 'SG', label: 'Сингапур', region: 'asia' },
  { code: 'TH', label: 'Таиланд', region: 'asia' },
  { code: 'VN', label: 'Вьетнам', region: 'asia' },
  { code: 'PH', label: 'Филиппины', region: 'asia' },
  { code: 'JP', label: 'Япония', region: 'asia' },
  { code: 'KR', label: 'Южная Корея', region: 'asia' },
  { code: 'TW', label: 'Тайвань', region: 'asia' },
  { code: 'HK', label: 'Гонконг', region: 'asia' },
  { code: 'CN', label: 'Китай', region: 'asia' },
  { code: 'NP', label: 'Непал', region: 'asia' },
  { code: 'LK', label: 'Шри-Ланка', region: 'asia' },
  // Океания
  { code: 'AU', label: 'Австралия', region: 'oceania' },
  { code: 'NZ', label: 'Новая Зеландия', region: 'oceania' },
  // Латинская Америка
  { code: 'BR', label: 'Бразилия', region: 'latam' },
  { code: 'AR', label: 'Аргентина', region: 'latam' },
  { code: 'CL', label: 'Чили', region: 'latam' },
  { code: 'CO', label: 'Колумбия', region: 'latam' },
  { code: 'PE', label: 'Перу', region: 'latam' },
  { code: 'EC', label: 'Эквадор', region: 'latam' },
  { code: 'UY', label: 'Уругвай', region: 'latam' },
  { code: 'PY', label: 'Парагвай', region: 'latam' },
  { code: 'BO', label: 'Боливия', region: 'latam' },
  { code: 'VE', label: 'Венесуэла', region: 'latam' },
  { code: 'CR', label: 'Коста-Рика', region: 'latam' },
  { code: 'PA', label: 'Панама', region: 'latam' },
  { code: 'DO', label: 'Доминиканская Республика', region: 'latam' },
  // Африка
  { code: 'ZA', label: 'ЮАР', region: 'africa' },
  { code: 'NG', label: 'Нигерия', region: 'africa' },
  { code: 'KE', label: 'Кения', region: 'africa' },
  { code: 'GH', label: 'Гана', region: 'africa' },
  { code: 'MA', label: 'Марокко', region: 'africa' },
  { code: 'TN', label: 'Тунис', region: 'africa' },
  { code: 'DZ', label: 'Алжир', region: 'africa' },
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
// Список вырос с 10 до ~95 стран — прокручивать его целиком неудобно, поэтому добавили
// текстовый поиск по названию/коду сверху панели. Поле поиска рендерится один раз в
// renderCountryPanel(), а сам список чекбоксов перерисовывается отдельно в renderCountryList()
// при каждом вводе, чтобы фокус/курсор в поле поиска не сбрасывался на каждую букву.
let countrySearchTerm = '';

// Быстрые кнопки по регионам — выделяют одним кликом весь регион (а не страну за
// страной), поверх уже существующего текстового поиска и общего чекбокса "Все страны".
// Коды привязаны к полю region у каждой записи COUNTRIES (расставлено по комментариям
// секций выше: Европа/СНГ объединять не стали — СНГ исторически отдельная кнопка).
const REGION_PRESETS = [
  { key: 'europe', label: 'Европа' },
  { key: 'asia', label: 'Азия' },
  { key: 'latam', label: 'Латам' },
];

function renderCountryList() {
  const listEl = document.getElementById('country-list');
  if (!listEl) return;
  const term = countrySearchTerm.trim().toLowerCase();
  const filtered = term
    ? COUNTRIES.filter((c) => c.label.toLowerCase().includes(term) || c.code.toLowerCase().includes(term))
    : COUNTRIES;
  listEl.innerHTML = filtered.length
    ? filtered.map((c) => `<label><input type="checkbox" value="${c.code}" ${selectedCountries.includes(c.code) ? 'checked' : ''}/> ${c.label}</label>`).join('')
    : '<div class="country-empty">Ничего не найдено</div>';
  listEl.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (selectedCountries.includes('ALL')) selectedCountries = [];
      if (cb.checked) selectedCountries.push(cb.value);
      else selectedCountries = selectedCountries.filter((c) => c !== cb.value);
      if (selectedCountries.length === 0) selectedCountries = ['US'];
      renderAllCountryCheckbox();
      updateCountryToggleLabel();
    });
  });
}

function renderAllCountryCheckbox() {
  const allCb = document.getElementById('country-all-checkbox');
  if (allCb) allCb.checked = selectedCountries.includes('ALL');
}

function renderCountryPanel() {
  const panel = document.getElementById('country-panel');
  panel.innerHTML = `
    <input type="text" id="country-search" class="country-search" placeholder="Поиск страны…" value="${escapeHtml(countrySearchTerm)}" />
    <label><input type="checkbox" id="country-all-checkbox" value="ALL" ${selectedCountries.includes('ALL') ? 'checked' : ''}/> Все страны</label>
    <div class="region-presets">
      ${REGION_PRESETS.map((r) => `<button type="button" class="region-preset-btn" data-region="${r.key}">${r.label}</button>`).join('')}
    </div>
    <hr/>
    <div id="country-list"></div>
  `;
  document.getElementById('country-all-checkbox').addEventListener('change', (e) => {
    selectedCountries = e.target.checked ? ['ALL'] : ['US'];
    renderCountryList();
    updateCountryToggleLabel();
  });
  panel.querySelectorAll('.region-preset-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const codes = COUNTRIES.filter((c) => c.region === btn.dataset.region).map((c) => c.code);
      selectedCountries = codes.length ? codes : ['US'];
      renderAllCountryCheckbox();
      renderCountryList();
      updateCountryToggleLabel();
    });
  });
  const searchInput = document.getElementById('country-search');
  searchInput.addEventListener('input', () => {
    countrySearchTerm = searchInput.value;
    renderCountryList();
  });
  searchInput.addEventListener('click', (e) => e.stopPropagation());
  renderCountryList();
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

// Компактное форматирование чисел для карточки (1200 -> "1.2K", 2500000 -> "2.5M").
function formatCompactNumber(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

// Строка "👁 ~12.3K показов · 💰 ~$45 (оценка)" для карточки/превью. Это НЕ данные Facebook —
// Meta не публикует показы/бюджет для обычной рекламы, см. backend/routes/ads.js. Поэтому
// явно подписываем "оценка" и даём title с формулой, а не выдаём это за официальные цифры.
function estimateHtml(ad) {
  if (ad.estimated_impressions == null) return '';
  const tooltip = 'Прикидка, не данные Facebook: running_days × показов/день (задано в фильтре) × CPM по гео';
  return `<div class="estimate-row" title="${escapeHtml(tooltip)}">
    <span>👁 ~${formatCompactNumber(ad.estimated_impressions)} показов</span>
    <span>💰 ~$${ad.estimated_spend_usd != null ? formatCompactNumber(ad.estimated_spend_usd) : '—'}</span>
    <span class="estimate-tag">оценка</span>
  </div>`;
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
      ${estimateHtml(ad)}
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
    ${estimateHtml(ad)}
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
      closePreview();
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
// Закрытие превью не только прячет модалку, но и останавливает видео внутри неё — иначе
// звук/воспроизведение продолжались фоном после закрытия (видео же не удалялось из DOM).
function closePreview() {
  const modal = document.getElementById('preview-modal');
  modal.querySelectorAll('video').forEach((v) => {
    v.pause();
    v.currentTime = 0;
  });
  modal.classList.add('hidden');
}
document.getElementById('preview-close').addEventListener('click', closePreview);
document.getElementById('preview-modal').addEventListener('click', (e) => {
  if (e.target.id === 'preview-modal') closePreview();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !document.getElementById('preview-modal').classList.contains('hidden')) {
    closePreview();
  }
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
    case 'impressions_desc':
      // Карточки без оценки (estimated_impressions == null) всегда в конец, независимо
      // от направления сортировки — иначе в "сначала больше" они бы ложно лезли наверх.
      return list.sort((a, b) => (b.estimated_impressions ?? -Infinity) - (a.estimated_impressions ?? -Infinity));
    case 'impressions_asc':
      return list.sort((a, b) => (a.estimated_impressions ?? Infinity) - (b.estimated_impressions ?? Infinity));
    case 'active_first':
      // Активные объявления сначала (это факт из данных Facebook, а не фильтр из
      // чекбокса "только активные сейчас"), внутри каждой группы — сначала новые.
      return list.sort((a, b) => {
        const activeDiff = (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0);
        if (activeDiff !== 0) return activeDiff;
        return new Date(b.launch_date || 0) - new Date(a.launch_date || 0);
      });
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

  // Статус объявлений: active/inactive/all вместо старого чекбокса "только активные"
  // (у Facebook API active_status — это как раз три значения, а не булево).
  const activeStatusInput = document.querySelector('input[name="active-status"]:checked');
  const active = activeStatusInput ? activeStatusInput.value : 'active';
  const dateFrom = document.getElementById('search-date-from').value || null;
  const dateTo = document.getElementById('search-date-to').value || null;
  const sort = document.getElementById('search-sort').value;
  const mediaTypeInput = document.querySelector('input[name="media-type"]:checked');
  const mediaType = mediaTypeInput ? mediaTypeInput.value : 'all';
  const dailyImpressions = parseInt(document.getElementById('search-daily-impressions').value, 10) || 1000;
  lastQuery = { q, page, countries: [...selectedCountries], active, vertical: activeVertical, dateFrom, dateTo, sort, allVerticals: usedAllVerticals, mediaType, dailyImpressions };

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
  // Старые сохранённые поиски хранили active как true/false (чекбокс) — приводим к
  // новым трём значениям: true → active, false → all (раньше false означало "без
  // фильтра по статусу"), новые запросы уже хранят строку active/inactive/all напрямую.
  let activeStatusValue = qp.active;
  if (activeStatusValue === true || activeStatusValue === 'true') activeStatusValue = 'active';
  else if (activeStatusValue === false || activeStatusValue === 'false') activeStatusValue = 'all';
  else if (!activeStatusValue) activeStatusValue = 'active';
  const activeRadio = document.querySelector(`input[name="active-status"][value="${activeStatusValue}"]`);
  if (activeRadio) activeRadio.checked = true;
  const mediaRadio = document.querySelector(`input[name="media-type"][value="${qp.mediaType || 'all'}"]`);
  if (mediaRadio) mediaRadio.checked = true;
  document.getElementById('search-daily-impressions').value = qp.dailyImpressions || 1000;
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
