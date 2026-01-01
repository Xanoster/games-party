const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
const socket = new WebSocket(wsUrl);

const el = (id) => document.getElementById(id);

// Session persistence helpers
const SESSION_KEY = 'partyGamesSession';

const saveSession = () => {
  const session = {
    roomCode: state.roomCode,
    name: state.name,
    isHost: state.hostId === state.clientId,
    timestamp: Date.now()
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
};

const getSession = () => {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    if (!data) return null;
    const session = JSON.parse(data);
    // Expire sessions older than 24 hours
    if (Date.now() - session.timestamp > 24 * 60 * 60 * 1000) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
};
const state = {
  clientId: null,
  name: '',
  roomCode: '',
  hostId: '',
  joinUrl: '',
  players: [],
  currentGame: 'truth',
  settings: { gameId: 'truth', theme: 'classic' },
  showGrid: false,
  qr: null,
  timers: {},
  truth: { category: 'Soft', round: null, exposeVotes: {}, exposeOpen: false },
  nhi: { round: null, votes: {} },
  likely: { round: null, votes: {} },
  spy: { round: null, votes: {} },
  usedPrompts: {},
};

const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const games = [
  { id: 'truth', label: 'Truth or Dare', blurb: 'Bottle spin, expose votes, timer and punish.', tags: ['Social', 'High chaos'] },
  { id: 'nhi', label: 'Never Have I Ever', blurb: 'Secret taps. Reveal together with counters.', tags: ['Quick', 'Tension'] },
  { id: 'likely', label: "Who's Most Likely", blurb: 'Silent votes. Bar tally. Call-outs.', tags: ['Callout', 'Votes'] },
  { id: 'spy', label: 'Impostor / Spy', blurb: 'Hidden spy. Location word. Vote them out.', tags: ['Hidden role'] },
];

const truthPrompts = {
  truth: {
    Soft: [
      'What is your most overused emoji?',
      'What is a harmless secret you never told?',
      'Who here do you text the most?',
      'What is your pettiest opinion?',
    ],
    Spicy: [
      'Who was your last late-night text?',
      'What is the boldest DM you ever sent?',
      'Who in this circle would you date?',
      'What is a fantasy you have not shared?',
    ],
    Brutal: [
      'What do you dislike about the person on your left?',
      'What is your most recent lie?',
      'Which friend has the worst taste?',
      'When did you ghost someone?',
    ],
    'Friends-only': [
      'Who keeps the worst secrets in this group?',
      'Who is always late and why?',
      'What did you judge someone here for?',
      'What is the group drama you never confessed?',
    ],
  },
  dare: {
    Soft: [
      'Speak in movie quotes for 1 minute.',
      'Do a dramatic slow clap for someone.',
      'Tell a joke and commit to it.',
      'Swap seats with someone for the round.',
    ],
    Spicy: [
      'Read your last 3 emojis aloud.',
      'Let the group change your status for 10 minutes.',
      'Record a 10-second voice note to someone.',
      'Share the last photo you saved.',
    ],
    Brutal: [
      'Let the group scroll 10 seconds in your gallery.',
      'Do 15 pushups or 20 squats.',
      'Call someone and compliment them weirdly.',
      'Let someone rewrite one of your bios.',
    ],
    'Friends-only': [
      'Do an impression of someone here.',
      'Roast yourself for 20 seconds.',
      'Let the group set a timer and you must hype each person.',
      'Try to convince everyone you are an alien.',
    ],
  },
};

const themeTruthPrompts = {
  party: {
    truth: {
      Soft: ['Who would you drunk text tonight?', 'What is your go-to hype song?', 'Who is the best wingperson here?'],
      Spicy: ['Whose DMs here are you most curious about?', 'What nearly got you kicked out of a party?', 'Who here gives the best hugs and why?'],
      Brutal: ['Who kills the vibe fastest?', 'Who should never control the aux?', 'What was your worst date and why was it your fault?'],
      'Friends-only': ['What trip here was actually mid?', 'Who overreacts in group chat?', 'Who owes the group an apology and for what?'],
    },
    dare: {
      Soft: ['Sing the chorus of your hype song.', 'Let someone set your ringtone right now.', 'Do a 10s DJ drop intro.'],
      Spicy: ['Let someone send a sticker from your keyboard.', 'Do a thirst-trap pose for 5s.', 'Show your last three searches.'],
      Brutal: ['Shot counter: do 10 squats with rhythm.', 'Let the group pick an Insta story text (no posting).', 'Call someone and sell them a random object nearby.'],
      'Friends-only': ['Hand your phone for 15s scroll (no DMs).', 'Perform a roast rap of the host.', 'Swap seats with the loudest person.'],
    },
  },
  'after-dark': {
    truth: {
      Soft: ['What is your safest kink curiosity?', 'Who here gives off "red flag but I like it" energy?', 'When did you last get butterflies?'],
      Spicy: ['Describe a fantasy in five words.', 'Who would you kiss here if no fallout?', 'What is your most chaotic 2am decision?'],
      Brutal: ['Who here should never date you and why?', 'What is your worst kept secret about intimacy?', 'When did you fake a feeling?'],
      'Friends-only': ['Who in this room is underrated?', 'What rumor about you was true?', 'Who here intimidates you and why?'],
    },
    dare: {
      Soft: ['Read your last voice note title aloud.', 'Describe your last dream PG-13 style.', 'Let group pick an emoji to send to a trusted friend.'],
      Spicy: ['Show the third app in your swipe-up bar.', 'Let someone craft a flirty opener (do not send).', 'Do a 10s dramatic stare-off with someone.'],
      Brutal: ['Reveal a red flag you ignored.', 'Let someone scroll 5s in a chat list.', 'Whisper your most recent intrusive thought to the host.'],
      'Friends-only': ['Reveal a saved draft DM (no send).', 'Let group rename a contact for 10 minutes.', 'Narrate your last date like a sports commentator.'],
    },
  },
};

const nhiStatements = [
  'Never have I ever drunk texted an ex.',
  'Never have I ever lied to get out of plans.',
  'Never have I ever snooped through a phone.',
  'Never have I ever cried in public recently.',
  'Never have I ever dated two people at once.',
  'Never have I ever forgotten someone’s birthday.',
];

const likelyQuestions = [
  'Who is most likely to forget their passport?',
  'Who is most likely to bail last minute?',
  'Who is most likely to go viral for something weird?',
  'Who is most likely to start a company?',
  'Who is most likely to move countries first?',
  'Who is most likely to text an ex tonight?',
];

const spyWords = [
  'Airport', 'Cinema', 'Library', 'Arcade', 'Rooftop', 'Beach', 'Museum', 'Coffee shop', 'Supermarket', 'Gym'
];

const aiSuggestPrompts = (theme, gameId, mode) => {
  // Placeholder for AI prompt sourcing; returns themed filler lines.
  const tag = theme === 'after-dark' ? 'After Dark' : theme === 'party' ? 'Party' : 'Classic';
  return [`${tag} ${gameId} spark #${Math.floor(Math.random() * 999)}`];
};

const themedTruthList = (mode, category) => {
  const theme = state.settings.theme;
  const base = truthPrompts[mode][category] || [];
  const themeExtras = themeTruthPrompts[theme]?.[mode]?.[category] || [];
  const ai = aiSuggestPrompts(theme, 'truth', mode);
  return [...base, ...themeExtras, ...ai];
};

const renderTabs = () => {
  const tabs = el('gameTabs');
  if (!tabs) return;
  tabs.innerHTML = '';
  games.forEach((g) => {
    const btn = document.createElement('div');
    btn.className = `tab ${state.currentGame === g.id ? 'active' : ''}`;
    btn.textContent = `${g.icon} ${g.label}`;
    btn.onclick = () => {
      state.currentGame = g.id;
      renderGame();
    };
    tabs.appendChild(btn);
  });
};

// Enhanced games array with icons
const gamesEnhanced = [
  { id: 'truth', label: 'Truth or Dare', icon: '🎯', blurb: 'Spin the bottle, answer honestly or face a dare!', tags: ['Social', 'Classic'] },
  { id: 'nhi', label: 'Never Have I Ever', icon: '🙈', blurb: 'Reveal secrets. Tap if you did it.', tags: ['Quick', 'Revealing'] },
  { id: 'likely', label: "Who's Most Likely", icon: '👆', blurb: 'Vote anonymously. Call people out.', tags: ['Voting', 'Fun'] },
  { id: 'spy', label: 'Spy / Impostor', icon: '🕵️', blurb: 'One spy, one secret word. Find them.', tags: ['Deception', 'Strategy'] },
];

// Toast notification system
const showToast = (message, type = 'info') => {
  const toast = el('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  // Haptic feedback on mobile
  if (type === 'success' || type === 'error') {
    navigator.vibrate?.([50]);
  }
  setTimeout(() => toast.classList.remove('show'), 3000);
};

// Light haptic feedback for button presses
const haptic = (intensity = 'light') => {
  if (!navigator.vibrate) return;
  switch (intensity) {
    case 'light': navigator.vibrate(10); break;
    case 'medium': navigator.vibrate(25); break;
    case 'heavy': navigator.vibrate([30, 20, 30]); break;
  }
};

// Keep a short memory of prompts per bucket to avoid repeats
const rememberPrompt = (bucket, prompt) => {
  if (!prompt) return;
  if (!state.usedPrompts[bucket]) state.usedPrompts[bucket] = [];
  state.usedPrompts[bucket].push(prompt);
  state.usedPrompts[bucket] = state.usedPrompts[bucket].slice(-25);
};

const pickUniquePrompt = (bucket, list) => {
  const clean = (list || []).filter(Boolean);
  if (!clean.length) return null;
  const used = new Set(state.usedPrompts[bucket] || []);
  const fresh = clean.filter((p) => !used.has(p));
  const pool = fresh.length ? fresh : clean;
  const choice = randomFrom(pool);
  rememberPrompt(bucket, choice);
  return choice;
};

const fetchAIPrompt = async ({ gameId, mode, category, bucket }) => {
  try {
    const res = await fetch('/api/ai-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameId,
        mode,
        category,
        theme: state.settings.theme,
        players: state.players,
        recent: bucket ? state.usedPrompts[bucket] || [] : [],
      }),
    });
    if (!res.ok) {
      if (res.status === 400) {
        showToast('AI prompts disabled (no API key). Using local list.', 'warning');
      }
      return null;
    }
    const data = await res.json();
    return data?.prompt || null;
  } catch (err) {
    console.error('AI prompt fetch failed', err);
    return null;
  }
};

// Enhanced status with class
const setStatus = (msg, statusClass = '') => {
  const statusEl = el('status');
  if (statusEl) {
    statusEl.textContent = msg;
    statusEl.className = `status ${statusClass}`;
  }
};

// Enhanced AI prompt generator
const generateAIPrompt = (mode, category, players) => {
  if (!players || players.length < 2) return null;
  const randomPlayer = () => players[Math.floor(Math.random() * players.length)]?.name || 'someone';
  
  const templates = {
    truth: {
      Soft: [
        `If ${randomPlayer()} had a secret talent show, what would they perform?`,
        `What would ${randomPlayer()} be famous for in 10 years?`,
        `What app do you think ${randomPlayer()} uses the most?`,
      ],
      Spicy: [
        `Who in this room would ${randomPlayer()} swipe right on?`,
        `What secret do you think ${randomPlayer()} is hiding?`,
      ],
      Brutal: [
        `What would ${randomPlayer()} never admit to the group?`,
        `Who would ${randomPlayer()} vote off the island first?`,
      ],
      'Friends-only': [
        `What is ${randomPlayer()}'s most predictable behavior?`,
        `Who would ${randomPlayer()} call for bail money at 3am?`,
      ],
    },
    dare: {
      Soft: [
        `Do your best impression of ${randomPlayer()}.`,
        `Give ${randomPlayer()} a genuine compliment.`,
      ],
      Spicy: [
        `Demonstrate how you think ${randomPlayer()} flirts.`,
        `Tell ${randomPlayer()} what you first thought when you met them.`,
      ],
      Brutal: [
        `Roast ${randomPlayer()} for 30 seconds straight.`,
        `Tell ${randomPlayer()} a hard truth they need to hear.`,
      ],
      'Friends-only': [
        `Recreate ${randomPlayer()}'s signature pose.`,
        `Rate ${randomPlayer()}'s fashion sense.`,
      ],
    },
  };
  
  const modeTemplates = templates[mode];
  if (modeTemplates && modeTemplates[category]) {
    const arr = modeTemplates[category];
    return arr[Math.floor(Math.random() * arr.length)];
  }
  return null;
};

// Enhanced themed truth list with AI
const themedTruthListEnhanced = (mode, category) => {
  const theme = state.settings.theme;
  const base = truthPrompts[mode]?.[category] || [];
  const themeExtras = themeTruthPrompts[theme]?.[mode]?.[category] || [];
  const aiPrompt = generateAIPrompt(mode, category, state.players);
  
  const allPrompts = [...base, ...themeExtras];
  if (aiPrompt && Math.random() > 0.5) {
    allPrompts.push(aiPrompt);
  }
  return allPrompts;
};

const renderGameGrid = () => {
  const grid = el('gameGrid');
  if (!grid) return;
  const isHost = state.hostId === state.clientId;
  grid.style.display = isHost && state.showGrid ? 'grid' : 'none';
  grid.innerHTML = '';
  
  // Use enhanced games with icons
  const gameList = gamesEnhanced.length ? gamesEnhanced : games;
  
  gameList.forEach((g) => {
    const card = document.createElement('div');
    card.className = 'game-card';
    card.style.cursor = isHost ? 'pointer' : 'not-allowed';
    card.innerHTML = `
      <h4>${g.icon || ''} ${g.label}</h4>
      <p>${g.blurb}</p>
      <div class="tag">${g.tags.join(' · ')}</div>
    `;
    if (isHost) {
      const select = () => {
        if (!state.roomCode) return;
        state.settings.gameId = g.id;
        state.currentGame = g.id;
        send('set-settings', { gameId: g.id });
        state.showGrid = false;
        showToast(`🎮 Switched to ${g.label}`);
        renderCurrent();
      };
      card.onclick = select;
      card.onkeypress = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          select();
        }
      };
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `Select ${g.label}`);
    } else {
      card.classList.add('disabled');
    }
    if (state.settings.gameId === g.id) {
      const badge = document.createElement('div');
      badge.className = 'badge active-badge';
      badge.textContent = 'Now';
      card.appendChild(badge);
    }
    grid.appendChild(card);
  });
};

const renderCurrent = () => {
  const gameList = gamesEnhanced.length ? gamesEnhanced : games;
  const meta = gameList.find((g) => g.id === state.settings.gameId) || gameList[0];
  state.currentGame = meta.id;
  const title = el('currentTitle');
  const blurb = el('currentBlurb');
  if (title) title.textContent = `${meta.icon || ''} ${meta.label}`;
  if (blurb) blurb.textContent = meta.blurb;
  const badges = el('gameBadges');
  if (badges) {
    badges.innerHTML = '';
    const themeNames = { classic: '🎲 Classic', party: '🎉 Party', 'after-dark': '🔥 18+' };
    const tag = document.createElement('span');
    tag.className = 'badge';
    tag.textContent = themeNames[state.settings.theme] || state.settings.theme;
    badges.appendChild(tag);
    if (state.hostId === state.clientId) {
      const hostBadge = document.createElement('span');
      hostBadge.className = 'badge host-badge';
      hostBadge.textContent = '👑 Host';
      badges.appendChild(hostBadge);
    }
  }
  const themeSelect = el('themeSelect');
  if (themeSelect) {
    themeSelect.value = state.settings.theme;
    themeSelect.disabled = state.hostId !== state.clientId;
  }
  const switchBtn = el('switchGame');
  if (switchBtn) {
    const isHost = state.hostId === state.clientId;
    switchBtn.hidden = !isHost;
    switchBtn.onclick = () => {
      if (!isHost) return;
      state.showGrid = true;
      renderGameGrid();
      renderCurrent();
    };
  }
  renderGame();
};

const updateRoomUI = () => {
  if (!state.roomCode) return;
  const isHost = state.hostId === state.clientId;
  el('room-card').hidden = false;
  el('control-card').hidden = !isHost;
  el('current-card').hidden = false;
  el('roomCode').textContent = state.roomCode;
  el('hostTag').textContent = isHost ? '👑 You are the host' : '🎮 Following host controls';
  
  // Show home button when in a room
  el('homeBtn').hidden = false;
  
  // Update player count
  const playerCount = el('playerCount');
  if (playerCount) playerCount.textContent = state.players.length;
  
  const qrBlock = el('qrBlock');
  const qrHint = el('qrHint');
  const roomHeader = el('roomHeader');
  const playerRoomInfo = el('playerRoomInfo');
  const playersSection = el('playersSection');
  const roomCodeSmall = el('roomCodeSmall');
  const leaveBtn = el('leaveBtn');
  const leaveBtnSmall = el('leaveBtnSmall');
  
  // Host sees full header with QR, players see minimal badge
  if (isHost) {
    if (roomHeader) {
      roomHeader.hidden = false;
      roomHeader.style.display = 'flex';
    }
    if (qrBlock) {
      qrBlock.hidden = false;
      qrBlock.style.display = 'flex';
    }
    if (playerRoomInfo) {
      playerRoomInfo.hidden = true;
      playerRoomInfo.style.display = 'none';
    }
    if (playersSection) playersSection.style.display = 'block';
    if (leaveBtn) leaveBtn.style.display = 'inline-block';
    
    // Generate QR for host - always use current origin for correct URL
    if (qrBlock && qrHint) {
      const qrTarget = `${location.origin}/?room=${state.roomCode}`;
      if (!state.qr) {
        state.qr = new QRCode(el('qr'), {
          text: qrTarget,
          width: 140,
          height: 140,
          colorDark: '#79ffd6',
          colorLight: '#0b0d10',
          correctLevel: QRCode.CorrectLevel.M,
        });
      } else {
        state.qr.clear();
        state.qr.makeCode(qrTarget);
      }
      qrHint.textContent = 'Scan to join instantly';
    }
  } else {
    // Players see minimal room info - just a badge with inline leave
    if (roomHeader) {
      roomHeader.hidden = true;
      roomHeader.style.display = 'none';
    }
    if (qrBlock) {
      qrBlock.hidden = true;
      qrBlock.style.display = 'none';
    }
    if (playerRoomInfo) {
      playerRoomInfo.hidden = false;
      playerRoomInfo.style.display = 'flex';
    }
    if (roomCodeSmall) roomCodeSmall.textContent = state.roomCode;
    if (playersSection) playersSection.style.display = 'none';
    if (leaveBtn) leaveBtn.style.display = 'none';
  }
  
  const list = el('playerList');
  list.innerHTML = '';
  state.players.forEach((p) => {
    const li = document.createElement('li');
    li.textContent = p.name;
    if (p.isHost) {
      const badge = document.createElement('span');
      badge.className = 'badge host-badge';
      badge.textContent = '👑 Host';
      li.appendChild(badge);
    }
    if (p.id === state.clientId) {
      const badge = document.createElement('span');
      badge.className = 'badge you-badge';
      badge.textContent = '⭐ You';
      li.appendChild(badge);
    }
    list.appendChild(li);
  });
};

const send = (type, payload) => socket.send(JSON.stringify({ type, payload }));
const relay = (payload) => send('relay', payload);

const SPIN_MS = 8000;

const playBottleSpin = (round) => {
  const bottle = el('bottle');
  if (!bottle || !round) return;
  const start = round.spinStart ?? 0;
  const turns = round.spinTurns ?? 1800;
  bottle.style.setProperty('--spin-start', `${start}deg`);
  bottle.style.setProperty('--spin-turns', `${turns}deg`);
  bottle.classList.remove('spin');
  void bottle.offsetWidth; // force reflow
  bottle.classList.add('spin');
  state.truth.spinDeg = (start + turns) % 360;
};

const renderTruth = () => {
  const container = el('gameContainer');
  const round = state.truth.round;
  const showPrompt = !state.truth.spinning;
  const isHost = state.hostId === state.clientId;
  const isSelected = round && state.clientId === round.targetId;
  const hasChosen = round && round.mode; // True if player has picked Truth or Dare
  
  container.innerHTML = `
    <div class="game-panel stack">
      <div class="flex">
        <div class="chip ${state.truth.category === 'Soft' ? 'active' : ''}" data-cat="Soft">😊 Soft</div>
        <div class="chip ${state.truth.category === 'Spicy' ? 'active' : ''}" data-cat="Spicy">🌶️ Spicy</div>
        <div class="chip ${state.truth.category === 'Brutal' ? 'active' : ''}" data-cat="Brutal">💀 Brutal</div>
        <div class="chip ${state.truth.category === 'Friends-only' ? 'active' : ''}" data-cat="Friends-only">👯 Friends</div>
      </div>
      <div class="bottle-wrap">
        <div class="bottle" id="bottle" style="cursor: ${isHost && !round ? 'pointer' : 'default'};"><span id="bottleName">${round ? round.targetName : '🎯 Spin me!'}</span></div>
        <div>
        ${round && showPrompt && hasChosen ? `
          <div class="banner truth-banner">
            <strong>${round.mode === 'truth' ? '🤔 Truth' : '🎲 Dare'}</strong> for <span class="highlight">${round.targetName}</span>
            <br/><br/>${round.prompt}
          </div>
        ` : ''}
        ${round && showPrompt && !hasChosen ? `
          <div class="banner truth-banner">
            <strong>🎯 ${round.targetName}</strong> - Choose your fate!
          </div>
        ` : ''}
        ${!round && !isHost ? '<p class="muted" style="text-align:center">⏳ Waiting for host to spin...</p>' : ''}
        ${state.truth.spinning ? '<p class="muted" style="text-align:center">🔄 Spinning...</p>' : ''}
        ${round && showPrompt && hasChosen ? `<div class="timer" id="truthTimer">${round.timer || ''}</div>` : ''}
        </div>
      </div>
      <div class="card-cta">
        ${isHost && !round ? `
          <button class="accent" id="spinBtn">🔄 Spin</button>
        ` : ''}
        ${round && showPrompt && !hasChosen && isSelected ? `
          <button class="primary" id="newTruth">🤔 Truth</button>
          <button class="secondary" id="newDare">🎲 Dare</button>
        ` : ''}
        ${round && showPrompt && !hasChosen && !isSelected ? `
          <p class="muted">⏳ Waiting for ${round.targetName} to choose...</p>
        ` : ''}
        ${round && showPrompt && hasChosen && isHost ? '<button class="ghost" id="exposeBtn">🔍 Expose Vote</button>' : ''}
        ${round && showPrompt && hasChosen && isSelected ? '<button class="secondary" id="doneBtn">✅ Done</button>' : ''}
        ${round && showPrompt && hasChosen && !round.exposeOpen ? '<button class="ghost" id="skipBtn">⏭️ Skip</button>' : ''}
        ${isHost && round && showPrompt && hasChosen ? '<button class="accent" id="spinBtn">🔄 Spin Again</button>' : ''}
      </div>
      ${round?.exposeOpen ? '<div id="voteRow" class="flex" style="justify-content:center;margin-top:12px;"></div>' : ''}
    </div>
  `;

  container.querySelectorAll('.chip').forEach((c) => {
    c.onclick = () => {
      state.truth.category = c.dataset.cat;
      renderTruth();
    };
  });

  // Spin function - selects a person, they then choose Truth or Dare
  const spin = () => {
    if (state.hostId !== state.clientId) return; // Only host can spin
    if (state.truth.spinning) return; // Prevent double spin
    const target = randomFrom(state.players);
    const spinStart = state.truth.spinDeg || 0;
    const spinTurns = 1080 + Math.floor(Math.random() * 720);
    const newRound = {
      mode: null, // Not chosen yet
      prompt: null,
      targetId: target.id,
      targetName: target.name,
      timer: 30,
      exposeOpen: false,
      spinStart,
      spinTurns,
      spinMs: SPIN_MS,
    };
    state.truth.round = newRound;
    state.truth.spinning = true;
    relay({ channel: 'truth', action: 'round', round: newRound });
    renderTruth();
    // Play spin animation after render (bottle element now exists)
    setTimeout(() => {
      playBottleSpin(newRound);
    }, 50);
    // End spinning state after animation completes
    setTimeout(() => {
      state.truth.spinning = false;
      renderTruth();
    }, newRound.spinMs || SPIN_MS);
  };

  // Choose Truth or Dare - called by selected person
  const chooseMode = async (mode) => {
    if (!state.truth.round) return;
    if (state.clientId !== state.truth.round.targetId) return; // Only selected person
    const bucket = `truth-${mode}-${state.truth.category}`;
    let prompt = await fetchAIPrompt({ gameId: 'truth-or-dare', mode, category: state.truth.category, bucket });
    if (prompt) {
      rememberPrompt(bucket, prompt);
    } else {
      const promptList = themedTruthListEnhanced ? themedTruthListEnhanced(mode, state.truth.category) : themedTruthList(mode, state.truth.category);
      prompt = pickUniquePrompt(bucket, promptList);
    }
    if (!prompt) return;
    state.truth.round.mode = mode;
    state.truth.round.prompt = prompt;
    relay({ channel: 'truth', action: 'choice', mode, prompt });
    startTruthTimer(state.truth.round.timer);
    renderTruth();
  };

  // Bottle click spins (host only)
  const bottle = el('bottle');
  if (bottle && isHost && !round) {
    bottle.onclick = () => spin();
  }

  if (isHost) {
    const spinBtn = el('spinBtn');
    if (spinBtn) spinBtn.onclick = () => spin();
    const ex = el('exposeBtn');
    if (ex) ex.onclick = () => {
      state.truth.round.exposeOpen = true;
      state.truth.exposeVotes = {};
      relay({ channel: 'truth', action: 'expose-open' });
      showToast('🔍 Expose vote started!');
      renderTruth();
    };
  }

  // Truth/Dare choice buttons for selected person
  const nt = el('newTruth');
  if (nt) nt.onclick = () => chooseMode('truth');
  const nd = el('newDare');
  if (nd) nd.onclick = () => chooseMode('dare');

  const skip = el('skipBtn');
  if (skip) skip.onclick = () => {
    relay({ channel: 'truth', action: 'punish' });
    showToast('⏭️ Skipped! Apply a punishment.');
  };

  const done = el('doneBtn');
  if (done) done.onclick = () => {
    relay({ channel: 'truth', action: 'done' });
    showToast('✅ Answer marked complete!');
  };

  if (state.truth.round?.exposeOpen) {
    const row = el('voteRow');
    if (row) {
      row.innerHTML = '';
      const honest = document.createElement('button');
      honest.textContent = '✅ Honest';
      honest.className = 'primary';
      honest.onclick = () => {
        relay({ channel: 'truth', action: 'vote', vote: 'honest' });
        showToast('You voted Honest');
      };
      const cap = document.createElement('button');
      cap.textContent = '🧢 Cap';
      cap.className = 'secondary';
      cap.onclick = () => {
        relay({ channel: 'truth', action: 'vote', vote: 'cap' });
        showToast('You voted Cap');
      };
      row.append(honest, cap);
      const tally = document.createElement('p');
      tally.className = 'muted';
      tally.style.marginLeft = '16px';
      const votes = state.truth.exposeVotes;
      tally.textContent = `Honest: ${votes.honest || 0} · Cap: ${votes.cap || 0}`;
      row.appendChild(tally);
    }
  }
};

const startTruthTimer = (seconds) => {
  clearInterval(state.timers.truth);
  let t = seconds;
  const tick = () => {
    const timerEl = el('truthTimer');
    if (timerEl) {
      timerEl.textContent = t;
      // Add visual feedback for low time
      timerEl.className = 'timer';
      if (t <= 10) timerEl.classList.add('warning');
      if (t <= 5) timerEl.classList.add('danger');
    }
    if (t <= 0) {
      clearInterval(state.timers.truth);
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      showToast('⏰ Time is up!');
    }
    t -= 1;
  };
  tick();
  state.timers.truth = setInterval(tick, 1000);
};

const renderNHI = () => {
  const round = state.nhi.round;
  const container = el('gameContainer');
  const votes = state.nhi.votes;
  const total = Object.keys(votes).length;
  const myVote = votes[state.clientId];
  const isHost = state.hostId === state.clientId;
  
  container.innerHTML = `
    <div class="game-panel stack">
      <div class="banner" style="font-size:18px;text-align:center;">
        ${round ? `🙈 ${round.statement}` : '👆 Host: Start a statement!'}
      </div>
      <div class="card-cta" style="justify-content:center;">
        ${isHost ? '<button class="primary" id="nhiStart">🎲 New Statement</button>' : ''}
        ${round ? `
          <button class="secondary ${myVote === true ? 'selected' : ''}" id="iDid">🙋 I Did</button>
          <button class="ghost ${myVote === false ? 'selected' : ''}" id="iDidNot">🙅 Never</button>
        ` : ''}
      </div>
      ${round ? `
        <p class="muted" style="text-align:center;">
          ${total === state.players.length ? '✅ All votes in!' : `⏳ Waiting for votes (${total}/${state.players.length})`}
          ${myVote !== undefined ? ` · You: "${myVote ? 'I did' : 'Never'}"` : ''}
        </p>
      ` : ''}
      <div id="nhiResults" class="list"></div>
    </div>
  `;
  
  if (isHost) {
    const btn = el('nhiStart');
    if (btn) btn.onclick = async () => {
      const bucket = 'nhi';
      let statement = await fetchAIPrompt({ gameId: 'never-have-i-ever', mode: 'statement', bucket });
      if (statement) {
        rememberPrompt(bucket, statement);
      } else {
        statement = pickUniquePrompt(bucket, nhiStatements);
      }
      if (!statement) return;
      const round = { statement };
      state.nhi.round = round;
      state.nhi.votes = {};
      relay({ channel: 'nhi', action: 'round', round });
      showToast('🎲 New statement started!');
      renderNHI();
    };
  }
  
  const did = el('iDid');
  if (did) {
    if (myVote === true) did.classList.add('selected');
    did.onclick = () => {
      relay({ channel: 'nhi', action: 'vote', did: true, from: state.clientId });
      state.nhi.votes[state.clientId] = true;
      did.classList.add('selected');
      showToast('🙋 You voted "I did"');
      renderNHI();
    };
  }
  
  const not = el('iDidNot');
  if (not) {
    if (myVote === false) not.classList.add('selected');
    not.onclick = () => {
      relay({ channel: 'nhi', action: 'vote', did: false, from: state.clientId });
      state.nhi.votes[state.clientId] = false;
      not.classList.add('selected');
      showToast('🙅 You voted "Never"');
      renderNHI();
    };
  }
  
  renderNHIResults();
};

const renderNHIResults = () => {
  const res = el('nhiResults');
  if (!res || !state.nhi.round) return;
  const votes = state.nhi.votes;
  if (Object.keys(votes).length !== state.players.length) {
    res.innerHTML = '<p class="muted" style="text-align:center;">Results will appear when everyone votes...</p>';
    return;
  }
  const did = Object.entries(votes).filter(([, v]) => v === true).map(([id]) => id);
  const not = Object.entries(votes).filter(([, v]) => v === false).map(([id]) => id);
  res.innerHTML = `
    <div class="list-item">🙋 <strong>I did</strong> (${did.length}): ${did.map(idToName).join(', ') || 'No one'}</div>
    <div class="list-item">🙅 <strong>Never</strong> (${not.length}): ${not.map(idToName).join(', ') || 'No one'}</div>
  `;
};

const renderLikely = () => {
  const round = state.likely.round;
  const votes = state.likely.votes;
  const container = el('gameContainer');
  const isHost = state.hostId === state.clientId;
  const myVote = votes[state.clientId];
  
  container.innerHTML = `
    <div class="game-panel stack">
      <div class="banner" style="font-size:18px;text-align:center;">
        ${round ? `👆 ${round.question}` : '👆 Host: Start a callout question!'}
      </div>
      <div class="flex" id="voteTargets" style="justify-content:center;"></div>
      <div class="card-cta" style="justify-content:center;">
        ${isHost ? '<button class="primary" id="likelyStart">🎲 New Question</button>' : ''}
      </div>
      ${round && myVote ? `<p class="muted" style="text-align:center;">You voted for: <strong>${idToName(myVote)}</strong></p>` : ''}
      <div class="list" id="likelyResults"></div>
    </div>
  `;
  
  if (isHost) {
    const btn = el('likelyStart');
    if (btn) btn.onclick = async () => {
      const bucket = 'likely';
      let question = await fetchAIPrompt({ gameId: 'most-likely', mode: 'callout', bucket });
      if (question) {
        rememberPrompt(bucket, question);
      } else {
        question = pickUniquePrompt(bucket, likelyQuestions);
      }
      if (!question) return;
      const round = { question };
      state.likely.round = round;
      state.likely.votes = {};
      relay({ channel: 'likely', action: 'round', round });
      showToast('🎲 New question started!');
      renderLikely();
    };
  }
  
  const voteRow = el('voteTargets');
  if (round && voteRow) {
    voteRow.innerHTML = '';
    state.players.forEach((p) => {
      const b = document.createElement('button');
      b.className = myVote === p.id ? 'primary' : 'secondary';
      b.textContent = p.name;
      b.onclick = () => {
        relay({ channel: 'likely', action: 'vote', target: p.id, from: state.clientId });
        state.likely.votes[state.clientId] = p.id;
        showToast(`👆 You voted for ${p.name}`);
        renderLikely();
      };
      voteRow.appendChild(b);
    });
  }
  
  renderLikelyResults();
};

const renderLikelyResults = () => {
  const res = el('likelyResults');
  const votes = state.likely.votes;
  if (!res || !state.likely.round) return;
  const counts = {};
  Object.values(votes).forEach((id) => {
    counts[id] = (counts[id] || 0) + 1;
  });
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    res.innerHTML = '<p class="muted" style="text-align:center;">No votes yet...</p>';
    return;
  }
  res.innerHTML = entries
    .map(([id, n], i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '•';
      return `<div class="list-item">${medal} <strong>${idToName(id)}</strong>: ${n} vote${n !== 1 ? 's' : ''}</div>`;
    })
    .join('');
};

const renderSpy = () => {
  const round = state.spy.round;
  const container = el('gameContainer');
  const isHost = state.hostId === state.clientId;
  
  container.innerHTML = `
    <div class="game-panel stack">
      <div class="banner" style="font-size:18px;text-align:center;">
        ${round ? '🕵️ Ask questions. Find the spy!' : '🕵️ Host: Deal the spy roles!'}
      </div>
      <div class="card-cta" style="justify-content:center;">
        ${isHost ? '<button class="primary" id="spyStart">🎭 Deal Roles</button>' : ''}
      </div>
      ${round ? `<div class="list-item" style="text-align:center;font-size:18px;">${describeSpyInfo(round)}</div>` : ''}
      ${round ? '<p class="muted" style="text-align:center;">Vote who you think is the spy:</p>' : ''}
      ${round ? '<div class="flex" id="spyVotes" style="justify-content:center;"></div>' : ''}
      <div class="list" id="spyResults"></div>
    </div>
  `;
  
  if (isHost) {
    const btn = el('spyStart');
    if (btn) btn.onclick = () => {
      const spy = randomFrom(state.players);
      const word = randomFrom(spyWords);
      const round = { spyId: spy.id, word };
      state.spy.round = round;
      state.spy.votes = {};
      relay({ channel: 'spy', action: 'round', round });
      showToast('🎭 Roles dealt! Find the spy.');
      renderSpy();
    };
  }
  
  if (round) {
    const row = el('spyVotes');
    if (row) {
      row.innerHTML = '';
      state.players.forEach((p) => {
        const b = document.createElement('button');
        const myVote = state.spy.votes[state.clientId];
        b.className = myVote === p.id ? 'primary' : 'secondary';
        b.textContent = p.name;
        b.onclick = () => {
          relay({ channel: 'spy', action: 'vote', target: p.id, from: state.clientId });
          state.spy.votes[state.clientId] = p.id;
          showToast(`🕵️ You voted for ${p.name}`);
          renderSpy();
        };
        row.appendChild(b);
      });
    }
    
    const resEl = el('spyResults');
    if (resEl) {
      resEl.innerHTML = spyResults();
    }
  }
};

const describeSpyInfo = (round) => {
  if (!round) return '';
  if (state.clientId === round.spyId) return '🕵️ <strong style="color:var(--danger);">You are the SPY!</strong> Bluff your way through. Try to guess the word.';
  return `📍 Location word: <strong style="color:var(--accent);">${round.word}</strong>`;
};

const spyResults = () => {
  if (!state.spy.round) return '';
  const counts = {};
  Object.values(state.spy.votes || {}).forEach((id) => (counts[id] = (counts[id] || 0) + 1));
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return '';
  return entries
    .map(([id, n]) => `<div class="list-item">🎯 <strong>${idToName(id)}</strong>: ${n} vote${n !== 1 ? 's' : ''}</div>`)
    .join('');
};

const renderGame = () => {
  switch (state.currentGame) {
    case 'truth':
      renderTruth();
      break;
    case 'nhi':
      renderNHI();
      break;
    case 'likely':
      renderLikely();
      break;
    case 'spy':
      renderSpy();
      break;
  }
};

const idToName = (id) => state.players.find((p) => p.id === id)?.name || 'Unknown';

socket.addEventListener('open', () => {
  setStatus('Connected. Ready to play!', 'connected');
  
  // Check if coming from QR code link - this takes priority over session
  const params = new URLSearchParams(location.search);
  const qrRoomCode = params.get('room');
  
  if (qrRoomCode) {
    // Coming from QR code - wait for welcome then auto-join
    const joinOnWelcome = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'welcome') {
        socket.removeEventListener('message', joinOnWelcome);
        // Check if user has entered a name, if not wait for them to click join
        const name = el('nameInput').value.trim();
        if (name) {
          state.name = name;
          send('join-room', { code: qrRoomCode.toUpperCase(), name: state.name });
        }
        // Otherwise user will click the join button manually
      }
    };
    socket.addEventListener('message', joinOnWelcome);
    return; // Don't do session restore when coming from QR
  }
  
  // Auto-rejoin from saved session (only if NOT from QR code)
  const session = getSession();
  if (session && session.roomCode) {
    state.name = session.name;
    el('nameInput').value = session.name;
    el('roomInput').value = session.roomCode;
    showToast('🔄 Reconnecting to room...', 'info');
    // Wait for welcome message to get clientId, then rejoin
    const rejoinOnWelcome = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'welcome') {
        socket.removeEventListener('message', rejoinOnWelcome);
        // Send wasHost flag so server knows to restore host status
        send('join-room', { code: session.roomCode, name: session.name, wasHost: session.isHost });
      }
    };
    socket.addEventListener('message', rejoinOnWelcome);
  }
});

socket.addEventListener('close', () => setStatus('Disconnected. Refresh to reconnect.', 'error'));
socket.addEventListener('error', () => setStatus('Connection error', 'error'));

socket.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  const { type, payload } = msg;
  switch (type) {
    case 'welcome':
      state.clientId = payload.clientId;
      break;
    case 'room-created':
      state.roomCode = payload.roomCode;
      state.hostId = state.clientId;
      state.joinUrl = payload.joinUrl;
      state.settings = payload.settings || state.settings;
      state.currentGame = state.settings.gameId;
      state.showGrid = true;
      el('roomInput').value = payload.roomCode;
      el('connect-card').hidden = true;
      updateRoomUI();
      renderGameGrid();
      renderCurrent();
      setStatus(`Room ${payload.roomCode} live!`, 'connected');
      showToast(`🎉 Room ${payload.roomCode} created! Share the code.`, 'success');
      saveSession();
      break;
    case 'joined-room':
      state.roomCode = payload.roomCode;
      state.hostId = payload.hostId;
      state.settings = payload.settings || state.settings;
      state.currentGame = state.settings.gameId;
      state.showGrid = false;
      el('connect-card').hidden = true;
      updateRoomUI();
      renderGameGrid();
      renderCurrent();
      setStatus(`Joined room ${payload.roomCode}`, 'connected');
      showToast(`✅ Joined room ${payload.roomCode}!`, 'success');
      saveSession();
      break;
    case 'players-update':
      const prevCount = state.players.length;
      state.players = payload.players;
      if (payload.players.length > prevCount && prevCount > 0) {
        const newPlayer = payload.players[payload.players.length - 1];
        showToast(`👋 ${newPlayer?.name || 'Someone'} joined!`);
      }
      updateRoomUI();
      break;
    case 'settings-update':
      state.settings = payload;
      state.currentGame = payload.gameId;
      const themeSelect = el('themeSelect');
      if (themeSelect) themeSelect.value = payload.theme;
      state.showGrid = false;
      renderGameGrid();
      renderCurrent();
      const gameLabel = (gamesEnhanced.find(g => g.id === payload.gameId) || games.find(g => g.id === payload.gameId))?.label || payload.gameId;
      showToast(`🎮 Game changed to ${gameLabel}`);
      break;
    case 'relay':
      handleRelay(payload);
      break;
    case 'error':
      showToast(`❌ ${payload.message}`, 'error');
      // Clear session if room not found (room was closed)
      if (payload.message?.includes('not found') || payload.message?.includes('closed')) {
        clearSession();
        el('connect-card').hidden = false;
      }
      break;
    case 'room-closed':
      clearSession();
      el('connect-card').hidden = false;
      state.roomCode = '';
      state.players = [];
      updateRoomUI();
      showToast('🚪 Room was closed.', 'warning');
      break;
    case 'host-changed':
      state.hostId = payload.newHostId;
      if (payload.newHostId === state.clientId) {
        showToast('👑 You are now the host!', 'success');
        state.showGrid = true;
      } else {
        showToast(`👑 ${payload.newHostName} is now the host.`, 'info');
      }
      saveSession();
      updateRoomUI();
      renderGameGrid();
      renderCurrent();
      break;
  }
});

const handleRelay = (payload) => {
  const { channel, action } = payload;
  if (channel === 'truth') handleTruthEvent(payload);
  if (channel === 'nhi') handleNHIEvent(payload);
  if (channel === 'likely') handleLikelyEvent(payload);
  if (channel === 'spy') handleSpyEvent(payload);
};

const handleTruthEvent = (payload) => {
  const { action } = payload;
  if (action === 'round') {
    state.truth.round = payload.round;
    state.truth.exposeVotes = {};
    state.truth.spinning = true;
    if (payload.round.targetId === state.clientId) {
      navigator.vibrate?.([100, 50, 100]);
      showToast(`🎯 You were selected! Choose Truth or Dare`, 'success');
    }
    state.currentGame = 'truth';
    renderGame();
    setTimeout(() => {
      playBottleSpin(payload.round);
    }, 20);
    setTimeout(() => {
      state.truth.spinning = false;
      renderTruth();
    }, payload.round.spinMs || SPIN_MS);
  }
  if (action === 'choice') {
    // Someone chose Truth or Dare
    if (state.truth.round) {
      state.truth.round.mode = payload.mode;
      state.truth.round.prompt = payload.prompt;
      startTruthTimer(state.truth.round.timer || 30);
      showToast(`${payload.mode === 'truth' ? '🤔 Truth' : '🎲 Dare'} chosen!`);
      renderTruth();
    }
  }
  if (action === 'expose-open') {
    if (state.truth.round) state.truth.round.exposeOpen = true;
    state.truth.exposeVotes = {};
    showToast('🔍 Expose vote started!');
    renderTruth();
  }
  if (action === 'vote') {
    const vote = payload.vote;
    state.truth.exposeVotes[vote] = (state.truth.exposeVotes[vote] || 0) + 1;
    renderTruth();
  }
  if (action === 'punish') {
    showToast('⏭️ Skipped! Time for a punishment!', 'warning');
  }
  if (action === 'done') {
    showToast('✅ Answer marked complete!', 'success');
  }
};

const handleNHIEvent = (payload) => {
  const { action } = payload;
  if (action === 'round') {
    state.nhi.round = payload.round;
    state.nhi.votes = {};
    state.currentGame = 'nhi';
    renderGame();
  }
  if (action === 'vote') {
    state.nhi.votes[payload.from] = payload.did;
    renderNHIResults();
  }
};

const handleLikelyEvent = (payload) => {
  const { action } = payload;
  if (action === 'round') {
    state.likely.round = payload.round;
    state.likely.votes = {};
    state.currentGame = 'likely';
    renderGame();
  }
  if (action === 'vote') {
    state.likely.votes[payload.from] = payload.target;
    renderLikelyResults();
  }
};

const handleSpyEvent = (payload) => {
  const { action } = payload;
  if (action === 'round') {
    state.spy.round = payload.round;
    state.spy.votes = {};
    state.currentGame = 'spy';
    renderGame();
  }
  if (action === 'vote') {
    state.spy.votes[payload.from] = payload.target;
    renderSpy();
  }
};

const initUI = () => {
  const params = new URLSearchParams(location.search);
  const existingRoom = params.get('room');
  
  const hostActions = el('hostActions');
  const joinOnlyActions = el('joinOnlyActions');
  const joiningRoomCode = el('joiningRoomCode');
  
  // If coming from QR code / direct link, show join-only UI
  if (existingRoom) {
    const roomCode = existingRoom.toUpperCase();
    
    // Hide host options completely, show join-only
    if (hostActions) hostActions.style.display = 'none';
    if (joinOnlyActions) joinOnlyActions.style.display = 'flex';
    if (joiningRoomCode) joiningRoomCode.textContent = roomCode;
    
    // Store room code for joining
    el('roomInput').value = roomCode;
    
    showToast('📋 Enter your name to join!');
    
    // Focus on name input after a small delay
    setTimeout(() => el('nameInput')?.focus(), 100);
    
    // Handle Enter key - go directly to join
    el('nameInput')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') el('joinOnlyBtn')?.click();
    });
    
    // Join only button
    const joinOnlyBtn = el('joinOnlyBtn');
    if (joinOnlyBtn) {
      joinOnlyBtn.onclick = () => {
        state.name = el('nameInput').value.trim() || 'Player';
        joinOnlyBtn.disabled = true;
        joinOnlyBtn.textContent = '⏳ Joining...';
        send('join-room', { code: roomCode, name: state.name });
        setTimeout(() => {
          joinOnlyBtn.disabled = false;
          joinOnlyBtn.textContent = '🚀 Join Game';
        }, 3000);
      };
    }
  } else {
    // Normal mode - show both host and join options
    if (hostActions) hostActions.style.display = 'flex';
    if (joinOnlyActions) joinOnlyActions.style.display = 'none';
    
    // Handle Enter key on inputs
    el('nameInput')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') el('hostBtn')?.click();
    });
  }
  
  el('roomInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') el('joinBtn')?.click();
  });
  
  // Auto-uppercase room input
  el('roomInput').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
  });
  
  el('hostBtn').onclick = () => {
    state.name = el('nameInput').value.trim() || 'Player';
    el('hostBtn').disabled = true;
    el('hostBtn').textContent = '⏳ Creating...';
    send('create-room', { name: state.name });
    setTimeout(() => {
      el('hostBtn').disabled = false;
      el('hostBtn').textContent = '🎮 Host a Room';
    }, 2000);
  };
  
  el('joinBtn').onclick = () => {
    state.name = el('nameInput').value.trim() || 'Player';
    const code = el('roomInput').value.trim().toUpperCase();
    if (!code) {
      showToast('❌ Please enter a room code', 'error');
      return;
    }
    if (code.length < 3) {
      showToast('❌ Enter 3-letter room code', 'error');
      return;
    }
    el('joinBtn').disabled = true;
    el('joinBtn').textContent = '⏳';
    send('join-room', { code, name: state.name });
    setTimeout(() => {
      el('joinBtn').disabled = false;
      el('joinBtn').textContent = 'Join';
    }, 2000);
  };
  
  const themeSelect = el('themeSelect');
  if (themeSelect) {
    themeSelect.onchange = () => {
      if (state.hostId !== state.clientId) return;
      state.settings.theme = themeSelect.value;
      send('set-settings', { theme: state.settings.theme });
      const themeNames = { classic: 'Classic', party: 'Party', 'after-dark': 'After Dark' };
      showToast(`🎨 Theme changed to ${themeNames[state.settings.theme] || state.settings.theme}`);
      renderCurrent();
    };
  }
  
  // Leave room buttons (both regular and small)
  const leaveAction = () => {
    if (!state.roomCode) return;
    goHome();
  };
  
  el('leaveBtn').onclick = leaveAction;
  if (el('leaveBtnSmall')) {
    el('leaveBtnSmall').onclick = leaveAction;
  }
  
  // Home button
  el('homeBtn').onclick = () => {
    if (state.roomCode) {
      if (confirm('Leave the room and go home?')) {
        goHome();
      }
    } else {
      goHome();
    }
  };
};

// Go home / leave room helper
const goHome = () => {
  if (state.roomCode) {
    send('leave-room', {});
  }
  clearSession();
  state.roomCode = '';
  state.players = [];
  state.hostId = '';
  state.qr = null;
  el('connect-card').hidden = false;
  el('room-card').hidden = true;
  el('control-card').hidden = true;
  el('current-card').hidden = true;
  el('homeBtn').hidden = true;
  el('qr').innerHTML = '';
  // Reset to normal UI (not join-only mode)
  el('hostActions').hidden = false;
  el('joinOnlyActions').hidden = true;
  el('roomInput').value = '';
  // Clear URL params
  history.replaceState({}, '', location.pathname);
  showToast('👋 Back to home.', 'info');
};

// Show home button when in a room
const updateHomeButton = () => {
  el('homeBtn').hidden = !state.roomCode;
};

initUI();
renderGameGrid();
renderCurrent();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
