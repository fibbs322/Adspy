// Простой клиент к нашему backend API.
const API = {
  base: '/api',

  getToken() {
    return localStorage.getItem('adspy_token');
  },
  setToken(t) {
    localStorage.setItem('adspy_token', t);
  },
  clearToken() {
    localStorage.removeItem('adspy_token');
  },

  async request(path, { method = 'GET', body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(this.base + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    let data = null;
    try { data = await res.json(); } catch (_) {}

    if (!res.ok) {
      const err = new Error((data && data.error) || `Ошибка запроса (${res.status})`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  },

  register(email, password) {
    return this.request('/auth/register', { method: 'POST', body: { email, password } });
  },
  login(email, password) {
    return this.request('/auth/login', { method: 'POST', body: { email, password } });
  },
  googleLogin(credential) {
    return this.request('/auth/google', { method: 'POST', body: { credential } });
  },
  verifyEmail(email, code) {
    return this.request('/auth/verify-email', { method: 'POST', body: { email, code } });
  },
  resendCode(email) {
    return this.request('/auth/resend-code', { method: 'POST', body: { email } });
  },
  getConfig() {
    return this.request('/config');
  },
  getMe() {
    return this.request('/auth/me');
  },

  adminListUsers() { return this.request('/admin/users'); },
  adminSetAccess(id, active) {
    return this.request(`/admin/users/${id}/access`, { method: 'POST', body: { active } });
  },

  searchAds({ q, countries, active, vertical, page, dateFrom, dateTo, allVerticals }) {
    const params = new URLSearchParams({ active });
    if (q) params.set('q', q);
    if (page) params.set('page', page);
    params.set('countries', (countries || []).join(','));
    if (vertical) params.set('vertical', vertical);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (allVerticals) params.set('allVerticals', '1');
    return this.request(`/ads/search?${params.toString()}`);
  },

  getSavedSearches() { return this.request('/ads/saved-searches'); },
  saveSearch(label, query_params) {
    return this.request('/ads/saved-searches', { method: 'POST', body: { label, query_params } });
  },
  deleteSavedSearch(id) { return this.request(`/ads/saved-searches/${id}`, { method: 'DELETE' }); },

  getFavorites() { return this.request('/ads/favorites'); },
  addFavorite(payload) { return this.request('/ads/favorites', { method: 'POST', body: payload }); },
  removeFavorite(fbAdId) { return this.request(`/ads/favorites/${fbAdId}`, { method: 'DELETE' }); },
};
