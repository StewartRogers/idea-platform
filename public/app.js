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
  if (document.getElementById('browse-ideas-content')) {
    // Browse pane re-renders its content per viewMode rather than toggling static DOM
    renderBrowseIdeas();
    return;
  }
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

/* ===== Command palette (⌘K) ===== */
let commandItems = [];
let commandItemsFiltered = [];
let commandSelectedIndex = 0;

async function buildCommandIndex() {
  const items = [];
  const areas = await api.get('/api/focus-areas');
  await Promise.all(areas.map(async fa => {
    items.push({ type: 'focusArea', title: fa.name, crumb: `${fa.challenge_count ?? 0} challenges`, ref: fa });
    const challenges = await api.get(`/api/focus-areas/${fa.id}/challenges`);
    await Promise.all(challenges.map(async ch => {
      items.push({ type: 'challenge', title: ch.name, crumb: `${fa.name} · ${ch.idea_count ?? 0} ideas`, ref: ch, faId: fa.id });
      const ideas = await api.get(`/api/challenges/${ch.id}/ideas`);
      ideas.forEach(idea => {
        items.push({ type: 'idea', title: idea.name || 'Untitled idea', crumb: `${fa.name} › ${ch.name}`, ref: idea });
      });
    }));
  }));
  return items;
}

function commandTypeIcon(type) {
  if (type === 'focusArea') return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l9 5-9 5-9-5 9-5z"/><path d="M3 12l9 5 9-5"/></svg>';
  if (type === 'challenge') return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>';
  return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a6 6 0 0 0-4 10.5c.6.55 1 1.4 1 2.3v.2h6v-.2c0-.9.4-1.75 1-2.3A6 6 0 0 0 12 2z"/></svg>';
}

function renderCommandResults(filter) {
  const commandResults = document.getElementById('command-results');
  const q = (filter || '').toLowerCase().trim();
  const filtered = q ? commandItems.filter(it => it.title.toLowerCase().includes(q) || it.crumb.toLowerCase().includes(q)) : commandItems;
  commandResults.innerHTML = '';
  commandItemsFiltered = filtered;

  if (filtered.length === 0) {
    commandResults.innerHTML = `<div class="command-empty">No matches for "${esc(filter)}"</div>`;
    return;
  }

  const groups = [['focusArea', 'Focus areas'], ['challenge', 'Challenges'], ['idea', 'Ideas']];
  let flatIndex = 0;
  groups.forEach(([type, label]) => {
    const groupItems = filtered.filter(it => it.type === type);
    if (groupItems.length === 0) return;
    const groupLabel = document.createElement('div');
    groupLabel.className = 'command-group-label';
    groupLabel.textContent = label;
    commandResults.appendChild(groupLabel);
    groupItems.forEach(item => {
      const row = document.createElement('button');
      row.className = 'command-row';
      row.dataset.index = flatIndex;
      row.innerHTML =
        `<span class="command-row-icon type-${item.type}">${commandTypeIcon(item.type)}</span>` +
        '<span class="command-row-body"><div class="command-row-title"></div><div class="command-row-crumb"></div></span>';
      row.querySelector('.command-row-title').textContent = item.title;
      row.querySelector('.command-row-crumb').textContent = item.crumb;
      row.addEventListener('mouseenter', () => setCommandSelection(parseInt(row.dataset.index, 10)));
      row.addEventListener('click', () => activateCommandItem(item));
      commandResults.appendChild(row);
      flatIndex++;
    });
  });
  setCommandSelection(0);
}

function setCommandSelection(idx) {
  commandSelectedIndex = idx;
  const commandResults = document.getElementById('command-results');
  commandResults.querySelectorAll('.command-row').forEach(r => r.classList.toggle('selected', parseInt(r.dataset.index, 10) === idx));
  const sel = commandResults.querySelector('.command-row.selected');
  if (sel) sel.scrollIntoView({ block: 'nearest' });
}

function activateCommandItem(item) {
  closeCommand();
  if (item.type === 'idea') location.hash = `#/idea/${item.ref.id}`;
  else if (item.type === 'challenge') location.hash = `#/challenge/${item.ref.id}`;
  else if (item.type === 'focusArea') location.hash = `#/focus/${item.ref.id}`;
}

async function openCommand() {
  const commandOverlay = document.getElementById('command-overlay');
  const commandInput = document.getElementById('command-input');
  const commandResults = document.getElementById('command-results');
  commandOverlay.classList.add('open');
  commandInput.value = '';
  commandItems = [];
  commandItemsFiltered = [];
  commandResults.innerHTML = '<div class="command-empty">Loading…</div>';
  setTimeout(() => commandInput.focus(), 10);
  try {
    commandItems = await buildCommandIndex();
    if (commandOverlay.classList.contains('open')) renderCommandResults(commandInput.value);
  } catch (e) { console.warn('Command index failed:', e.message); }
}

function closeCommand() {
  document.getElementById('command-overlay').classList.remove('open');
}

document.addEventListener('DOMContentLoaded', () => {
  const commandOverlay = document.getElementById('command-overlay');
  const commandInput = document.getElementById('command-input');
  commandOverlay.addEventListener('click', e => { if (e.target === commandOverlay) closeCommand(); });
  commandInput.addEventListener('input', () => renderCommandResults(commandInput.value));
  commandInput.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (commandItemsFiltered.length) setCommandSelection(Math.min(commandSelectedIndex + 1, commandItemsFiltered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (commandItemsFiltered.length) setCommandSelection(Math.max(commandSelectedIndex - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (commandItemsFiltered[commandSelectedIndex]) activateCommandItem(commandItemsFiltered[commandSelectedIndex]); }
    else if (e.key === 'Escape') { closeCommand(); }
  });
});
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCommand(); }
  else if (e.key === 'Escape') { closeCommand(); }
});

/* ===== Top-level view switcher (nav tabs) ===== */
async function switchView(view) {
  setActiveNav(view);
  setBreadcrumb([]);
  if (view === 'focus-areas') {
    location.hash = '#/';
  } else if (view === 'challenges') {
    await viewAllChallenges();
  } else if (view === 'ideas') {
    await viewBrowse();
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

/* ===== View: Browse (3-column focus area / challenge / ideas master-detail) ===== */
let browseState = { focusAreaId: null, challengeId: null, focusAreas: [], challenges: [] };

function ideaProgressCount(idea) {
  return ['problem_statement', 'value_proposition', 'hypothesis', 'pitch'].filter(k => idea[k]?.trim()).length;
}
function ideaRingHtml(idea, large) {
  const n = ideaProgressCount(idea);
  const pct = Math.round((n / 4) * 100);
  return `<span class="idea-ring${large ? ' lg' : ''}" style="--pct:${pct}"><span>${n}/4</span></span>`;
}
function ideaSnippet(idea) { return idea.pitch || idea.problem_statement || ''; }

async function viewBrowse() {
  setActiveNav('ideas');
  setBreadcrumb([]);
  render('<div class="loading">Loading…</div>');
  try {
    browseState.focusAreas = await api.get('/api/focus-areas');
    if (!browseState.focusAreaId && browseState.focusAreas.length) {
      browseState.focusAreaId = browseState.focusAreas[0].id;
    }
    render(`
      <div class="page-header" style="margin-bottom:1rem">
        <div class="page-header-text"><h1>Browse Ideas</h1></div>
      </div>
      <div class="browse-columns">
        <div class="browse-col col-focus">
          <div class="browse-col-search"><input type="text" id="col-fa-search" placeholder="Filter focus areas…"></div>
          <div class="browse-col-list" id="col-fa-list"></div>
        </div>
        <div class="browse-col col-challenge">
          <div class="browse-col-search"><input type="text" id="col-ch-search" placeholder="Filter challenges…"></div>
          <div class="browse-col-list" id="col-ch-list"></div>
        </div>
        <div class="browse-col col-ideas">
          <div class="browse-ideas-header">
            <span class="browse-ideas-crumb" id="browse-ideas-crumb">Ideas</span>
            <div class="browse-ideas-search"><input type="text" id="browse-search" placeholder="Search ideas…"></div>
            ${viewToggleHtml()}
            <button class="browse-add-idea-btn" id="browse-add-idea-btn" style="display:none">+ Add idea</button>
          </div>
          <div class="browse-ideas-content" id="browse-ideas-content"></div>
        </div>
      </div>`);

    document.getElementById('col-fa-search').addEventListener('input', e => renderBrowseFa(e.target.value));
    document.getElementById('col-ch-search').addEventListener('input', e => renderBrowseCh(e.target.value));
    document.getElementById('browse-search').addEventListener('input', () => renderBrowseIdeas());

    await renderBrowseFa('');
    await renderBrowseCh('');
    await renderBrowseIdeas();
  } catch (e) {
    render(`<div class="empty-state"><h3>Something went wrong</h3><p>${esc(e.message)}</p></div>`);
  }
}

async function renderBrowseFa(filter) {
  const q = (filter || '').toLowerCase().trim();
  const list = document.getElementById('col-fa-list');
  if (!list) return;
  const matches = browseState.focusAreas.filter(fa => !q || fa.name.toLowerCase().includes(q));
  if (matches.length === 0) {
    list.innerHTML = '<div class="browse-col-empty">No focus areas match.</div>';
    return;
  }
  list.innerHTML = matches.map(fa => `
    <button class="col-item${fa.id === browseState.focusAreaId ? ' active' : ''}" onclick="selectBrowseFocusArea(${fa.id})">
      <span class="col-item-body">
        <div class="col-item-title">${esc(fa.name)}</div>
        <div class="col-item-sub">${fa.challenge_count ?? 0} challenges</div>
      </span>
    </button>`).join('');
}

async function selectBrowseFocusArea(id) {
  browseState.focusAreaId = id;
  browseState.challengeId = null;
  await renderBrowseCh('');
  await renderBrowseIdeas();
  renderBrowseFa(document.getElementById('col-fa-search').value);
}

async function renderBrowseCh(filter) {
  const q = (filter || '').toLowerCase().trim();
  const list = document.getElementById('col-ch-list');
  if (!list) return;
  const fa = browseState.focusAreas.find(f => f.id === browseState.focusAreaId);
  if (!fa) {
    list.innerHTML = '<div class="browse-col-empty">Select a focus area to see its challenges.</div>';
    return;
  }
  browseState.challenges = await api.get(`/api/focus-areas/${fa.id}/challenges`);
  const matches = browseState.challenges.filter(c => !q || c.name.toLowerCase().includes(q));
  const totalIdeas = browseState.challenges.reduce((n, c) => n + (c.idea_count ?? 0), 0);
  let html = `
    <button class="col-item all-item${browseState.challengeId === null ? ' active' : ''}" onclick="selectBrowseChallenge(null)">
      <span class="col-item-body"><div class="col-item-title">All challenges</div><div class="col-item-sub">${totalIdeas} ideas total</div></span>
    </button>`;
  html += matches.map(c => `
    <button class="col-item${c.id === browseState.challengeId ? ' active' : ''}" onclick="selectBrowseChallenge(${c.id})">
      <span class="col-item-body">
        <div class="col-item-title">${esc(c.name)}</div>
        <div class="col-item-sub">${c.idea_count ?? 0} idea${(c.idea_count ?? 0) !== 1 ? 's' : ''}</div>
      </span>
    </button>`).join('');
  list.innerHTML = html;
}

async function selectBrowseChallenge(id) {
  browseState.challengeId = id;
  await renderBrowseIdeas();
  renderBrowseCh(document.getElementById('col-ch-search').value);
}

function ideaCardsOrList(ideas) {
  if (ideas.length === 0) return '';
  if (viewMode === 'list') {
    return `<div class="idea-list">${ideas.map(i => `
      <div class="idea-list-row" onclick="location.hash='#/idea/${i.id}'">
        ${ideaRingHtml(i)}
        <span class="idea-list-title">${i.name ? esc(i.name) : 'Untitled idea'}</span>
        <span class="idea-list-snippet">${esc(ideaSnippet(i)) || 'No pitch yet — chat with the coach to get started.'}</span>
        <span class="idea-list-meta">${formatDate(i.updated_at || i.created_at)}</span>
      </div>`).join('')}</div>`;
  }
  return `<div class="idea-card-grid">${ideas.map(i => `
    <div class="idea-card" onclick="location.hash='#/idea/${i.id}'">
      <div class="idea-card-top">${ideaRingHtml(i, true)}<span class="idea-card-title">${i.name ? esc(i.name) : 'Untitled idea'}</span></div>
      <div class="idea-card-snippet">${ideaSnippet(i) ? esc(ideaSnippet(i)) : '<em>No pitch yet — chat with the coach to get started.</em>'}</div>
      <div class="idea-card-meta"><span>Updated ${formatDate(i.updated_at || i.created_at)}</span></div>
    </div>`).join('')}</div>`;
}

async function renderBrowseIdeas() {
  const crumb = document.getElementById('browse-ideas-crumb');
  const addBtn = document.getElementById('browse-add-idea-btn');
  const content = document.getElementById('browse-ideas-content');
  const q = (document.getElementById('browse-search')?.value || '').toLowerCase().trim();
  const fa = browseState.focusAreas.find(f => f.id === browseState.focusAreaId);

  if (!fa) {
    crumb.textContent = 'Ideas';
    addBtn.style.display = 'none';
    content.innerHTML = '<div class="browse-empty-state">Pick a focus area on the left to see its challenges and ideas.</div>';
    return;
  }

  const matchesQuery = i => !q || (i.name || '').toLowerCase().includes(q) || ideaSnippet(i).toLowerCase().includes(q);
  const ch = browseState.challenges.find(c => c.id === browseState.challengeId);

  if (ch) {
    crumb.textContent = `${fa.name} › ${ch.name}`;
    addBtn.style.display = isAuth() ? 'flex' : 'none';
    addBtn.onclick = () => createIdea(ch.id, addBtn);
    const ideas = (await api.get(`/api/challenges/${ch.id}/ideas`)).filter(matchesQuery);
    content.innerHTML = ideas.length
      ? ideaCardsOrList(ideas)
      : `<div class="browse-empty-state">${q ? `No ideas match "${esc(q)}".` : 'No ideas yet in this challenge — add the first one.'}</div>`;
    return;
  }

  crumb.textContent = `${fa.name} › All challenges`;
  addBtn.style.display = 'none';
  let html = '';
  let anyShown = false;
  for (const chal of browseState.challenges) {
    const ideas = (await api.get(`/api/challenges/${chal.id}/ideas`)).filter(matchesQuery);
    if (q && ideas.length === 0) continue;
    anyShown = true;
    html += `<div class="browse-challenge-block">
      <div class="browse-challenge-block-header">
        <h3>${esc(chal.name)}</h3>
        <span class="browse-challenge-block-count">${ideas.length} idea${ideas.length !== 1 ? 's' : ''}</span>
        ${isAuth() ? `<button class="col-add-idea-btn" onclick="createIdea(${chal.id}, this)">+ Add idea</button>` : ''}
      </div>
      ${ideas.length ? ideaCardsOrList(ideas) : '<div class="browse-col-empty" style="padding:0 0 0.3rem">No ideas yet in this challenge.</div>'}
    </div>`;
  }
  content.innerHTML = anyShown ? html : `<div class="browse-empty-state">No ideas match "${esc(q)}".</div>`;
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
// Keep key/label in sync with STAGES in src/routes/coach.js — no shared
// module boundary between server and this plain-<script> frontend.
const STAGES = [
  { key: 'problem_statement', label: 'Problem Statement', placeholder: 'Target user, specific pain, why it matters…' },
  { key: 'value_proposition', label: 'Value Proposition', placeholder: 'For [user] who has [problem], this is a [category] that [benefit]…' },
  { key: 'hypothesis',        label: 'Hypothesis',        placeholder: "We believe [user] will [behavior] because [reason]; we'll know when [signal]…" },
];
// Synthesized from the three fields above once all are filled — not chat-topic-gated.
const PITCH_FIELD = { key: 'pitch', label: 'Pitch' };

let coachState = { ideaId: null, streaming: false, ideaData: {}, lastPitchInputs: null };

// Docked (side-by-side) vs. floating chat panel, persisted across ideas/reloads.
let chatLayout = { mode: 'docked', minimized: false };
try {
  const saved = JSON.parse(localStorage.getItem('chatLayout') || '{}');
  if (saved.mode) chatLayout.mode = saved.mode;
} catch {}

function applyChatLayout() {
  const workspace = document.getElementById('workspace');
  if (!workspace) return;
  workspace.classList.toggle('mode-overlay', chatLayout.mode === 'overlay');
  workspace.classList.toggle('chat-minimized', chatLayout.mode === 'overlay' && chatLayout.minimized);
  const minimizeBtn = document.getElementById('minimize-btn');
  if (minimizeBtn) {
    minimizeBtn.style.display = chatLayout.mode === 'overlay' ? 'grid' : 'none';
    minimizeBtn.title = chatLayout.minimized ? 'Expand chat' : 'Minimize chat';
  }
}

function computeCurrentTopic(ideaData) {
  for (let i = 0; i < STAGES.length; i++) {
    if (!ideaData[STAGES[i].key]?.trim()) return i;
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

    coachState = { ideaId: parseInt(id), streaming: false, ideaData: { ...idea }, lastPitchInputs: null };
    const currentTopic = computeCurrentTopic(coachState.ideaData);

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
      <div class="workspace" id="workspace">
        ${isAuth() ? `
        <div class="chat-pane" id="chat-pane">
          <div class="chat-header">
            <span class="coach-icon">🤖</span>
            <div class="chat-header-text">
              <h2>Idea Coach</h2>
              <div id="coach-stage-label" class="coach-stage-label">${currentTopic < STAGES.length ? 'Exploring: ' + STAGES[currentTopic].label : 'Idea complete!'}</div>
            </div>
            <div class="chat-header-controls">
              <button class="chat-ctrl-btn" id="layout-toggle-btn" title="Switch between side-by-side and floating chat">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M13 4v16"/></svg>
              </button>
              <button class="chat-ctrl-btn" id="minimize-btn" title="Minimize chat">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14"/></svg>
              </button>
            </div>
          </div>
          <div class="chat-messages" id="chat-messages"></div>
          <div class="chat-input-area">
            <textarea id="chat-input" class="chat-input" placeholder="Type your response…" rows="1"></textarea>
            <button id="chat-send" class="chat-send" title="Send (Enter)">➤</button>
          </div>
        </div>
        <button class="chat-bubble" id="chat-bubble">
          <span class="chat-bubble-avatar">🤖</span>
          <span class="chat-bubble-text"><strong>Idea Coach</strong><span>Tap to continue chatting</span></span>
        </button>
        ` : `
        <div class="readonly-banner">
          <span>Log in to develop this idea with the AI coach</span>
          <button class="btn btn-primary btn-sm" onclick="showAuthModal()">Log in</button>
        </div>`}
        <div class="dashboard-pane">
          <div class="idea-panel">
            <div class="idea-panel-header">
              <span>📋 Idea Pitch</span>
              <span id="stage-counter" class="stage-counter"></span>
            </div>
            <div class="stage-bar"><div class="stage-bar-fill" id="stage-bar-fill"></div></div>
            <div class="idea-panel-body" id="idea-panel-body"></div>
          </div>
          <div class="dashboard-tip">Cards fill in live as you chat — no separate save step needed.</div>
        </div>
      </div>`);

    renderIdeaPanel(coachState.ideaData, id);

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

      document.getElementById('layout-toggle-btn').addEventListener('click', () => {
        chatLayout.mode = chatLayout.mode === 'overlay' ? 'docked' : 'overlay';
        chatLayout.minimized = false;
        localStorage.setItem('chatLayout', JSON.stringify(chatLayout));
        applyChatLayout();
      });
      document.getElementById('minimize-btn').addEventListener('click', () => {
        chatLayout.minimized = !chatLayout.minimized;
        localStorage.setItem('chatLayout', JSON.stringify(chatLayout));
        applyChatLayout();
      });
      document.getElementById('chat-bubble').addEventListener('click', () => {
        chatLayout.minimized = false;
        localStorage.setItem('chatLayout', JSON.stringify(chatLayout));
        applyChatLayout();
      });
      applyChatLayout();
    }
  } catch (e) {
    render(`<div class="empty-state"><h3>Something went wrong</h3><p>${esc(e.message)}</p></div>`);
  }
}

// Always-on dashboard: every target field renders as a card simultaneously and
// updates in place as extraction/pitch-synthesis produce new values — no manual
// "next topic" stepping, no click-to-jump. Auth and read-only users share this
// same render path; they differ only in whether filled cards are editable.
function autoGrowTextarea(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function renderIdeaPanel(ideaData, ideaId, highlightKey) {
  const body = document.getElementById('idea-panel-body');
  if (!body) return;

  const allFields = [...STAGES, PITCH_FIELD];
  const filledCount = allFields.filter(s => ideaData[s.key]?.trim()).length;

  const counter = document.getElementById('stage-counter');
  const fill = document.getElementById('stage-bar-fill');
  if (counter) counter.textContent = `${filledCount} of ${allFields.length} developed`;
  if (fill) fill.style.width = `${filledCount / allFields.length * 100}%`;

  const editable = isAuth();
  let html = '<div class="dashboard-grid">';
  allFields.forEach(s => {
    const val = ideaData[s.key] || '';
    const isFilled = !!val.trim();
    const isPitch = s.key === 'pitch';
    const stateClass = isFilled ? 'dashboard-card-filled' : 'dashboard-card-empty';
    const emptyText = isPitch ? 'Synthesized once problem, value prop, and hypothesis are ready' : 'Not yet captured';
    const pulseClass = s.key === highlightKey ? ' just-updated' : '';
    html += `<div class="dashboard-card ${stateClass}${isPitch ? ' dashboard-card-pitch' : ''}${pulseClass}">
      <div class="dashboard-card-header">
        <span class="dashboard-card-label">${isFilled ? '✓ ' : ''}${s.label}</span>
      </div>
      ${editable && isFilled
        ? `<textarea class="dashboard-card-textarea" data-field="${s.key}" rows="1"${isPitch ? ' readonly' : ''}>${esc(val)}</textarea>`
        : `<div class="dashboard-card-value">${isFilled ? esc(val) : `<em>${emptyText}</em>`}</div>`}
    </div>`;
  });
  html += '</div>';
  body.innerHTML = html;

  if (editable) {
    body.querySelectorAll('.dashboard-card-textarea').forEach(el => {
      autoGrowTextarea(el);
      if (!el.readOnly) {
        el.addEventListener('input', () => autoGrowTextarea(el));
        el.addEventListener('change', () => saveIdeaFields(ideaId));
      }
    });
  }
}

function updateChatStageLabel(stage) {
  const el = document.getElementById('coach-stage-label');
  if (el) el.textContent = stage < STAGES.length ? `Exploring: ${STAGES[stage].label}` : 'Idea complete!';
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
      body: JSON.stringify({ message: message || '' })
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
    const changedKey = STAGES
      .map(s => s.key)
      .find(k => fields[k] && fields[k] !== coachState.ideaData[k]);
    coachState.ideaData = { ...coachState.ideaData, ...fields };
    renderIdeaPanel(coachState.ideaData, ideaId, changedKey);
    updateChatStageLabel(computeCurrentTopic(coachState.ideaData));
    if (fields.name) {
      const h1 = document.querySelector('.page-header-text h1');
      if (h1) h1.textContent = fields.name;
    }
    await maybeSynthesizePitch(ideaId);
  } catch (e) { console.warn('Field extraction failed:', e.message); }
}

// Auto-fires once problem_statement/value_proposition/hypothesis are all filled,
// and re-fires only when those three inputs actually change — bounds pitch
// synthesis to one Gemini call per meaningful content change, not per chat turn.
async function maybeSynthesizePitch(ideaId) {
  const { problem_statement, value_proposition, hypothesis } = coachState.ideaData;
  if (!problem_statement?.trim() || !value_proposition?.trim() || !hypothesis?.trim()) return;
  const inputs = { problem_statement, value_proposition, hypothesis };
  const unchanged = coachState.lastPitchInputs &&
    JSON.stringify(inputs) === JSON.stringify(coachState.lastPitchInputs);
  if (unchanged) return;
  try {
    const { pitch } = await api.post(`/api/ideas/${ideaId}/pitch`, {});
    if (pitch) {
      coachState.ideaData.pitch = pitch;
      coachState.lastPitchInputs = inputs;
      renderIdeaPanel(coachState.ideaData, ideaId, 'pitch');
    }
  } catch (e) { console.warn('Pitch synthesis failed:', e.message); }
}

async function saveIdeaFields(id) {
  const body = {};
  STAGES.forEach(s => {
    const el = document.querySelector(`.dashboard-card-textarea[data-field="${s.key}"]`);
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
