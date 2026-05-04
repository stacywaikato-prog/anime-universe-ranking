let allCharacters = [];

// Bump this version whenever the character roster changes to invalidate old cache.
const CACHE_VERSION = 'v6';
const imageCache = (() => {
  try {
    if (localStorage.getItem('anilist_cache_ver') !== CACHE_VERSION) {
      localStorage.removeItem('anilist_cache');
      localStorage.setItem('anilist_cache_ver', CACHE_VERSION);
    }
    return JSON.parse(localStorage.getItem('anilist_cache') || '{}');
  } catch { return {}; }
})();

// Names where AniList's stored name differs from our display name.
// Fallback always retries with the display name if the override returns nothing.
const anilistNameOverrides = {
  'Levi Ackerman':        'Levi',
  'Roronoa Zoro':         'Zoro',
  'Sasuke Uchiha':        'Sasuke',
  'Kakashi Hatake':       'Kakashi',
  'Natsume Takashi':      'Takashi Natsume',
  'Gojo Satoru':          'Satoru Gojo',
  'Ryomen Sukuna':        'Sukuna',
  'Killua Zoldyck':       'Killua',
  'Gon Freecss':          'Gon',
  'Hisoka Morow':         'Hisoka',
  'Sung Jin-Woo':         'Jinwoo',
  'Shoto Todoroki':       'Todoroki Shouto',   // AniList uses Japanese order + extended romanization
  'Katsuki Bakugo':       'Bakugou Katsuki',   // AniList uses Japanese order
  'Lelouch vi Britannia': 'Lelouch Lamperouge',
  'Tanjiro Kamado':       'Kamado Tanjirou',   // AniList uses Japanese order + extended romanization
  'Ainz Ooal Gown':       'Ainz',
  'Kyojuro Rengoku':      'Rengoku Kyoujurou', // AniList uses Japanese order + extended romanization
  'Giyu Tomioka':         'Tomioka Giyuu',     // AniList uses Japanese order + extended romanization
  'Yuji Itadori':         'Itadori Yuuji',     // AniList uses Japanese order + extended romanization
  'Nezuko Kamado':        'Kamado Nezuko',     // AniList uses Japanese order
  'Sosuke Aizen':         'Aizen Sousuke',     // AniList uses Japanese order + extended romanization
  'Jotaro Kujo':          'Kuujou Joutarou',   // AniList uses Japanese order + extended romanization
};

// Power-type → particle colors
const POWER_COLORS = {
  fire:      ['#ff4500','#ff8c00','#ffd700','#ff6347'],
  lightning: ['#ffffff','#87ceeb','#4169e1','#e0f2fe'],
  water:     ['#00bfff','#1e90ff','#87ceeb','#00ced1'],
  void:      ['#7b2fbe','#c084fc','#a855f7','#2d1b69'],
  energy:    ['#ffd700','#ff8c00','#ffff00','#ffa500'],
  shadow:    ['#4c1d95','#7c3aed','#6d28d9','#1e1b4b'],
  wind:      ['#4ade80','#86efac','#34d399','#d1fae5'],
  blood:     ['#dc2626','#ef4444','#991b1b','#fca5a5'],
  holy:      ['#fef3c7','#fde68a','#fbbf24','#ffffff'],
  ice:       ['#bae6fd','#7dd3fc','#38bdf8','#e0f2fe'],
  smoke:     ['#9ca3af','#6b7280','#d1d5db','#4b5563'],
  explosion: ['#f97316','#fb923c','#fbbf24','#ef4444'],
  infinity:  ['#3b82f6','#60a5fa','#93c5fd','#dbeafe'],
  mind:      ['#d8b4fe','#c084fc','#a855f7','#ede9fe'],
  earth:     ['#a3e635','#65a30d','#84cc16','#4d7c0f'],
  metal:     ['#e5e7eb','#9ca3af','#fbbf24','#d1d5db'],
};

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  injectModal();
  setupCardClicks();
  loadPageContent();
  loadCharacterImages();
});

// ── Data Loading ───────────────────────────────────────────

async function loadPageContent() {
  const page = detectPage();
  if (!page) return;

  if (!page.keepExisting) showLoading(page.containerId);

  try {
    const res = await fetch('data.json');
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json();
    allCharacters = data;
    page.render(data);
    loadCharacterImages();
  } catch (err) {
    showError(page.containerId, 'Could not load character data.');
    console.error(err);
  }
}

function detectPage() {
  if (document.getElementById('main'))
    return { containerId: 'main',        render: renderHome };
  if (document.getElementById('characters'))
    return { containerId: 'characters',  render: renderCharacters };
  if (document.getElementById('rankings'))
    return { containerId: 'rankings',    render: renderRankings };
  if (document.getElementById('hidden-gems'))
    return { containerId: 'hidden-gems', render: renderHiddenGems };
  return null;
}

// ── Renderers ──────────────────────────────────────────────

function renderHome(data) {
  const container = document.getElementById('main');
  const featured = data.filter(c => c.category === 'featured');

  container.innerHTML = `
    <div class="section-header">
      <span class="section-eyebrow">Featured</span>
      <h2 class="section-title">Iconic <span class="gradient-text">Characters</span></h2>
      <p class="section-desc">The most powerful and beloved characters across the anime world.</p>
    </div>
    <div class="cards-grid" id="cards-container"></div>
  `;

  featured.forEach((char, i) => {
    document.getElementById('cards-container').appendChild(createCharacterCard(char, i));
  });
}

function renderCharacters(data) {
  const container = document.getElementById('characters');
  container.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'cards-grid';
  grid.id = 'cards-container';
  container.appendChild(grid);

  data.forEach((char, i) => {
    grid.appendChild(createCharacterCard(char, i));
  });
}

function renderRankings(data) {
  const container = document.getElementById('rankings');
  container.innerHTML = '';

  // Ranking controls bar
  const controls = document.createElement('div');
  controls.className = 'ranking-controls';
  controls.innerHTML = `
    <button id="editRankBtn" class="rank-ctrl-btn">✏️ Customize My Ranking</button>
    <button id="resetRankBtn" class="rank-ctrl-btn rank-ctrl-ghost" style="display:none">↩ Reset to Official</button>
  `;
  container.appendChild(controls);

  const listWrap = document.createElement('div');
  listWrap.className = 'rankings-list';
  listWrap.id = 'rankings-list';
  container.appendChild(listWrap);

  const sorted = getSortedRanking(data);
  sorted.forEach((char, i) => {
    listWrap.appendChild(createRankingItem(char, i));
  });

  initPersonalRanking();
}

function renderHiddenGems(data) {
  const container = document.getElementById('hidden-gems');
  const gems = data.filter(c => c.category === 'hidden-gems');
  container.innerHTML = '<div class="cards-grid" id="cards-container"></div>';
  gems.forEach((char, i) => {
    document.getElementById('cards-container').appendChild(createCharacterCard(char, i));
  });
}

// ── Card Builders ──────────────────────────────────────────

function createCharacterCard(char, index) {
  const card = document.createElement('div');
  card.className = 'character-card';
  card.setAttribute('data-name', char.name);
  card.style.animationDelay = `${index * 0.08}s`;

  const powerClass = getPowerClass(char.powerLevel);
  const abilities = char.abilities.slice(0, 3)
    .map(a => `<span class="ability-tag">${a}</span>`).join('');
  const gemBadge = char.category === 'hidden-gems'
    ? '<span class="gem-badge">💎 Hidden Gem</span>' : '';

  card.innerHTML = `
    <div class="card-image-wrapper">
      <img src="" alt="${char.name}" style="display:none;">
      <div class="card-image-placeholder">${getCharacterEmoji(char.name)}</div>
    </div>
    <div class="card-body">
      <div class="card-series">${char.series}</div>
      <h3 class="card-name">${char.name}</h3>
      <div class="card-meta">
        <span class="power-badge ${powerClass}">⚡ ${char.powerLevel}</span>
        ${gemBadge}
      </div>
      <p class="card-desc">${char.description}</p>
      <div class="card-abilities">${abilities}</div>
    </div>
  `;
  return card;
}

function createRankingItem(char, index) {
  const item = document.createElement('div');
  item.className = 'ranking-item';
  item.setAttribute('data-name', char.name);
  item.style.animationDelay = `${index * 0.04}s`;

  const rankClass = getRankClass(index + 1);
  const powerClass = getPowerClass(char.powerLevel);
  const medal = getMedal(index + 1);

  item.innerHTML = `
    <div class="rank-drag-handle" title="Drag to reorder">⠿</div>
    <div class="rank-number ${rankClass}">${medal !== null ? medal : '#' + (index + 1)}</div>
    <div class="ranking-info">
      <div class="ranking-img-wrap">
        <img src="" alt="${char.name}" style="display:none;" class="ranking-thumb">
        <div class="ranking-thumb-placeholder">${getCharacterEmoji(char.name)}</div>
      </div>
      <div>
        <div class="ranking-name">${char.name}</div>
        <div class="ranking-series">${char.series}</div>
        <div class="ranking-desc">${char.description}</div>
      </div>
    </div>
    <span class="power-badge ${powerClass}">⚡ ${char.powerLevel}</span>
  `;
  return item;
}

// ── Power Animation ────────────────────────────────────────

function playPowerAnimation(cardEl, powerType, callback) {
  const colors = POWER_COLORS[powerType] || POWER_COLORS.energy;
  const rect = cardEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;z-index:998;pointer-events:none;';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');

  const particles = Array.from({ length: 100 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 14;
    return {
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 4 + Math.random() * 9,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1,
      decay: 0.022 + Math.random() * 0.018,
    };
  });

  const rings = [
    { r: 0, maxR: Math.hypot(rect.width, rect.height) * 1.2, color: colors[0], delay: 0 },
    { r: 0, maxR: Math.hypot(rect.width, rect.height) * 2.2, color: colors[1], delay: 80 },
  ];

  const startTime = performance.now();
  const duration = 680;

  function draw(now) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background vignette
    ctx.fillStyle = `rgba(0,0,0,${0.45 * Math.sin(t * Math.PI)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Expanding rings
    rings.forEach(ring => {
      if (elapsed < ring.delay) return;
      const rt = Math.min((elapsed - ring.delay) / (duration * 0.75), 1);
      const alpha = (1 - rt) * 0.65;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 4 * (1 - rt) + 1;
      ctx.shadowBlur = 12;
      ctx.shadowColor = ring.color;
      ctx.beginPath();
      ctx.arc(cx, cy, ring.maxR * rt, 0, Math.PI * 2);
      ctx.stroke();
    });

    ctx.shadowBlur = 0;

    // Particles
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.97;
      p.vy *= 0.97;
      p.life -= p.decay;
      if (p.life > 0) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    ctx.shadowBlur = 0;

    // Center flash
    if (t < 0.25) {
      const flashA = (0.25 - t) / 0.25 * 0.7;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 120);
      g.addColorStop(0, `rgba(255,255,255,${flashA})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.globalAlpha = 1;

    if (t < 1) {
      requestAnimationFrame(draw);
    } else {
      canvas.remove();
      callback();
    }
  }

  requestAnimationFrame(draw);
}

// ── Modal ──────────────────────────────────────────────────

function injectModal() {
  const overlay = document.createElement('div');
  overlay.id = 'characterModal';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <button class="modal-close" id="modalClose" aria-label="Close">✕</button>
      <div class="modal-inner">
        <div class="modal-image-col">
          <img class="modal-img" src="" alt="" style="display:none;">
          <div class="modal-image-placeholder"></div>
        </div>
        <div class="modal-content">
          <div class="modal-series"></div>
          <h2 class="modal-name"></h2>
          <div class="modal-badges"></div>
          <p class="modal-section-label">Background</p>
          <p class="modal-story"></p>
          <p class="modal-section-label">Personality</p>
          <p class="modal-personality"></p>
          <p class="modal-section-label">Abilities</p>
          <div class="modal-abilities"></div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('modalClose').addEventListener('click', closeCharacterModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeCharacterModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCharacterModal(); });
}

function setupCardClicks() {
  document.addEventListener('click', e => {
    const target = e.target.closest('.character-card[data-name], .ranking-item[data-name]');
    if (!target) return;
    // Don't trigger if a drag-handle or rank-ctrl button was clicked
    if (e.target.closest('.rank-drag-handle, .rank-ctrl-btn')) return;
    const name = target.getAttribute('data-name');
    if (!name) return;

    const char = allCharacters.find(c => c.name === name);
    if (!char) return;

    const list = document.getElementById('rankings-list');
    if (list && list.classList.contains('editable')) return; // editing mode — no modal

    playPowerAnimation(target, char.powerType || 'energy', () => openCharacterModal(name));
  });
}

function openCharacterModal(name) {
  const char = allCharacters.find(c => c.name === name);
  if (!char) return;

  const overlay = document.getElementById('characterModal');
  const img    = overlay.querySelector('.modal-img');
  const placeholder = overlay.querySelector('.modal-image-placeholder');

  overlay.querySelector('.modal-series').textContent = char.series;
  overlay.querySelector('.modal-name').textContent   = char.name;

  const powerClass = getPowerClass(char.powerLevel);
  overlay.querySelector('.modal-badges').innerHTML =
    `<span class="power-badge ${powerClass}">⚡ ${char.powerLevel}</span>` +
    (char.category === 'hidden-gems' ? '<span class="gem-badge">💎 Hidden Gem</span>' : '');

  overlay.querySelector('.modal-story').textContent       = char.story || char.description;
  overlay.querySelector('.modal-personality').textContent = char.personality;
  overlay.querySelector('.modal-abilities').innerHTML =
    char.abilities.map(a => `<span class="ability-tag">${a}</span>`).join('');

  img.src = '';
  img.style.display = 'none';
  placeholder.textContent  = getCharacterEmoji(char.name);
  placeholder.style.display = 'flex';

  if (imageCache[name]) {
    img.src = imageCache[name];
    img.style.display = 'block';
    placeholder.style.display = 'none';
  } else {
    fetchAniListImage(name).then(url => {
      if (url) {
        img.onload = () => {
          img.style.display = 'block';
          placeholder.style.display = 'none';
        };
        img.src = url;
      }
    }).catch(() => {});
  }

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCharacterModal() {
  document.getElementById('characterModal').classList.remove('open');
  document.body.style.overflow = '';
}

// ── Personal Ranking ───────────────────────────────────────

function getSortedRanking(data) {
  const saved = loadSavedRanking();
  if (saved && saved.length) {
    const ordered = saved
      .map(name => data.find(c => c.name === name))
      .filter(Boolean);
    // Append any new chars not in saved list
    data.forEach(c => { if (!saved.includes(c.name)) ordered.push(c); });
    return ordered;
  }
  return [...data].sort((a, b) => a.rank - b.rank);
}

function loadSavedRanking() {
  try { return JSON.parse(localStorage.getItem('my_ranking') || 'null'); }
  catch { return null; }
}

function initPersonalRanking() {
  const editBtn  = document.getElementById('editRankBtn');
  const resetBtn = document.getElementById('resetRankBtn');
  if (!editBtn) return;

  if (loadSavedRanking()) resetBtn.style.display = '';

  editBtn.addEventListener('click', () => {
    const list = document.getElementById('rankings-list');
    if (list.classList.contains('editable')) {
      exitEditMode();
    } else {
      enterEditMode();
    }
  });

  resetBtn.addEventListener('click', () => {
    localStorage.removeItem('my_ranking');
    resetBtn.style.display = 'none';
    const sorted = [...allCharacters].sort((a, b) => a.rank - b.rank);
    const list = document.getElementById('rankings-list');
    list.innerHTML = '';
    list.classList.remove('editable');
    document.getElementById('editRankBtn').textContent = '✏️ Customize My Ranking';
    sorted.forEach((char, i) => list.appendChild(createRankingItem(char, i)));
    loadCharacterImages();
  });
}

function enterEditMode() {
  const list = document.getElementById('rankings-list');
  list.classList.add('editable');
  document.getElementById('editRankBtn').textContent = '💾 Save My Ranking';
  setupDragDrop(list);
}

function exitEditMode() {
  const list = document.getElementById('rankings-list');
  list.classList.remove('editable');
  document.getElementById('editRankBtn').textContent = '✏️ Customize My Ranking';

  const names = [...list.querySelectorAll('.ranking-item[data-name]')]
    .map(el => el.getAttribute('data-name'));
  localStorage.setItem('my_ranking', JSON.stringify(names));
  document.getElementById('resetRankBtn').style.display = '';

  // Refresh rank numbers and medals
  list.querySelectorAll('.ranking-item').forEach((item, i) => {
    const rankEl = item.querySelector('.rank-number');
    if (!rankEl) return;
    rankEl.className = `rank-number ${getRankClass(i + 1)}`;
    const medal = getMedal(i + 1);
    rankEl.textContent = medal !== null ? medal : '#' + (i + 1);
  });
}

function setupDragDrop(list) {
  let draggedEl = null;

  list.querySelectorAll('.ranking-item').forEach(item => {
    item.setAttribute('draggable', 'true');

    item.addEventListener('dragstart', e => {
      draggedEl = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      list.querySelectorAll('.drag-target').forEach(el => el.classList.remove('drag-target'));
      draggedEl = null;
    });

    item.addEventListener('dragover', e => {
      e.preventDefault();
      if (!draggedEl || item === draggedEl) return;
      list.querySelectorAll('.drag-target').forEach(el => el.classList.remove('drag-target'));
      item.classList.add('drag-target');
      const rect = item.getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) {
        list.insertBefore(draggedEl, item);
      } else {
        list.insertBefore(draggedEl, item.nextSibling);
      }
    });
  });
}

// ── AniList Image Loading ──────────────────────────────────

function applyImage(card, url) {
  const img = card.querySelector('img');
  if (!img) return;
  img.onload = () => {
    img.style.display = '';
    card.querySelectorAll('.card-image-placeholder, .ranking-thumb-placeholder')
      .forEach(el => el.style.display = 'none');
  };
  img.src = url;
}

async function loadCharacterImages() {
  const cards = Array.from(document.querySelectorAll('[data-name]'))
    .filter(card => {
      const img = card.querySelector('img');
      return img && img.getAttribute('src') === '';
    });
  if (!cards.length) return;

  const pending = [];
  for (const card of cards) {
    const name = card.getAttribute('data-name');
    const cached = imageCache[name];
    if (cached) {
      applyImage(card, cached); // instant — no API call needed
    } else {
      pending.push(card);
    }
  }

  // Fetch uncached images 5 at a time so they load in parallel batches.
  const BATCH = 5;
  for (let i = 0; i < pending.length; i += BATCH) {
    await Promise.all(
      pending.slice(i, i + BATCH).map(async card => {
        const name = card.getAttribute('data-name');
        try {
          const url = await fetchAniListImage(name);
          if (url) applyImage(card, url);
        } catch {}
      })
    );
    // Brief pause between batches to stay within AniList's 90 req/min limit.
    if (i + BATCH < pending.length) await new Promise(r => setTimeout(r, 400));
  }
}

async function fetchAniListImage(name) {
  if (imageCache[name]) return imageCache[name]; // only cache hits on real URLs

  const override = anilistNameOverrides[name];
  let url = await queryAniList(override || name);
  if (!url && override) url = await queryAniList(name);

  if (url) {
    imageCache[name] = url;
    try { localStorage.setItem('anilist_cache', JSON.stringify(imageCache)); }
    catch {}
  }
  return url;
}

async function queryAniList(searchName, retries = 1) {
  try {
    const query = `query ($name: String) { Character(search: $name) { image { large } } }`;
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { name: searchName } }),
    });
    if (res.status === 429 && retries > 0) {
      const wait = Math.min(parseInt(res.headers.get('Retry-After') || '10') * 1000, 20000);
      await new Promise(r => setTimeout(r, wait));
      return queryAniList(searchName, retries - 1);
    }
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.Character?.image?.large ?? null;
  } catch {
    return null;
  }
}

// ── Helpers ────────────────────────────────────────────────

function getPowerClass(level) {
  const map = { 'S+': 's-plus', 'S': 's', 'A+': 'a-plus', 'A': 'a', '∞': 'infinity' };
  return map[level] || 's';
}

function getRankClass(rank) {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  return 'default';
}

function getMedal(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return null;
}

function getCharacterEmoji(name) {
  const map = {
    'Naruto Uzumaki':     '🦊',
    'Goku':               '⚡',
    'Monkey D. Luffy':    '🏴‍☠️',
    'Saitama':            '👊',
    'Levi Ackerman':      '⚔️',
    'Itachi Uchiha':      '👁️',
    'Edward Elric':       '⚗️',
    'Vegeta':             '👑',
    'Roronoa Zoro':       '🗡️',
    'Sasuke Uchiha':      '🔥',
    'Kakashi Hatake':     '🥷',
    'Izuku Midoriya':     '💪',
    'Light Yagami':       '📓',
    'Natsume Takashi':    '📕',
    'Ginko':              '🌿',
    'Holo':               '🐺',
    'Yato':               '⛩️',
    'Rei Kiriyama':       '♟️',
    'Gojo Satoru':        '🔵',
    'Tanjiro Kamado':     '💧',
    'Nezuko Kamado':      '🌸',
    'Ryomen Sukuna':      '👹',
    'Meruem':             '🐜',
    'Muzan Kibutsuji':    '🩸',
    'Ichigo Kurosaki':    '⚔️',
    'Sosuke Aizen':       '🕸️',
    'Killua Zoldyck':     '⚡',
    'Sung Jin-Woo':       '👤',
    'Gon Freecss':        '🎣',
    'Hisoka Morow':       '🃏',
    'Kyojuro Rengoku':    '🔥',
    'Giyu Tomioka':       '💧',
    'Zenitsu Agatsuma':   '⚡',
    'Yuji Itadori':       '👊',
    'Natsu Dragneel':     '🐉',
    'Erza Scarlet':       '🛡️',
    'Shoto Todoroki':     '❄️',
    'Katsuki Bakugo':     '💥',
    'All Might':          '🦸',
    'Asta':               '⚫',
    'Lelouch vi Britannia': '♟️',
    'Ainz Ooal Gown':     '💀',
    'Trafalgar Law':      '🔪',
    'Eren Yeager':        '⛓️',
    'Mikasa Ackerman':    '🩹',
    'Rimuru Tempest':     '💧',
    'Shigeo Kageyama':    '🔮',
    'Korosensei':         '🟡',
  };
  return map[name] || '⭐';
}

// ── UI States ──────────────────────────────────────────────

function showLoading(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `
    <div class="loading">
      <div class="loading-spinner"></div>
      <span>Loading...</span>
    </div>
  `;
}

function showError(containerId, message) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">⚠️</div>
      <p>${message}</p>
    </div>
  `;
}

// ── Navigation ─────────────────────────────────────────────

function initNav() {
  const currentFile = window.location.pathname.split('/').pop() || 'index.html';

  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('href') === currentFile) link.classList.add('active');
  });

  const toggle   = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  if (toggle && navLinks) {
    toggle.addEventListener('click', () => navLinks.classList.toggle('open'));
    navLinks.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => navLinks.classList.remove('open'));
    });
  }
}
