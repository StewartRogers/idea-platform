/* ===== API helpers ===== */
async function _parseError(r) {
  try { return (await r.json()).error || r.statusText; } catch { return r.statusText || 'Request failed'; }
}
const api = {
  async get(url) {
    let r;
    try { r = await fetch(url); } catch { throw new Error('Could not connect to the server. Please check your connection.'); }
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  },
  async post(url, body) {
    let r;
    try { r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); } catch { throw new Error('Could not connect to the server. Please check your connection.'); }
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  },
  async put(url, body) {
    let r;
    try { r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); } catch { throw new Error('Could not connect to the server. Please check your connection.'); }
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  },
  async del(url) {
    let r;
    try { r = await fetch(url, { method: 'DELETE' }); } catch { throw new Error('Could not connect to the server. Please check your connection.'); }
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }
};

/* ===== Modal loading state ===== */
function setModalLoading(loading) {
  document.querySelectorAll('#modal-body button').forEach(b => { b.disabled = loading; });
}

/* ===== Modal ===== */
const modal = {
  overlay: null, titleEl: null, bodyEl: null, closeBtn: null,
  init() {
    this.overlay = document.getElementById('modal-overlay');
    this.titleEl = document.getElementById('modal-title');
    this.bodyEl = document.getElementById('modal-body');
    this.closeBtn = document.getElementById('modal-close');
    this.closeBtn.addEventListener('click', () => this.hide());
    this.overlay.addEventListener('click', e => { if (e.target === this.overlay) this.hide(); });
  },
  show(title, html, onMount) {
    this.titleEl.textContent = title;
    this.bodyEl.innerHTML = html;
    this.overlay.hidden = false;
    if (onMount) onMount(this.bodyEl);
  },
  hide() { this.overlay.hidden = true; this.bodyEl.innerHTML = ''; }
};

/* ===== Utilities ===== */
function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function formatDate(dt) {
  if (!dt) return '';
  const d = new Date(dt + (dt.endsWith('Z') ? '' : 'Z'));
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function render(html) {
  document.getElementById('app').innerHTML = html;
}

/* ===== Auth ===== */
let currentUser = null;
function isAuth() { return !!currentUser; }

async function checkAuth() {
  try { currentUser = await api.get('/api/auth/me'); } catch { currentUser = null; }
  updateHeaderAuth();
}

function updateHeaderAuth() {
  const el = document.getElementById('header-auth');
  if (!el) return;
  if (currentUser) {
    el.innerHTML = `<span class="util-link user-email">${esc(currentUser.email)}</span><button class="util-link" onclick="authLogout()">Log out</button>`;
  } else {
    el.innerHTML = `<a href="#" class="util-link btn-login" onclick="showAuthModal();return false">Log in</a>`;
  }
}

function showAuthModal(defaultTab = 'login') {
  modal.show('Welcome', `
    <div class="auth-tabs">
      <button class="auth-tab ${defaultTab === 'login' ? 'active' : ''}" id="tab-login" onclick="switchAuthTab('login')">Log in</button>
      <button class="auth-tab ${defaultTab === 'register' ? 'active' : ''}" id="tab-register" onclick="switchAuthTab('register')">Create account</button>
    </div>
    <div id="auth-login-form" ${defaultTab !== 'login' ? 'hidden' : ''}>
      <div class="form-group">
        <label for="auth-email">Email</label>
        <input id="auth-email" class="form-control" type="email" placeholder="you@example.com" autofocus>
      </div>
      <div class="form-group">
        <label for="auth-password">Password</label>
        <input id="auth-password" class="form-control" type="password" placeholder="••••••••">
      </div>
      <div id="auth-error" class="auth-error" hidden></div>
      <div class="form-actions">
        <button class="btn btn-ghost" onclick="modal.hide()">Cancel</button>
        <button class="btn btn-primary" onclick="authLogin()">Log in</button>
      </div>
    </div>
    <div id="auth-register-form" ${defaultTab !== 'register' ? 'hidden' : ''}>
      <div class="form-group">
        <label for="auth-reg-email">Email</label>
        <input id="auth-reg-email" class="form-control" type="email" placeholder="you@example.com">
      </div>
      <div class="form-group">
        <label for="auth-reg-password">Password</label>
        <input id="auth-reg-password" class="form-control" type="password" placeholder="Min. 8 characters">
      </div>
      <div id="auth-reg-error" class="auth-error" hidden></div>
      <div class="form-actions">
        <button class="btn btn-ghost" onclick="modal.hide()">Cancel</button>
        <button class="btn btn-primary" onclick="authRegister()">Create account</button>
      </div>
    </div>`, body => {
    body.querySelectorAll('input').forEach(inp => inp.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      document.getElementById('auth-login-form').hidden ? authRegister() : authLogin();
    }));
  });
}

function switchAuthTab(tab) {
  document.getElementById('auth-login-form').hidden = tab !== 'login';
  document.getElementById('auth-register-form').hidden = tab !== 'register';
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
}

async function authLogin() {
  const email = document.getElementById('auth-email')?.value?.trim();
  const password = document.getElementById('auth-password')?.value;
  const errEl = document.getElementById('auth-error');
  errEl.hidden = true;
  setModalLoading(true);
  try {
    currentUser = await api.post('/api/auth/login', { email, password });
    modal.hide();
    updateHeaderAuth();
    route();
  } catch (e) { setModalLoading(false); errEl.textContent = e.message; errEl.hidden = false; }
}

async function authRegister() {
  const email = document.getElementById('auth-reg-email')?.value?.trim();
  const password = document.getElementById('auth-reg-password')?.value;
  const errEl = document.getElementById('auth-reg-error');
  errEl.hidden = true;
  setModalLoading(true);
  try {
    currentUser = await api.post('/api/auth/register', { email, password });
    modal.hide();
    updateHeaderAuth();
    route();
  } catch (e) { setModalLoading(false); errEl.textContent = e.message; errEl.hidden = false; }
}

async function authLogout() {
  try { await api.post('/api/auth/logout', {}); } catch {}
  currentUser = null;
  updateHeaderAuth();
  route();
}

/* ===== Breadcrumb ===== */
function setBreadcrumb(items) {
  const bar = document.getElementById('breadcrumb-bar');
  const el = document.getElementById('breadcrumb');
  if (!items || items.length === 0) { bar.hidden = true; return; }
  bar.hidden = false;
  el.innerHTML = items.map((item, i) => {
    const isLast = i === items.length - 1;
    if (isLast) return `<span class="current">${esc(item.label)}</span>`;
    return `<a href="${item.href}">${esc(item.label)}</a><span class="sep">/</span>`;
  }).join('');
}

/* ===== Nav tab state ===== */
function setActiveNav(view) {
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
}

/* ===== View state ===== */
let viewMode = localStorage.getItem('viewMode') || 'card'; // 'card' | 'list'

function toggleViewMode(mode) {
  viewMode = mode;
  localStorage.setItem('viewMode', mode);
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  // Re-render current list area
  const grid = document.querySelector('.card-grid');
  const list = document.querySelector('.list-view');
  if (mode === 'card') {
    if (grid) grid.style.display = '';
    if (list) list.style.display = 'none';
  } else {
    if (grid) grid.style.display = 'none';
    if (list) list.style.display = '';
  }
}

function viewToggleHtml() {
  return `
    <div class="view-toggle">
      <button class="view-btn ${viewMode === 'card' ? 'active' : ''}" data-mode="card" title="Card view" onclick="toggleViewMode('card')">⊞</button>
      <button class="view-btn ${viewMode === 'list' ? 'active' : ''}" data-mode="list" title="List view" onclick="toggleViewMode('list')">≡</button>
    </div>`;
}

/* ===== Router ===== */
const routes = [
  { pattern: /^#\/idea\/(\d+)$/, view: viewIdea },
  { pattern: /^#\/challenge\/(\d+)$/, view: viewChallenge },
  { pattern: /^#\/focus\/(\d+)$/, view: viewFocusArea },
  { pattern: /^\/?$|^#\/?$/, view: viewHome }
];

function route() {
  const hash = location.hash || '#/';
  for (const r of routes) {
    const m = hash.match(r.pattern);
    if (m) { r.view(...m.slice(1)); return; }
  }
  viewHome();
}

window.addEventListener('hashchange', route);
document.addEventListener('DOMContentLoaded', () => { modal.init(); checkAuth().then(() => route()); });

/* ===== Top-level view switcher (nav tabs) ===== */
async function switchView(view) {
  setActiveNav(view);
  setBreadcrumb([]);
  if (view === 'focus-areas') {
    location.hash = '#/';
  } else if (view === 'challenges') {
    await viewAllChallenges();
  } else if (view === 'ideas') {
    await viewAllIdeas();
  }
}

/* ===== View: Home — Focus Areas ===== */
async function viewHome() {
  setActiveNav('focus-areas');
  setBreadcrumb([]);
  render('<div class="loading">Loading…</div>');
  try {
    const areas = await api.get('/api/focus-areas');

    const cardItems = areas.map(a => `
      <div class="card" onclick="location.hash='#/focus/${a.id}'">
        <div class="card-icon">🎯</div>
        <div class="card-title">${esc(a.name)}</div>
        <div class="card-desc">${esc(a.description) || '<em style="color:var(--text-subtle)">No description</em>'}</div>
        <div class="card-meta">
          <span class="badge">${a.challenge_count} challenge${a.challenge_count !== 1 ? 's' : ''}</span>
          <span>${formatDate(a.created_at)}</span>
        </div>
      </div>`).join('');

    const listItems = areas.map(a => `
      <div class="list-item" onclick="location.hash='#/focus/${a.id}'">
        <div class="list-item-icon">🎯</div>
        <div class="list-item-body">
          <div class="list-item-title">${esc(a.name)}</div>
          <div class="list-item-desc">${esc(a.description) || 'No description'}</div>
        </div>
        <div class="list-item-meta">
          <span class="badge">${a.challenge_count} challenge${a.challenge_count !== 1 ? 's' : ''}</span>
          <span>${formatDate(a.created_at)}</span>
        </div>
        <div class="list-item-arrow">›</div>
      </div>`).join('');

    const emptyState = `
      <div class="empty-state">
        <span class="icon">🎯</span>
        <h3>No focus areas yet</h3>
        <p>Focus areas help you organise challenges around a theme or goal.</p>
        ${isAuth() ? '<button class="btn btn-primary" onclick="showCreateFocusArea()">+ Create your first Focus Area</button>' : '<p>Log in to add focus areas.</p>'}
      </div>`;

    render(`
      <div class="page-header">
        <div class="page-header-text">
          <h1>Focus Areas</h1>
          <div class="subtitle">Organise your challenges by theme or goal</div>
        </div>
        <div class="page-header-actions">
          ${isAuth() && areas.length ? '<button class="btn btn-primary" onclick="showCreateFocusArea()">+ New Focus Area</button>' : ''}
        </div>
      </div>
      ${areas.length ? `
      <div class="toolbar">
        <div class="toolbar-filters"></div>
        ${viewToggleHtml()}
      </div>
      <div class="card-grid" ${viewMode === 'list' ? 'style="display:none"' : ''}>${cardItems}</div>
      <div class="list-view" ${viewMode === 'card' ? 'style="display:none"' : ''}>${listItems}</div>
      ` : emptyState}`);
  } catch (e) {
    render(`<div class="empty-state"><h3>Something went wrong</h3><p>${esc(e.message)}</p></div>`);
  }
}

function showCreateFocusArea() {
  modal.show('New Focus Area', `
    <div class="form-group">
      <label for="fa-name">Name *</label>
      <input id="fa-name" class="form-control" placeholder="e.g. Customer Experience" autofocus>
    </div>
    <div class="form-group">
      <label for="fa-desc">Description</label>
      <textarea id="fa-desc" class="form-control" placeholder="What is this focus area about?"></textarea>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="modal.hide()">Cancel</button>
      <button class="btn btn-primary" onclick="createFocusArea()">Create</button>
    </div>`, body => {
    body.querySelector('input').addEventListener('keydown', e => { if (e.key === 'Enter') createFocusArea(); });
  });
}

async function createFocusArea() {
  const name = document.getElementById('fa-name')?.value?.trim();
  const description = document.getElementById('fa-desc')?.value?.trim();
  if (!name) { alert('Name is required'); return; }
  setModalLoading(true);
  try {
    const fa = await api.post('/api/focus-areas', { name, description });
    modal.hide();
    location.hash = `#/focus/${fa.id}`;
  } catch (e) { setModalLoading(false); alert(e.message); }
}

/* ===== View: All Challenges ===== */
async function viewAllChallenges(filterFocusAreaId = '') {
  setActiveNav('challenges');
  setBreadcrumb([]);
  render('<div class="loading">Loading…</div>');
  try {
    const areas = await api.get('/api/focus-areas');
    // Fetch challenges for each focus area
    const allChallenges = [];
    await Promise.all(areas.map(async a => {
      const chs = await api.get(`/api/focus-areas/${a.id}/challenges`);
      chs.forEach(c => allChallenges.push({ ...c, focus_area_name: a.name, focus_area_id: a.id }));
    }));

    const filtered = filterFocusAreaId
      ? allChallenges.filter(c => String(c.focus_area_id) === String(filterFocusAreaId))
      : allChallenges;

    const faOptions = areas.map(a => `<option value="${a.id}" ${String(a.id) === String(filterFocusAreaId) ? 'selected' : ''}>${esc(a.name)}</option>`).join('');

    const cardItems = filtered.map(c => `
      <div class="card" onclick="location.hash='#/challenge/${c.id}'">
        <div class="card-icon">🔍</div>
        <div class="card-title">${esc(c.name)}</div>
        <div class="card-desc">${esc(c.description) || '<em style="color:var(--text-subtle)">No description</em>'}</div>
        <div class="card-meta">
          <span class="badge badge-neutral">${esc(c.focus_area_name)}</span>
          <span class="badge">${c.idea_count ?? 0} idea${(c.idea_count ?? 0) !== 1 ? 's' : ''}</span>
        </div>
      </div>`).join('');

    const listItems = filtered.map(c => `
      <div class="list-item" onclick="location.hash='#/challenge/${c.id}'">
        <div class="list-item-icon">🔍</div>
        <div class="list-item-body">
          <div class="list-item-title">${esc(c.name)}</div>
          <div class="list-item-desc">${esc(c.description) || 'No description'}</div>
        </div>
        <div class="list-item-meta">
          <span class="badge badge-neutral">${esc(c.focus_area_name)}</span>
          <span class="badge">${c.idea_count ?? 0} idea${(c.idea_count ?? 0) !== 1 ? 's' : ''}</span>
        </div>
        <div class="list-item-arrow">›</div>
      </div>`).join('');

    const emptyState = `
      <div class="empty-state">
        <span class="icon">🔍</span>
        <h3>No challenges found</h3>
        <p>${filterFocusAreaId ? 'No challenges in this focus area yet.' : 'Create a focus area first, then add challenges.'}</p>
      </div>`;

    render(`
      <div class="page-header">
        <div class="page-header-text">
          <h1>Challenges</h1>
          <div class="subtitle">${filtered.length} challenge${filtered.length !== 1 ? 's' : ''} across all focus areas</div>
        </div>
      </div>
      <div class="toolbar">
        <div class="toolbar-filters">
          <select class="filter-select" onchange="viewAllChallenges(this.value)">
            <option value="">All Focus Areas</option>
            ${faOptions}
          </select>
        </div>
        ${viewToggleHtml()}
      </div>
      ${filtered.length ? `
        <div class="card-grid" ${viewMode === 'list' ? 'style="display:none"' : ''}>${cardItems}</div>
        <div class="list-view" ${viewMode === 'card' ? 'style="display:none"' : ''}>${listItems}</div>
      ` : emptyState}`);
  } catch (e) {
    render(`<div class="empty-state"><h3>Something went wrong</h3><p>${esc(e.message)}</p></div>`);
  }
}

/* ===== View: All Ideas ===== */
async function viewAllIdeas(filterFocusAreaId = '', filterChallengeId = '') {
  setActiveNav('ideas');
  setBreadcrumb([]);
  render('<div class="loading">Loading…</div>');
  try {
    const areas = await api.get('/api/focus-areas');
    const allChallenges = [];
    await Promise.all(areas.map(async a => {
      const chs = await api.get(`/api/focus-areas/${a.id}/challenges`);
      chs.forEach(c => allChallenges.push({ ...c, focus_area_name: a.name, focus_area_id: a.id }));
    }));

    const challengesToSearch = filterFocusAreaId
      ? allChallenges.filter(c => String(c.focus_area_id) === String(filterFocusAreaId))
      : allChallenges;

    const allIdeas = [];
    await Promise.all(challengesToSearch.map(async c => {
      const ideas = await api.get(`/api/challenges/${c.id}/ideas`);
      ideas.forEach(i => allIdeas.push({ ...i, challenge_name: c.name, challenge_id: c.id, focus_area_name: c.focus_area_name, focus_area_id: c.focus_area_id }));
    }));

    const filtered = filterChallengeId
      ? allIdeas.filter(i => String(i.challenge_id) === String(filterChallengeId))
      : allIdeas;

    const faOptions = areas.map(a => `<option value="${a.id}" ${String(a.id) === String(filterFocusAreaId) ? 'selected' : ''}>${esc(a.name)}</option>`).join('');
    const chOptions = challengesToSearch.map(c => `<option value="${c.id}" ${String(c.id) === String(filterChallengeId) ? 'selected' : ''}>${esc(c.name)}</option>`).join('');

    const cardItems = filtered.map(i => `
      <div class="card" onclick="location.hash='#/idea/${i.id}'">
        <div class="card-icon">💡</div>
        <div class="card-title">${i.name ? esc(i.name) : '<em style="color:var(--text-subtle)">Untitled idea</em>'}</div>
        <div class="card-desc">${esc(i.description) || '<em style="color:var(--text-subtle)">No description yet</em>'}</div>
        <div class="card-meta">
          <span class="badge badge-neutral">${esc(i.challenge_name)}</span>
          <span>${formatDate(i.updated_at || i.created_at)}</span>
        </div>
      </div>`).join('');

    const listItems = filtered.map(i => `
      <div class="list-item" onclick="location.hash='#/idea/${i.id}'">
        <div class="list-item-icon">💡</div>
        <div class="list-item-body">
          <div class="list-item-title ${!i.name ? 'empty' : ''}">${i.name ? esc(i.name) : 'Untitled idea'}</div>
          <div class="list-item-desc">${esc(i.description) || 'No description yet'}</div>
        </div>
        <div class="list-item-meta">
          <span class="badge badge-neutral">${esc(i.challenge_name)}</span>
          <span>${formatDate(i.updated_at || i.created_at)}</span>
        </div>
        <div class="list-item-arrow">›</div>
      </div>`).join('');

    const emptyState = `
      <div class="empty-state">
        <span class="icon">💡</span>
        <h3>No ideas found</h3>
        <p>${filterChallengeId || filterFocusAreaId ? 'No ideas match your current filter.' : 'Open a challenge and add ideas to get started.'}</p>
      </div>`;

    render(`
      <div class="page-header">
        <div class="page-header-text">
          <h1>Ideas</h1>
          <div class="subtitle">${filtered.length} idea${filtered.length !== 1 ? 's' : ''} across all challenges</div>
        </div>
      </div>
      <div class="toolbar">
        <div class="toolbar-filters">
          <select class="filter-select" onchange="viewAllIdeas(this.value, '')">
            <option value="">All Focus Areas</option>
            ${faOptions}
          </select>
          <select class="filter-select" onchange="viewAllIdeas('${esc(filterFocusAreaId)}', this.value)">
            <option value="">All Challenges</option>
            ${chOptions}
          </select>
        </div>
        ${viewToggleHtml()}
      </div>
      ${filtered.length ? `
        <div class="card-grid" ${viewMode === 'list' ? 'style="display:none"' : ''}>${cardItems}</div>
        <div class="list-view" ${viewMode === 'card' ? 'style="display:none"' : ''}>${listItems}</div>
      ` : emptyState}`);
  } catch (e) {
    render(`<div class="empty-state"><h3>Something went wrong</h3><p>${esc(e.message)}</p></div>`);
  }
}

/* ===== View: Focus Area detail ===== */
async function viewFocusArea(id) {
  setActiveNav('focus-areas');
  render('<div class="loading">Loading…</div>');
  try {
    const [fa, challenges] = await Promise.all([
      api.get(`/api/focus-areas/${id}`),
      api.get(`/api/focus-areas/${id}/challenges`)
    ]);

    setBreadcrumb([
      { label: 'Focus Areas', href: '#/' },
      { label: fa.name, href: `#/focus/${id}` }
    ]);

    const cardItems = challenges.map(c => `
      <div class="card" onclick="location.hash='#/challenge/${c.id}'">
        <div class="card-icon">🔍</div>
        <div class="card-title">${esc(c.name)}</div>
        <div class="card-desc">${esc(c.description) || '<em style="color:var(--text-subtle)">No description</em>'}</div>
        <div class="card-meta">
          <span class="badge">${c.idea_count} idea${c.idea_count !== 1 ? 's' : ''}</span>
          <span>${formatDate(c.created_at)}</span>
        </div>
      </div>`).join('');

    const listItems = challenges.map(c => `
      <div class="list-item" onclick="location.hash='#/challenge/${c.id}'">
        <div class="list-item-icon">🔍</div>
        <div class="list-item-body">
          <div class="list-item-title">${esc(c.name)}</div>
          <div class="list-item-desc">${esc(c.description) || 'No description'}</div>
        </div>
        <div class="list-item-meta">
          <span class="badge">${c.idea_count} idea${c.idea_count !== 1 ? 's' : ''}</span>
          <span>${formatDate(c.created_at)}</span>
        </div>
        <div class="list-item-arrow">›</div>
      </div>`).join('');

    const emptyState = `
      <div class="empty-state" style="grid-column:1/-1">
        <span class="icon">🔍</span>
        <h3>No challenges yet</h3>
        <p>Challenges are problems or opportunities to tackle within this focus area.</p>
        ${isAuth() ? `<button class="btn btn-primary" onclick="showCreateChallenge(${id})">+ Add a Challenge</button>` : ''}
      </div>`;

    render(`
      <div class="page-header">
        <div class="page-header-text">
          <h1>${esc(fa.name)}</h1>
          ${fa.description ? `<div class="subtitle">${esc(fa.description)}</div>` : ''}
        </div>
        <div class="page-header-actions">
          ${isAuth() ? `
            <button class="btn btn-ghost btn-sm" onclick="showEditFocusArea(${id})">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteFocusArea(${id})">Delete</button>
            ${challenges.length ? `<button class="btn btn-primary" onclick="showCreateChallenge(${id})">+ New Challenge</button>` : ''}
          ` : ''}
        </div>
      </div>
      <div class="section">
        <div class="section-header">
          <h2>Challenges <span class="section-count">${challenges.length}</span></h2>
          ${challenges.length ? `<div class="toolbar" style="margin:0">${viewToggleHtml()}</div>` : ''}
        </div>
        ${challenges.length ? `
          <div class="card-grid" ${viewMode === 'list' ? 'style="display:none"' : ''}>${cardItems}</div>
          <div class="list-view" ${viewMode === 'card' ? 'style="display:none"' : ''}>${listItems}</div>
        ` : emptyState}
      </div>`);
  } catch (e) {
    render(`<div class="empty-state"><h3>Something went wrong</h3><p>${esc(e.message)}</p></div>`);
  }
}

function showEditFocusArea(id) {
  api.get(`/api/focus-areas/${id}`).then(fa => {
    modal.show('Edit Focus Area', `
      <div class="form-group">
        <label for="fa-name">Name *</label>
        <input id="fa-name" class="form-control" value="${esc(fa.name)}">
      </div>
      <div class="form-group">
        <label for="fa-desc">Description</label>
        <textarea id="fa-desc" class="form-control">${esc(fa.description)}</textarea>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" onclick="modal.hide()">Cancel</button>
        <button class="btn btn-primary" onclick="updateFocusArea(${id})">Save</button>
      </div>`);
  });
}

async function updateFocusArea(id) {
  const name = document.getElementById('fa-name')?.value?.trim();
  const description = document.getElementById('fa-desc')?.value?.trim();
  if (!name) { alert('Name is required'); return; }
  setModalLoading(true);
  try {
    await api.put(`/api/focus-areas/${id}`, { name, description });
    modal.hide();
    viewFocusArea(id);
  } catch (e) { setModalLoading(false); alert(e.message); }
}

async function deleteFocusArea(id) {
  if (!confirm('Delete this focus area and all its challenges and ideas?')) return;
  try {
    await api.del(`/api/focus-areas/${id}`);
    location.hash = '#/';
  } catch (e) { alert(e.message); }
}

function showCreateChallenge(focusAreaId) {
  modal.show('New Challenge', `
    <div class="form-group">
      <label for="ch-name">Name *</label>
      <input id="ch-name" class="form-control" placeholder="e.g. Reducing onboarding time" autofocus>
    </div>
    <div class="form-group">
      <label for="ch-desc">Description</label>
      <textarea id="ch-desc" class="form-control" placeholder="Describe the challenge or opportunity…"></textarea>
    </div>
    <div class="form-actions">
      <button class="btn btn-ghost" onclick="modal.hide()">Cancel</button>
      <button class="btn btn-primary" onclick="createChallenge(${focusAreaId})">Create</button>
    </div>`, body => {
    body.querySelector('input').addEventListener('keydown', e => { if (e.key === 'Enter') createChallenge(focusAreaId); });
  });
}

async function createChallenge(focusAreaId) {
  const name = document.getElementById('ch-name')?.value?.trim();
  const description = document.getElementById('ch-desc')?.value?.trim();
  if (!name) { alert('Name is required'); return; }
  setModalLoading(true);
  try {
    const ch = await api.post(`/api/focus-areas/${focusAreaId}/challenges`, { name, description });
    modal.hide();
    location.hash = `#/challenge/${ch.id}`;
  } catch (e) { setModalLoading(false); alert(e.message); }
}

/* ===== View: Challenge detail ===== */
async function viewChallenge(id) {
  setActiveNav('challenges');
  render('<div class="loading">Loading…</div>');
  try {
    const [ch, ideas] = await Promise.all([
      api.get(`/api/challenges/${id}`),
      api.get(`/api/challenges/${id}/ideas`)
    ]);

    setBreadcrumb([
      { label: 'Focus Areas', href: '#/' },
      { label: ch.focus_area_name, href: `#/focus/${ch.focus_area_id}` },
      { label: ch.name, href: `#/challenge/${id}` }
    ]);

    const cardItems = ideas.map(idea => `
      <div class="card" onclick="location.hash='#/idea/${idea.id}'">
        <div class="card-icon">💡</div>
        <div class="card-title ${!idea.name ? 'empty' : ''}">${idea.name ? esc(idea.name) : '<em style="color:var(--text-subtle)">Untitled idea</em>'}</div>
        <div class="card-desc">${esc(idea.description) || '<em style="color:var(--text-subtle)">No description yet — open to start coaching</em>'}</div>
        <div class="card-meta">
          <span>${formatDate(idea.updated_at || idea.created_at)}</span>
        </div>
      </div>`).join('');

    const listItems = ideas.map(idea => `
      <div class="list-item" onclick="location.hash='#/idea/${idea.id}'">
        <div class="list-item-icon">💡</div>
        <div class="list-item-body">
          <div class="list-item-title ${!idea.name ? 'empty' : ''}">${idea.name ? esc(idea.name) : 'Untitled idea'}</div>
          <div class="list-item-desc">${idea.description ? esc(idea.description) : 'No description yet — open to start coaching'}</div>
        </div>
        <div class="list-item-meta">
          <span>${formatDate(idea.updated_at || idea.created_at)}</span>
        </div>
        <div class="list-item-arrow">›</div>
      </div>`).join('');

    const emptyState = `
      <div class="empty-state">
        <span class="icon">💡</span>
        <h3>No ideas yet</h3>
        <p>Add an idea and the AI coach will guide you through developing it.</p>
        ${isAuth() ? `<button class="btn btn-primary" onclick="createIdea(${id}, this)">+ Add First Idea</button>` : ''}
      </div>`;

    render(`
      <div class="page-header">
        <div class="page-header-text">
          <h1>${esc(ch.name)}</h1>
          ${ch.description ? `<div class="subtitle">${esc(ch.description)}</div>` : ''}
        </div>
        <div class="page-header-actions">
          ${isAuth() ? `
            <button class="btn btn-ghost btn-sm" onclick="showEditChallenge(${id})">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteChallenge(${id}, ${ch.focus_area_id})">Delete</button>
            ${ideas.length ? `<button class="btn btn-primary" onclick="createIdea(${id}, this)">+ New Idea</button>` : ''}
          ` : ''}
        </div>
      </div>
      <div class="section">
        <div class="section-header">
          <h2>Ideas <span class="section-count">${ideas.length}</span></h2>
          ${ideas.length ? `<div class="toolbar" style="margin:0">${viewToggleHtml()}</div>` : ''}
        </div>
        ${ideas.length ? `
          <div class="card-grid" ${viewMode === 'list' ? 'style="display:none"' : ''}>${cardItems}</div>
          <div class="list-view" ${viewMode === 'card' ? 'style="display:none"' : ''}>${listItems}</div>
        ` : emptyState}
      </div>`);
  } catch (e) {
    render(`<div class="empty-state"><h3>Something went wrong</h3><p>${esc(e.message)}</p></div>`);
  }
}

function showEditChallenge(id) {
  api.get(`/api/challenges/${id}`).then(ch => {
    modal.show('Edit Challenge', `
      <div class="form-group">
        <label for="ch-name">Name *</label>
        <input id="ch-name" class="form-control" value="${esc(ch.name)}">
      </div>
      <div class="form-group">
        <label for="ch-desc">Description</label>
        <textarea id="ch-desc" class="form-control">${esc(ch.description)}</textarea>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" onclick="modal.hide()">Cancel</button>
        <button class="btn btn-primary" onclick="updateChallenge(${id})">Save</button>
      </div>`);
  });
}

async function updateChallenge(id) {
  const name = document.getElementById('ch-name')?.value?.trim();
  const description = document.getElementById('ch-desc')?.value?.trim();
  if (!name) { alert('Name is required'); return; }
  setModalLoading(true);
  try {
    await api.put(`/api/challenges/${id}`, { name, description });
    modal.hide();
    viewChallenge(id);
  } catch (e) { setModalLoading(false); alert(e.message); }
}

async function deleteChallenge(id, focusAreaId) {
  if (!confirm('Delete this challenge and all its ideas?')) return;
  try {
    await api.del(`/api/challenges/${id}`);
    location.hash = `#/focus/${focusAreaId}`;
  } catch (e) { alert(e.message); }
}

async function createIdea(challengeId, btn) {
  if (btn) btn.disabled = true;
  try {
    const idea = await api.post(`/api/challenges/${challengeId}/ideas`, {});
    location.hash = `#/idea/${idea.id}`;
  } catch (e) { if (btn) btn.disabled = false; alert(e.message); }
}

/* ===== View: Idea Coach ===== */
const STAGES = [
  { key: 'name',          label: 'Idea Name',         placeholder: 'A concise, memorable name…' },
  { key: 'description',   label: 'Description',        placeholder: "What is this idea and what's the vision behind it?" },
  { key: 'problem_what',  label: 'Problem — What',     placeholder: 'What specific problem does it solve?' },
  { key: 'problem_who',   label: 'Problem — Who',      placeholder: 'Who is affected by this problem?' },
  { key: 'problem_scale', label: 'Problem — Scale',    placeholder: 'How widespread or significant is this?' },
  { key: 'benefits',      label: 'Potential Benefits', placeholder: 'What positive outcomes would this create?' },
];

let coachState = { ideaId: null, streaming: false, stage: 0, ideaData: {} };

function computeInitialStage(idea) {
  for (let i = 0; i < STAGES.length; i++) {
    if (!idea[STAGES[i].key]?.trim()) return i;
  }
  return STAGES.length;
}

async function viewIdea(id) {
  setActiveNav('ideas');
  render('<div class="loading">Loading…</div>');
  try {
    const idea = await api.get(`/api/ideas/${id}`);

    setBreadcrumb([
      { label: 'Focus Areas', href: '#/' },
      { label: idea.focus_area_name, href: `#/focus/${idea.focus_area_id}` },
      { label: idea.challenge_name, href: `#/challenge/${idea.challenge_id}` },
      { label: idea.name || 'New Idea', href: `#/idea/${id}` }
    ]);

    const initialStage = computeInitialStage(idea);
    coachState = { ideaId: parseInt(id), streaming: false, stage: initialStage, ideaData: { ...idea } };

    render(`
      <div class="page-header" style="margin-bottom:1rem">
        <div class="page-header-text">
          <h1>${idea.name ? esc(idea.name) : 'New Idea'}</h1>
          <div class="subtitle">Challenge: <strong>${esc(idea.challenge_name)}</strong></div>
        </div>
        <div class="page-header-actions">
          ${isAuth() ? `<button class="btn btn-danger btn-sm" onclick="deleteIdea(${id}, ${idea.challenge_id})">Delete Idea</button>` : ''}
        </div>
      </div>
      <div class="coach-layout">
        <div class="idea-panel">
          <div class="idea-panel-header">
            <span>📋 Idea Summary</span>
            <span id="stage-counter" class="stage-counter">${initialStage < STAGES.length ? 'Step ' + (initialStage + 1) + ' of ' + STAGES.length : 'Complete!'}</span>
          </div>
          <div class="stage-bar"><div class="stage-bar-fill" id="stage-bar-fill" style="width:${Math.min(initialStage / STAGES.length * 100, 100)}%"></div></div>
          <div class="idea-panel-body" id="idea-panel-body"></div>
        </div>
        ${isAuth() ? `
        <div class="chat-panel">
          <div class="chat-header">
            <span class="coach-icon">🤖</span>
            <div class="chat-header-text">
              <h2>Idea Coach</h2>
              <div id="coach-stage-label" class="coach-stage-label">${initialStage < STAGES.length ? 'Exploring: ' + STAGES[initialStage].label : 'Idea complete!'}</div>
            </div>
          </div>
          <div class="chat-messages" id="chat-messages"></div>
          <div class="chat-input-area">
            <textarea id="chat-input" class="chat-input" placeholder="Type your response…" rows="1"></textarea>
            <button id="chat-send" class="chat-send" title="Send (Enter)">➤</button>
          </div>
        </div>
        ` : `
        <div class="readonly-banner">
          <span>Log in to develop this idea with the AI coach</span>
          <button class="btn btn-primary btn-sm" onclick="showAuthModal()">Log in</button>
        </div>`}
      </div>`);

    renderIdeaPanel(coachState.ideaData, initialStage, id);

    if (isAuth()) {
      const messagesEl = document.getElementById('chat-messages');
      if (idea.conversation && idea.conversation.length > 0) {
        idea.conversation.forEach(msg => appendMessage(msg.role, msg.content));
        messagesEl.scrollTop = messagesEl.scrollHeight;
      } else {
        await sendCoachMessage(id, null);
      }
      const input = document.getElementById('chat-input');
      const sendBtn = document.getElementById('chat-send');
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(id); }
      });
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      });
      sendBtn.addEventListener('click', () => handleSend(id));
    }
  } catch (e) {
    render(`<div class="empty-state"><h3>Something went wrong</h3><p>${esc(e.message)}</p></div>`);
  }
}

function renderIdeaPanel(ideaData, stage, ideaId) {
  const body = document.getElementById('idea-panel-body');
  if (!body) return;

  const counter = document.getElementById('stage-counter');
  const fill = document.getElementById('stage-bar-fill');

  if (!isAuth()) {
    // Read-only: show all fields as text, no editing
    const filledCount = STAGES.filter(s => ideaData[s.key]?.trim()).length;
    if (counter) counter.textContent = `${filledCount} of ${STAGES.length} complete`;
    if (fill) fill.style.width = `${filledCount / STAGES.length * 100}%`;
    let html = '<div class="fields-done-grid">';
    STAGES.forEach(s => {
      const val = ideaData[s.key] || '';
      html += `<div class="field-done">
        <div class="field-done-header"><span class="field-done-label">${s.label}</span></div>
        <div class="field-done-value">${val ? esc(val) : '<em>Not yet captured</em>'}</div>
      </div>`;
    });
    html += '</div>';
    body.innerHTML = html;
    return;
  }

  if (counter) counter.textContent = stage < STAGES.length ? `Step ${stage + 1} of ${STAGES.length}` : 'Complete!';
  if (fill) fill.style.width = `${Math.min(stage / STAGES.length * 100, 100)}%`;

  let html = '';

  if (stage > 0) {
    html += `<div class="fields-done-grid">`;
    STAGES.slice(0, stage).forEach((s, i) => {
      const val = ideaData[s.key] || '';
      html += `<div class="field-done" onclick="jumpToStage(${i}, ${ideaId})">
        <div class="field-done-header">
          <span class="field-done-label">✓ ${s.label}</span>
          <span class="field-edit-hint">edit</span>
        </div>
        <div class="field-done-value">${val ? esc(val) : '<em>Empty</em>'}</div>
      </div>`;
    });
    html += `</div>`;
  }

  if (stage < STAGES.length) {
    const s = STAGES[stage];
    const val = ideaData[s.key] || '';
    const rows = s.key === 'description' ? 5 : 3;
    html += `<div class="field-current">
      <div class="field-current-label">📝 ${s.label}</div>
      <textarea id="field-${s.key}" class="field-current-textarea" rows="${rows}" placeholder="${s.placeholder}">${esc(val)}</textarea>
      <button class="btn btn-primary btn-sm field-next-btn" onclick="advanceStage(${ideaId})">
        ${stage === STAGES.length - 1 ? '✓ Complete idea' : 'Looks good, next topic →'}
      </button>
    </div>`;
    const upcoming = STAGES.slice(stage + 1);
    if (upcoming.length) {
      html += `<div class="field-upcoming-group">${upcoming.map(s => `<span class="field-upcoming-pill">${s.label}</span>`).join('')}</div>`;
    }
  } else {
    html += `<div class="stage-complete">
      <div class="stage-complete-icon">🎉</div>
      <div class="stage-complete-text">Idea fully developed!</div>
      <button class="btn btn-ghost btn-sm" onclick="saveIdeaFields(${ideaId})">💾 Save</button>
    </div>`;
  }

  body.innerHTML = html;

  if (stage < STAGES.length) {
    const el = document.getElementById(`field-${STAGES[stage].key}`);
    if (el) el.addEventListener('change', () => saveIdeaFields(ideaId));
  }
}

function updateChatStageLabel(stage) {
  const el = document.getElementById('coach-stage-label');
  if (el) el.textContent = stage < STAGES.length ? `Exploring: ${STAGES[stage].label}` : 'Idea complete!';
}

async function advanceStage(ideaId) {
  const currentKey = STAGES[coachState.stage]?.key;
  if (currentKey) {
    const el = document.getElementById(`field-${currentKey}`);
    if (el) coachState.ideaData[currentKey] = el.value.trim();
  }
  await saveIdeaFields(ideaId);
  coachState.stage = Math.min(coachState.stage + 1, STAGES.length);
  renderIdeaPanel(coachState.ideaData, coachState.stage, ideaId);
  updateChatStageLabel(coachState.stage);
  if (coachState.stage < STAGES.length) {
    await sendCoachMessage(ideaId, `That looks good! Let's move on to: ${STAGES[coachState.stage].label}`);
  } else {
    await sendCoachMessage(ideaId, `I'm happy with all the sections. Please give me an encouraging summary of my fully developed idea.`);
  }
}

function jumpToStage(stage, ideaId) {
  const currentKey = STAGES[coachState.stage]?.key;
  if (currentKey) {
    const el = document.getElementById(`field-${currentKey}`);
    if (el) coachState.ideaData[currentKey] = el.value.trim();
  }
  coachState.stage = stage;
  renderIdeaPanel(coachState.ideaData, stage, ideaId);
  updateChatStageLabel(stage);
  document.getElementById('chat-input')?.focus();
}

function appendMessage(role, content, isStreaming = false) {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  const div = document.createElement('div');
  div.className = `message ${role}${isStreaming ? ' message-typing' : ''}`;
  div.id = isStreaming ? 'streaming-msg' : '';
  div.innerHTML = `
    <div class="message-avatar">${role === 'assistant' ? '🤖' : '👤'}</div>
    <div class="message-bubble">${esc(content)}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function updateStreamingMessage(text) {
  const el = document.getElementById('streaming-msg');
  if (!el) return;
  el.querySelector('.message-bubble').textContent = text;
  const container = document.getElementById('chat-messages');
  if (container) container.scrollTop = container.scrollHeight;
}

function finalizeStreamingMessage() {
  const el = document.getElementById('streaming-msg');
  if (el) { el.id = ''; el.classList.remove('message-typing'); }
}

function setInputEnabled(enabled) {
  const input = document.getElementById('chat-input');
  const btn = document.getElementById('chat-send');
  if (input) input.disabled = !enabled;
  if (btn) btn.disabled = !enabled;
}

async function handleSend(ideaId) {
  if (coachState.streaming) return;
  const input = document.getElementById('chat-input');
  const text = input?.value?.trim();
  if (!text) return;
  input.value = '';
  input.style.height = 'auto';
  appendMessage('user', text);
  await sendCoachMessage(ideaId, text);
}

async function sendCoachMessage(ideaId, message) {
  coachState.streaming = true;
  setInputEnabled(false);
  appendMessage('assistant', '', true);
  let accumulated = '';
  try {
    const resp = await fetch(`/api/ideas/${ideaId}/coach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message || '', stage: coachState.stage })
    });
    if (!resp.ok) throw new Error('Coach request failed');

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(line.slice(6));
          if (event.type === 'token') { accumulated += event.text; updateStreamingMessage(accumulated); }
          else if (event.type === 'done') { finalizeStreamingMessage(); }
          else if (event.type === 'error') { throw new Error(event.message); }
        } catch (parseErr) { /* skip malformed */ }
      }
    }
    finalizeStreamingMessage();
    triggerExtract(ideaId);
  } catch (e) {
    finalizeStreamingMessage();
    updateStreamingMessage(`(Error: ${e.message})`);
    console.error('Coach error:', e);
  } finally {
    coachState.streaming = false;
    setInputEnabled(true);
    document.getElementById('chat-input')?.focus();
  }
}

async function triggerExtract(ideaId) {
  try {
    const fields = await api.post(`/api/ideas/${ideaId}/extract`, {});
    coachState.ideaData = { ...coachState.ideaData, ...fields };
    renderIdeaPanel(coachState.ideaData, coachState.stage, ideaId);
    if (fields.name) {
      const h1 = document.querySelector('.page-header-text h1');
      if (h1) h1.textContent = fields.name;
    }
  } catch (e) { console.warn('Field extraction failed:', e.message); }
}

async function saveIdeaFields(id) {
  const body = {};
  STAGES.forEach(s => {
    const el = document.getElementById(`field-${s.key}`);
    body[s.key] = el ? el.value.trim() : (coachState.ideaData[s.key] || '');
  });
  try { await api.put(`/api/ideas/${id}`, body); }
  catch (e) { console.warn('Save failed:', e.message); }
}

async function deleteIdea(id, challengeId) {
  if (!confirm('Delete this idea and its entire conversation?')) return;
  try {
    await api.del(`/api/ideas/${id}`);
    location.hash = `#/challenge/${challengeId}`;
  } catch (e) { alert(e.message); }
}
