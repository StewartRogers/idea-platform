/* ===== API helpers ===== */
const api = {
  async get(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error((await r.json()).error || r.statusText);
    return r.json();
  },
  async post(url, body) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error((await r.json()).error || r.statusText);
    return r.json();
  },
  async put(url, body) {
    const r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error((await r.json()).error || r.statusText);
    return r.json();
  },
  async del(url) {
    const r = await fetch(url, { method: 'DELETE' });
    if (!r.ok) throw new Error((await r.json()).error || r.statusText);
    return r.json();
  }
};

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

/* ===== Breadcrumb ===== */
function setBreadcrumb(items) {
  const el = document.getElementById('breadcrumb');
  el.innerHTML = items.map((item, i) => {
    const isLast = i === items.length - 1;
    if (isLast) return `<span class="current">${esc(item.label)}</span>`;
    return `<a href="${item.href}">${esc(item.label)}</a><span class="sep">/</span>`;
  }).join('');
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
document.addEventListener('DOMContentLoaded', () => { modal.init(); route(); });

/* ===== Render helper ===== */
function render(html) {
  document.getElementById('app').innerHTML = html;
}

/* ===== View: Home — Focus Areas ===== */
async function viewHome() {
  setBreadcrumb([{ label: 'Focus Areas', href: '#/' }]);
  render('<div class="loading">Loading…</div>');
  try {
    const areas = await api.get('/api/focus-areas');
    const cards = areas.length ? areas.map(a => `
      <div class="card" onclick="location.hash='#/focus/${a.id}'">
        <div class="card-title">${esc(a.name)}</div>
        <div class="card-desc">${esc(a.description) || '<em>No description</em>'}</div>
        <div class="card-meta">
          <span class="badge">${a.challenge_count} challenge${a.challenge_count !== 1 ? 's' : ''}</span>
          <span>${formatDate(a.created_at)}</span>
        </div>
      </div>`).join('') : `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="icon">🎯</div>
        <h3>No focus areas yet</h3>
        <p>Focus areas help you organise challenges around a theme or goal.</p>
        <button class="btn btn-primary" onclick="showCreateFocusArea()">+ Create your first Focus Area</button>
      </div>`;

    render(`
      <div class="page-header">
        <div>
          <h1>Focus Areas</h1>
          <div class="subtitle">Organise your challenges by theme or goal</div>
        </div>
        ${areas.length ? '<button class="btn btn-primary" onclick="showCreateFocusArea()">+ New Focus Area</button>' : ''}
      </div>
      <div class="card-grid">${cards}</div>`);
  } catch (e) {
    render(`<div class="empty-state"><h3>Error</h3><p>${esc(e.message)}</p></div>`);
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
  try {
    const fa = await api.post('/api/focus-areas', { name, description });
    modal.hide();
    location.hash = `#/focus/${fa.id}`;
  } catch (e) { alert(e.message); }
}

/* ===== View: Focus Area detail ===== */
async function viewFocusArea(id) {
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

    const cards = challenges.length ? challenges.map(c => `
      <div class="card" onclick="location.hash='#/challenge/${c.id}'">
        <div class="card-title">${esc(c.name)}</div>
        <div class="card-desc">${esc(c.description) || '<em>No description</em>'}</div>
        <div class="card-meta">
          <span class="badge">${c.idea_count} idea${c.idea_count !== 1 ? 's' : ''}</span>
          <span>${formatDate(c.created_at)}</span>
        </div>
      </div>`).join('') : `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="icon">🔍</div>
        <h3>No challenges yet</h3>
        <p>Challenges are problems or opportunities to tackle within this focus area.</p>
        <button class="btn btn-primary" onclick="showCreateChallenge(${id})">+ Add a Challenge</button>
      </div>`;

    render(`
      <div class="page-header">
        <div>
          <h1>${esc(fa.name)}</h1>
          ${fa.description ? `<div class="subtitle">${esc(fa.description)}</div>` : ''}
        </div>
        <div style="display:flex;gap:.5rem">
          <button class="btn btn-ghost btn-sm" onclick="showEditFocusArea(${id})">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteFocusArea(${id})">Delete</button>
          ${challenges.length ? `<button class="btn btn-primary" onclick="showCreateChallenge(${id})">+ New Challenge</button>` : ''}
        </div>
      </div>
      <div class="section">
        <div class="section-header"><h2>Challenges</h2></div>
        <div class="card-grid">${cards}</div>
      </div>`);
  } catch (e) {
    render(`<div class="empty-state"><h3>Error</h3><p>${esc(e.message)}</p></div>`);
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
  try {
    await api.put(`/api/focus-areas/${id}`, { name, description });
    modal.hide();
    viewFocusArea(id);
  } catch (e) { alert(e.message); }
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
  try {
    const ch = await api.post(`/api/focus-areas/${focusAreaId}/challenges`, { name, description });
    modal.hide();
    location.hash = `#/challenge/${ch.id}`;
  } catch (e) { alert(e.message); }
}

/* ===== View: Challenge detail ===== */
async function viewChallenge(id) {
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

    const ideaList = ideas.length ? ideas.map(idea => `
      <div class="idea-item" onclick="location.hash='#/idea/${idea.id}'">
        <div class="idea-item-icon">💡</div>
        <div class="idea-item-body">
          <div class="idea-item-title ${!idea.name ? 'empty' : ''}">${idea.name ? esc(idea.name) : 'Untitled idea'}</div>
          <div class="idea-item-desc">${idea.description ? esc(idea.description) : 'No description yet — open to start coaching'}</div>
        </div>
        <div class="idea-item-arrow">›</div>
      </div>`).join('') : `
      <div class="empty-state">
        <div class="icon">💡</div>
        <h3>No ideas yet</h3>
        <p>Add an idea and the AI coach will guide you through developing it.</p>
        <button class="btn btn-primary" onclick="createIdea(${id})">+ Add First Idea</button>
      </div>`;

    render(`
      <div class="page-header">
        <div>
          <h1>${esc(ch.name)}</h1>
          ${ch.description ? `<div class="subtitle">${esc(ch.description)}</div>` : ''}
        </div>
        <div style="display:flex;gap:.5rem">
          <button class="btn btn-ghost btn-sm" onclick="showEditChallenge(${id})">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteChallenge(${id}, ${ch.focus_area_id})">Delete</button>
          ${ideas.length ? `<button class="btn btn-primary" onclick="createIdea(${id})">+ New Idea</button>` : ''}
        </div>
      </div>
      <div class="section">
        <div class="section-header"><h2>Ideas</h2></div>
        ${ideaList}
      </div>`);
  } catch (e) {
    render(`<div class="empty-state"><h3>Error</h3><p>${esc(e.message)}</p></div>`);
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
  try {
    await api.put(`/api/challenges/${id}`, { name, description });
    modal.hide();
    viewChallenge(id);
  } catch (e) { alert(e.message); }
}

async function deleteChallenge(id, focusAreaId) {
  if (!confirm('Delete this challenge and all its ideas?')) return;
  try {
    await api.del(`/api/challenges/${id}`);
    location.hash = `#/focus/${focusAreaId}`;
  } catch (e) { alert(e.message); }
}

async function createIdea(challengeId) {
  try {
    const idea = await api.post(`/api/challenges/${challengeId}/ideas`, {});
    location.hash = `#/idea/${idea.id}`;
  } catch (e) { alert(e.message); }
}

/* ===== View: Idea Coach ===== */
let coachState = { ideaId: null, streaming: false, pendingSave: false };

async function viewIdea(id) {
  render('<div class="loading">Loading…</div>');
  try {
    const idea = await api.get(`/api/ideas/${id}`);

    setBreadcrumb([
      { label: 'Focus Areas', href: '#/' },
      { label: idea.focus_area_name, href: `#/focus/${idea.focus_area_id}` },
      { label: idea.challenge_name, href: `#/challenge/${idea.challenge_id}` },
      { label: idea.name || 'New Idea', href: `#/idea/${id}` }
    ]);

    coachState = { ideaId: parseInt(id), streaming: false };

    render(`
      <div class="page-header" style="margin-bottom:1rem">
        <div>
          <h1>${idea.name ? esc(idea.name) : 'New Idea'}</h1>
          <div class="subtitle">Challenge: <strong>${esc(idea.challenge_name)}</strong></div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="deleteIdea(${id}, ${idea.challenge_id})">Delete Idea</button>
      </div>
      <div class="coach-layout">
        <!-- Chat panel -->
        <div class="chat-panel">
          <div class="chat-header">
            <span class="coach-icon">🤖</span>
            <h2>Idea Coach</h2>
          </div>
          <div class="chat-messages" id="chat-messages"></div>
          <div class="chat-input-area">
            <textarea id="chat-input" class="chat-input" placeholder="Type your response…" rows="1"></textarea>
            <button id="chat-send" class="chat-send" title="Send (Enter)">➤</button>
          </div>
        </div>

        <!-- Idea fields panel -->
        <div class="idea-panel">
          <div class="idea-panel-header">📋 Idea Details</div>
          <div class="idea-panel-body">
            <div class="idea-field">
              <label>Idea Name</label>
              <textarea id="field-name" rows="1" placeholder="Will be filled as you chat…">${esc(idea.name)}</textarea>
            </div>
            <div class="idea-field">
              <label>Description</label>
              <textarea id="field-description" rows="2" placeholder="What is this idea?">${esc(idea.description)}</textarea>
            </div>
            <div class="idea-field">
              <label>Problem — What</label>
              <textarea id="field-problem_what" rows="2" placeholder="What problem does it solve?">${esc(idea.problem_what)}</textarea>
            </div>
            <div class="idea-field">
              <label>Problem — Who</label>
              <textarea id="field-problem_who" rows="2" placeholder="Who is affected?">${esc(idea.problem_who)}</textarea>
            </div>
            <div class="idea-field">
              <label>Problem — Scale</label>
              <textarea id="field-problem_scale" rows="2" placeholder="How significant is this problem?">${esc(idea.problem_scale)}</textarea>
            </div>
            <div class="idea-field">
              <label>Potential Benefits</label>
              <textarea id="field-benefits" rows="2" placeholder="What positive outcomes?">${esc(idea.benefits)}</textarea>
            </div>
          </div>
          <div class="idea-panel-footer">
            <button class="btn btn-ghost btn-sm" style="flex:1" onclick="saveIdeaFields(${id})">💾 Save Fields</button>
          </div>
        </div>
      </div>`);

    // Render existing conversation
    const messagesEl = document.getElementById('chat-messages');
    if (idea.conversation && idea.conversation.length > 0) {
      idea.conversation.forEach(msg => appendMessage(msg.role, msg.content));
      messagesEl.scrollTop = messagesEl.scrollHeight;
    } else {
      // Auto-start with coach's first message
      await sendCoachMessage(id, null);
    }

    // Input event listeners
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend(id);
      }
    });
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });
    sendBtn.addEventListener('click', () => handleSend(id));

    // Field change listeners — save on blur
    ['name','description','problem_what','problem_who','problem_scale','benefits'].forEach(f => {
      const el = document.getElementById(`field-${f}`);
      if (el) el.addEventListener('change', () => saveIdeaFields(id));
    });

  } catch (e) {
    render(`<div class="empty-state"><h3>Error</h3><p>${esc(e.message)}</p></div>`);
  }
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
  if (el) {
    el.id = '';
    el.classList.remove('message-typing');
  }
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

  // Show streaming placeholder
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
          if (event.type === 'token') {
            accumulated += event.text;
            updateStreamingMessage(accumulated);
          } else if (event.type === 'done') {
            finalizeStreamingMessage();
          } else if (event.type === 'error') {
            throw new Error(event.message);
          }
        } catch (parseErr) { /* skip malformed events */ }
      }
    }

    finalizeStreamingMessage();

    // Extract structured fields after each coach message
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
    const fieldNames = ['name', 'description', 'problem_what', 'problem_who', 'problem_scale', 'benefits'];
    fieldNames.forEach(f => {
      const el = document.getElementById(`field-${f}`);
      if (el && fields[f] && fields[f] !== el.value) {
        el.value = fields[f];
        el.classList.add('updated');
        setTimeout(() => el.classList.remove('updated'), 1200);
      }
    });

    // Update page title if name was extracted
    if (fields.name) {
      const h1 = document.querySelector('.page-header h1');
      if (h1) h1.textContent = fields.name;
    }
  } catch (e) {
    console.warn('Field extraction failed:', e.message);
  }
}

async function saveIdeaFields(id) {
  const fields = ['name', 'description', 'problem_what', 'problem_who', 'problem_scale', 'benefits'];
  const body = {};
  fields.forEach(f => {
    const el = document.getElementById(`field-${f}`);
    if (el) body[f] = el.value.trim();
  });
  try {
    await api.put(`/api/ideas/${id}`, body);
  } catch (e) {
    console.warn('Save failed:', e.message);
  }
}

async function deleteIdea(id, challengeId) {
  if (!confirm('Delete this idea and its entire conversation?')) return;
  try {
    await api.del(`/api/ideas/${id}`);
    location.hash = `#/challenge/${challengeId}`;
  } catch (e) { alert(e.message); }
}

/* ===== Utilities ===== */
function formatDate(dt) {
  if (!dt) return '';
  const d = new Date(dt + (dt.endsWith('Z') ? '' : 'Z'));
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
