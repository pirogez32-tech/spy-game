const socket = io();

let state = {
  yourId: null,
  isHost: false,
  gameState: 'home',
  roomCode: null,
  currentTheme: 'classic',
  themes: []
};

// DOM
const screens = {
  home: document.getElementById('screen-home'),
  lobby: document.getElementById('screen-lobby'),
  game: document.getElementById('screen-game'),
  end: document.getElementById('screen-end')
};

const els = {
  playerName: document.getElementById('player-name'),
  roomCode: document.getElementById('room-code'),
  btnCreate: document.getElementById('btn-create'),
  btnJoin: document.getElementById('btn-join'),
  lobbyCode: document.getElementById('lobby-code'),
  shareLink: document.getElementById('share-link'),
  playerList: document.getElementById('player-list'),
  playerCount: document.getElementById('player-count'),
  btnStart: document.getElementById('btn-start'),
  waitingHost: document.getElementById('waiting-host'),
  themeSelect: document.getElementById('theme-select'),
  themeButtons: document.getElementById('theme-buttons'),
  timer: document.getElementById('timer'),
  roleDisplay: document.getElementById('role-display'),
  gamePlayerList: document.getElementById('game-player-list'),
  locationsList: document.getElementById('locations-list'),
  currentThemeName: document.getElementById('current-theme-name'),
  btnEndRound: document.getElementById('btn-end-round'),
  endLocation: document.getElementById('end-location'),
  endSpy: document.getElementById('end-spy'),
  btnNewRound: document.getElementById('btn-new-round'),
  waitingNew: document.getElementById('waiting-new'),
  toast: document.getElementById('toast')
};

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.add('hidden'));
  screens[name].classList.remove('hidden');
  state.gameState = name;
}

function showToast(msg, isError = false) {
  els.toast.textContent = msg;
  els.toast.classList.toggle('error', isError);
  els.toast.classList.remove('hidden');
  setTimeout(() => els.toast.classList.add('hidden'), 3000);
}

function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updatePlayers(players) {
  els.playerList.innerHTML = '';
  els.gamePlayerList.innerHTML = '';
  els.playerCount.textContent = players.length;

  players.forEach(p => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${p.name}</span>`;
    if (p.isHost) {
      li.innerHTML += `<span class="host-badge">Хост</span>`;
    }
    els.playerList.appendChild(li);

    const li2 = document.createElement('li');
    li2.innerHTML = `<span>${p.name}</span>`;
    els.gamePlayerList.appendChild(li2);
  });

  state.isHost = players.some(p => p.id === state.yourId && p.isHost);
  els.btnStart.classList.toggle('hidden', !state.isHost);
  els.waitingHost.classList.toggle('hidden', state.isHost);
  els.btnEndRound.classList.toggle('hidden', !state.isHost);
  els.btnNewRound.classList.toggle('hidden', !state.isHost);
  els.waitingNew.classList.toggle('hidden', state.isHost);
  els.themeSelect.classList.toggle('hidden', !state.isHost);
}

function updateThemes(themes, currentTheme) {
  state.themes = themes || [];
  state.currentTheme = currentTheme || 'classic';
  
  els.themeButtons.innerHTML = '';
  state.themes.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'theme-btn' + (t.id === state.currentTheme ? ' active' : '');
    btn.textContent = t.name;
    btn.onclick = () => {
      if (!state.isHost) return;
      socket.emit('set-theme', { theme: t.id });
    };
    els.themeButtons.appendChild(btn);
  });
}

function updateLocations(list) {
  els.locationsList.innerHTML = '';
  list.forEach(loc => {
    const span = document.createElement('span');
    span.textContent = loc;
    els.locationsList.appendChild(span);
  });
}

// Events
els.btnCreate.addEventListener('click', () => {
  const name = els.playerName.value.trim();
  if (!name) return showToast('Введи имя', true);
  socket.emit('create-room', { name });
});

els.btnJoin.addEventListener('click', () => {
  const name = els.playerName.value.trim();
  const code = els.roomCode.value.trim().toUpperCase();
  if (!name) return showToast('Введи имя', true);
  if (!code) return showToast('Введи код комнаты', true);
  socket.emit('join-room', { code, name });
});

els.btnStart.addEventListener('click', () => {
  socket.emit('start-game');
});

els.btnEndRound.addEventListener('click', () => {
  if (confirm('Завершить раунд досрочно?')) {
    socket.emit('end-round');
  }
});

els.btnNewRound.addEventListener('click', () => {
  socket.emit('new-round');
});

// URL params for join
const urlParams = new URLSearchParams(window.location.search);
const joinCode = urlParams.get('room');
if (joinCode) {
  els.roomCode.value = joinCode.toUpperCase();
}

// Socket
socket.on('room-joined', (data) => {
  state.yourId = data.yourId;
  state.roomCode = data.code;
  showScreen('lobby');
  els.lobbyCode.textContent = data.code;
  const link = `${window.location.origin}${window.location.pathname}?room=${data.code}`;
  els.shareLink.href = link;
  els.shareLink.textContent = link;
  updatePlayers(data.players);
  updateThemes(data.themes, data.theme);
  updateLocations(data.locationsList);
});

socket.on('room-update', (data) => {
  updatePlayers(data.players);
  updateThemes(data.themes, data.theme);
  updateLocations(data.locationsList);
});

socket.on('game-started', (data) => {
  showScreen('game');
  updatePlayers(data.players);
  updateLocations(data.locationsList);

  // Показываем название текущей темы
  const themeName = (data.themes || []).find(t => t.id === data.theme)?.name || '';
  els.currentThemeName.textContent = themeName ? `(${themeName})` : '';

  const isSpy = data.yourRole === 'spy';
  els.roleDisplay.innerHTML = `
    <div class="role-title">${isSpy ? 'Ты —' : 'Локация:'}</div>
    <div class="role-value">${isSpy ? 'ШПИОН 🕵️' : data.location}</div>
    ${isSpy ? '<p style="margin-top:12px;color:#aaa;font-size:0.9rem">Угадай локацию по вопросам других!</p>' : '<p style="margin-top:12px;color:#aaa;font-size:0.9rem">Не выдавай локацию напрямую</p>'}
  `;
  els.roleDisplay.parentElement.className = `card role-card ${isSpy ? 'spy' : 'civilian'}`;
  
  els.timer.textContent = formatTime(data.timer || 480);
  els.timer.style.color = 'var(--primary)';
});

socket.on('timer-update', (sec) => {
  els.timer.textContent = formatTime(sec);
  if (sec <= 60) {
    els.timer.style.color = 'var(--danger)';
  }
});

socket.on('game-ended', (data) => {
  showScreen('end');
  els.endLocation.textContent = data.location;
  els.endSpy.textContent = data.spyName || '???';
});

socket.on('back-to-lobby', () => {
  showScreen('lobby');
});

socket.on('error-msg', (msg) => {
  showToast(msg, true);
});

// Enter key
els.playerName.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') els.btnCreate.click();
});
els.roomCode.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') els.btnJoin.click();
});
