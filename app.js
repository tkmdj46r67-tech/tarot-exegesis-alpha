(() => {
  'use strict';

  const IMG_BASE = 'https://commons.wikimedia.org/wiki/Special:FilePath/';
  const img = (file, width = 500) => `${IMG_BASE}${file}?width=${width}`;

  const SPREADS = {
    one: {
      name: 'One card',
      positions: [
        { name: 'The card', frame: 'The card answers the question directly — the single figure that speaks to the whole of what you asked.' }
      ]
    },
    three: {
      name: 'Three card',
      positions: [
        { name: 'Past',   frame: 'What has already happened — the circumstances, choices or feelings that brought you to now.' },
        { name: 'Present', frame: 'What is — the current situation, its tensions, its raw material.' },
        { name: 'Future',  frame: 'What is tending — the direction the present is moving in, not fixed, but visible.' }
      ]
    }
  };

  const SUIT_SUBTITLE = {
    major: 'Major Arcana',
    wands: 'Wands',
    cups: 'Cups',
    swords: 'Swords',
    pentacles: 'Pentacles'
  };

  let cards = [];
  const state = {
    spread: 'one',
    reversals: false,
    question: '',
    draw: [] // [{ card, reversed }]
  };

  // ---------- Utilities ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const subtitle = (c) => `${SUIT_SUBTITLE[c.suit]} · ${c.number}`;

  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // ---------- Load data ----------
  async function load() {
    const res = await fetch('cards.json');
    if (!res.ok) throw new Error('Failed to load cards.json');
    cards = await res.json();
    renderLibrary();
  }

  // ---------- Reading flow ----------
  function deal() {
    state.spread = $('input[name="spread"]:checked').value;
    state.reversals = $('#reversals').checked;
    state.question = $('#question').value.trim();

    const spread = SPREADS[state.spread];
    const deck = shuffle(cards).slice(0, spread.positions.length);
    state.draw = deck.map((card) => ({
      card,
      reversed: state.reversals && Math.random() < 0.4
    }));

    renderReading();
    $('#read-form').hidden = true;
    $('#reading').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderReading() {
    const spread = SPREADS[state.spread];
    const r = $('#reading');

    r.innerHTML = `
      <div class="reading-question">${state.question ? `“${esc(state.question)}”` : ''}</div>
      <div class="spread">
        ${state.draw.map((d, i) => `
          <div class="card-slot ${d.reversed ? 'reversed' : ''}" data-index="${i}">
            <div class="card-frame">
              <div class="card-back">✦</div>
              <div class="card-face">
                <img src="${img(d.card.image, 500)}" alt="${esc(d.card.name)}" loading="lazy">
              </div>
            </div>
            <div class="position-label">${esc(spread.positions[i].name)}</div>
          </div>
        `).join('')}
      </div>
      <button class="reveal-all-btn" id="reveal-all">Reveal all readings</button>
      <div class="derivations" id="derivations"></div>
      <button class="reveal-all-btn" id="new-reading" style="margin-top:8px;">New reading</button>
    `;

    $$('.card-slot').forEach((slot) => {
      slot.addEventListener('click', () => revealSlot(Number(slot.dataset.index)));
    });
    $('#reveal-all').addEventListener('click', revealAll);
    $('#new-reading').addEventListener('click', reset);
  }

  function revealSlot(i) {
    const slot = $(`.card-slot[data-index="${i}"]`);
    if (!slot || slot.classList.contains('revealed')) return;
    slot.classList.add('revealed');
    const derivations = $('#derivations');
    const existing = derivations.querySelector(`[data-index="${i}"]`);
    if (!existing) derivations.appendChild(buildDerivation(state.draw[i], i));
  }

  function revealAll() {
    state.draw.forEach((_, i) => revealSlot(i));
    $('#reveal-all').hidden = true;
  }

  function buildDerivation(d, i) {
    const spread = SPREADS[state.spread];
    const pos = spread.positions[i];
    const orient = d.reversed ? 'reversed' : 'upright';
    const article = document.createElement('article');
    article.className = 'derivation' + (d.reversed ? ' rev' : '');
    article.dataset.index = i;
    article.innerHTML = `
      <div class="derivation-header">
        <div class="derivation-thumb">
          <img src="${img(d.card.image, 200)}" alt="${esc(d.card.name)}" loading="lazy">
        </div>
        <div class="derivation-title">
          <h3>${esc(d.card.name)} <span class="orientation-badge ${orient}">${orient}</span></h3>
          <div class="meta">
            <span class="pos">${esc(pos.name)}</span>
            <span class="sep">·</span>
            <span>${esc(subtitle(d.card))}</span>
          </div>
        </div>
      </div>
      <div class="derivation-body">
        <section class="derivation-section">
          <h4><span class="step">Step 1</span>Keywords for this orientation</h4>
          <div class="keywords-row">
            ${d.card.keywords[orient].map((k) => `<span class="kw">${esc(k)}</span>`).join('')}
          </div>
        </section>
        <section class="derivation-section">
          <h4><span class="step">Step 2</span>What is actually drawn on the card</h4>
          <ul class="symbols-list">
            ${d.card.symbols.map((s) => `<li>${esc(s)}</li>`).join('')}
          </ul>
        </section>
        <section class="derivation-section">
          <h4><span class="step">Step 3</span>The reading that follows from the above</h4>
          <p class="reading-text">${esc(d.card.reading[orient])}</p>
        </section>
        <section class="derivation-section">
          <h4><span class="step">Step 4</span>How it sits in the ${esc(pos.name)} position</h4>
          <p class="position-note">${esc(pos.frame)}</p>
        </section>
      </div>
    `;
    return article;
  }

  function reset() {
    $('#read-form').hidden = false;
    $('#reading').hidden = true;
    $('#reading').innerHTML = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- Library ----------
  function renderLibrary() {
    const filter = $('#lib-filter').value;
    const q = $('#lib-search').value.trim().toLowerCase();
    const grid = $('#library-grid');

    const filtered = cards.filter((c) => {
      if (filter !== 'all' && c.suit !== filter) return false;
      if (!q) return true;
      const hay = (c.name + ' ' + c.keywords.upright.join(' ') + ' ' + c.keywords.reversed.join(' ')).toLowerCase();
      return hay.includes(q);
    });

    grid.innerHTML = filtered.map((c) => `
      <div class="lib-card" data-id="${esc(c.id)}">
        <div class="thumb"><img src="${img(c.image, 300)}" alt="${esc(c.name)}" loading="lazy"></div>
        <div class="name">${esc(c.name)}</div>
      </div>
    `).join('');

    grid.querySelectorAll('.lib-card').forEach((el) => {
      el.addEventListener('click', () => openCard(el.dataset.id));
    });
  }

  function openCard(id) {
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    const body = $('#modal-body');
    body.innerHTML = `
      <div class="derivation-header">
        <div class="derivation-thumb">
          <img src="${img(card.image, 300)}" alt="${esc(card.name)}">
        </div>
        <div class="derivation-title">
          <h3>${esc(card.name)}</h3>
          <div class="meta"><span>${esc(subtitle(card))}</span></div>
        </div>
      </div>
      <div class="derivation-body">
        <section class="derivation-section">
          <h4>Keywords — Upright</h4>
          <div class="keywords-row">${card.keywords.upright.map((k) => `<span class="kw">${esc(k)}</span>`).join('')}</div>
        </section>
        <section class="derivation-section">
          <h4>Keywords — Reversed</h4>
          <div class="keywords-row">${card.keywords.reversed.map((k) => `<span class="kw">${esc(k)}</span>`).join('')}</div>
        </section>
        <section class="derivation-section">
          <h4>What is actually drawn on the card</h4>
          <ul class="symbols-list">${card.symbols.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
        </section>
        <section class="derivation-section">
          <h4>The reading — Upright</h4>
          <p class="reading-text">${esc(card.reading.upright)}</p>
        </section>
        <section class="derivation-section">
          <h4>The reading — Reversed</h4>
          <p class="reading-text">${esc(card.reading.reversed)}</p>
        </section>
      </div>
    `;
    $('#modal').hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    $('#modal').hidden = true;
    document.body.style.overflow = '';
  }

  // ---------- Nav ----------
  function switchView(view) {
    $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === `${view}-view`));
    if (view === 'library') renderLibrary();
  }

  // ---------- Wiring ----------
  document.addEventListener('DOMContentLoaded', () => {
    $('#deal-btn').addEventListener('click', deal);
    $$('.nav-btn').forEach((b) => b.addEventListener('click', () => switchView(b.dataset.view)));
    $('#lib-search').addEventListener('input', renderLibrary);
    $('#lib-filter').addEventListener('change', renderLibrary);
    $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
    $('.modal-close').addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

    load().catch((err) => {
      console.error(err);
      document.getElementById('read-form').innerHTML =
        '<p style="color:#c88;">Could not load <code>cards.json</code>. Serve this page over HTTP (not <code>file://</code>) — GitHub Pages will do this automatically.</p>';
    });
  });
})();