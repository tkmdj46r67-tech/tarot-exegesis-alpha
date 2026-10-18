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

  // ---------- Jodorowsky rule engine: constants ----------

  // R2: remedy-pairs for the Major Arcana. Each card's medicine is its opposite.
  const REMEDY_PAIRS = {
    fool: 'world',
    magician: 'priestess',
    priestess: 'magician',
    empress: 'emperor',
    emperor: 'empress',
    hierophant: 'devil',
    lovers: 'devil',
    chariot: 'strength',
    strength: 'chariot',
    hermit: 'lovers',
    wheel: 'justice',
    justice: 'wheel',
    hangedman: 'magician',
    death: 'star',
    temperance: 'devil',
    devil: 'hierophant',
    tower: 'star',
    star: 'tower',
    moon: 'sun',
    sun: 'moon',
    judgement: 'fool',
    world: 'fool'
  };

  // R4: suit as discipline — the remedy for any Minor Arcana card.
  const SUIT_REMEDY = {
    cups: 'Give the feeling a container: name it, hold it, and do not let it flood the whole room.',
    swords: 'Cut through: ask the single clarifying question that makes the next step obvious.',
    wands: 'Act before the spark fades: take one concrete step toward the thing that excites you.',
    pentacles: 'Ground it: make the smallest material commitment — a date, a deposit, a first draft.'
  };

  // R5: the act — concrete, embodied, imperative. Selected by suit and orientation.
  const ACTS = {
    major: {
      upright: (card) => `Do one thing today that belongs to ${card.keywords.upright[0]}, and nothing else.`,
      reversed: (card) => `Name what you have been refusing to see about ${card.keywords.reversed[0]}, and write it down once.`
    },
    cups: {
      upright: () => 'Say the feeling aloud to someone safe, before it becomes a mood.',
      reversed: () => 'Let one feeling arrive without immediately explaining it away.'
    },
    swords: {
      upright: () => 'Write the question you have been circling, and answer it in one sentence.',
      reversed: () => 'Stop gathering more information. Decide with what you already have.'
    },
    wands: {
      upright: () => 'Take the first step before you feel ready. The readiness follows.',
      reversed: () => 'Put the spark down for one day, and see whether it is still warm tomorrow.'
    },
    pentacles: {
      upright: () => 'Make one small, material commitment today — a booking, a payment, a first line.',
      reversed: () => 'Let go of one thing you are holding only because you are afraid to lose it.'
    }
  };

  // ---------- State ----------
  let cards = [];
  const CARD_BY_ID = new Map();

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
  const getCard = (id) => CARD_BY_ID.get(id);

  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // ---------- Jodorowsky rule engine: functions ----------

  /**
   * Step 5 for a single card.
   * Applies R1 (name the energy), R2 or R4 (identify the remedy), R5 (phrase the act).
   */
  function jodorowskyTipForCard(drawItem) {
    const { card, reversed } = drawItem;
    const orient = reversed ? 'reversed' : 'upright';

    // R1 — name the energy.
    const energy = `${card.name}${reversed ? ' reversed' : ''} carries the energy of ${card.keywords[orient][0]}.`;

    // R2 (Major) or R4 (Minor) — identify the remedy.
    let remedy;
    let remedyName;
    if (card.suit === 'major') {
      const remedyId = REMEDY_PAIRS[card.id];
      const remedyCard = remedyId ? getCard(remedyId) : null;
      remedyName = remedyCard ? remedyCard.name : 'its opposite';
      remedy = `The remedy is ${remedyName}: ${remedyCard ? remedyCard.keywords.upright[0] : 'the opposite energy'}.`;
    } else {
      remedyName = card.suit.charAt(0).toUpperCase() + card.suit.slice(1);
      remedy = SUIT_REMEDY[card.suit];
    }

    // R5 — phrase the act.
    const suitKey = card.suit === 'major' ? 'major' : card.suit;
    const act = ACTS[suitKey][orient](card);

    return {
      energyLine: `${energy} ${remedy}`,
      actLine: act,
      remedyName
    };
  }

  /**
   * Step 5 for the spread as a whole.
   * Applies R3 (the pair) — first checking remedy-pairs, then suit-families,
   * and falling back to a synthesis question.
   * Returns null for a single-card spread (the per-card tip is the whole tip).
   */
  function jodorowskyTipForSpread(draw) {
    if (draw.length < 2) return null;

    // R3a — remedy-pairs among the majors.
    for (let i = 0; i < draw.length; i++) {
      for (let j = i + 1; j < draw.length; j++) {
        const a = draw[i].card;
        const b = draw[j].card;
        if (a.suit === 'major' && b.suit === 'major' && REMEDY_PAIRS[a.id] === b.id) {
          return {
            synthesis: `${a.name} and ${b.name} form a remedy-pair: each is the medicine for the other's excess. The spread is not asking you to choose between them, but to hold both.`,
            act: `When you notice yourself in ${a.name}, deliberately invite one gesture from ${b.name} — and vice versa.`
          };
        }
      }
    }

    // R3b — suit-family dominance.
    const suitCounts = {};
    draw.forEach((d) => { suitCounts[d.card.suit] = (suitCounts[d.card.suit] || 0) + 1; });
    const dominant = Object.entries(suitCounts).sort((a, b) => b[1] - a[1])[0];
    if (dominant && dominant[1] >= 2) {
      const suit = dominant[0];
      if (suit === 'major') {
        return {
          synthesis: 'The spread leans on the Major Arcana: the reading is dominated by archetypal energy. What is at stake is not a tactic but a whole disposition.',
          act: 'Sit with the images rather than decoding them. Ask each one: what does it want from me, not what does it mean?'
        };
      }
      return {
        synthesis: `The spread leans on ${suit}: the reading is dominated by ${suit === 'cups' ? 'emotional' : suit === 'swords' ? 'mental' : suit === 'wands' ? 'volitional' : 'material'} energy.`,
        act: SUIT_REMEDY[suit]
      };
    }

    // R3c — fall back to a synthesis question.
    const names = draw.map((d) => d.card.name).join(', ');
    return {
      synthesis: `The cards (${names}) do not form an obvious remedy-pair or suit-family. The reading is a juxtaposition, not a prescription.`,
      act: 'Ask: what would have to be true for all of these cards to be valid at once?'
    };
  }

  // ---------- Load data ----------
  async function load() {
    const res = await fetch('cards.json');
    if (!res.ok) throw new Error('Failed to load cards.json');
    cards = await res.json();
    cards.forEach((c) => CARD_BY_ID.set(c.id, c));
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

    maybeFinishReveal();
  }

  function revealAll() {
    state.draw.forEach((_, i) => revealSlot(i));
  }

  function maybeFinishReveal() {
    const revealedCount = $$('.card-slot.revealed').length;
    if (revealedCount < state.draw.length) return;

    const btn = $('#reveal-all');
    if (btn) btn.hidden = true;

    if ($('.overall-tip')) return;
    const overall = jodorowskyTipForSpread(state.draw);
    if (!overall) return;

    const el = document.createElement('div');
    el.className = 'overall-tip';
    el.innerHTML = `
      <section class="derivation-section step5">
        <h4><span class="step">Step 5</span>The Spread as a Whole</h4>
        <p class="reading-text">${esc(overall.synthesis)}</p>
        <p class="tip-act"><span class="arrow">→</span> ${esc(overall.act)}</p>
      </section>
    `;
    $('#derivations').appendChild(el);
  }

  function buildDerivation(d, i) {
    const spread = SPREADS[state.spread];
    const pos = spread.positions[i];
    const orient = d.reversed ? 'reversed' : 'upright';
    const tip = jodorowskyTipForCard(d);

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
        <section class="derivation-section step5">
          <h4><span class="step">Step 5</span>The Jodorowsky Tip</h4>
          <p class="reading-text">${esc(tip.energyLine)}</p>
          <p class="tip-act"><span class="arrow">→</span> ${esc(tip.actLine)}</p>
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
    const card = getCard(id);
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
