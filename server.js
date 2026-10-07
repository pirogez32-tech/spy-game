const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(express.static(path.join(__dirname, 'public')));

// Темы (режимы)
const THEMES = {
  classic: {
    name: "Классика",
    locations: [
      "Самолёт", "Банк", "Пляж", "Казино", "Собор", "Цирк-шапито",
      "Корпоративная вечеринка", "Войско крестоносцев", "Посольство",
      "Больница", "Отель", "Военная база", "Киностудия", "Океанский лайнер",
      "Пассажирский поезд", "Пиратский корабль", "Полярная станция",
      "Полицейский участок", "Ресторан", "Школа", "Космическая станция",
      "Подводная лодка", "Супермаркет", "Театр", "Университет",
      "Спа-салон", "Зоопарк", "Парк аттракционов", "Музей", "Стадион"
    ]
  },
  school: {
    name: "Школа / Универ",
    locations: [
      "Класс", "Столовая", "Библиотека", "Спортзал", "Туалет",
      "Учительская", "Директорский кабинет", "Актовый зал",
      "Школьный двор", "Буфет", "Раздевалка", "Лаборатория",
      "Общежитие", "Лекторий", "Кафе в универе", "Актовый зал"
    ]
  },
  office: {
    name: "Офис",
    locations: [
      "Open space", "Переговорка", "Кабинет босса", "Кухня",
      "Туалет", "Серверная", "Ресепшн", "Склад", "Лифт",
      "Парковка", "Кафетерий", "Коворкинг", "Тихая комната", "Курилка"
    ]
  },
  horror: {
    name: "Хоррор",
    locations: [
      "Заброшенная больница", "Кладбище", "Психбольница",
      "Старый особняк", "Катакомбы", "Лес ночью", "Морг",
      "Поезд-призрак", "Проклятый отель", "Подвал", "Чердак",
      "Склеп", "Заброшенная школа", "Дом с привидениями", "Канализация"
    ]
  },
  fantasy: {
    name: "Фэнтези",
    locations: [
      "Замок", "Таверна", "Лес эльфов", "Пещера дракона",
      "Деревня", "Башня мага", "Рынок", "Тюрьма", "Корабль",
      "Подземелье", "Храм", "Арена гладиаторов", "Гномьи шахты", "Логово тролля"
    ]
  },
  party: {
    name: "Вечеринка",
    locations: [
      "Ночной клуб", "Домашняя вечеринка", "Бар", "Кальянная",
      "Караоке", "Бассейн", "Крыша небоскрёба", "Яхта",
      "Фестиваль", "День рождения", "Свадьба", "Выпускной"
    ]
  }
};

const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function getRoomState(room) {
  return {
    code: room.code,
    players: Array.from(room.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      isHost: p.id === room.hostId
    })),
    gameState: room.gameState,
    timer: room.timerRemaining,
    locationsList: THEMES[room.theme]?.locations || THEMES.classic.locations,
    hostId: room.hostId,
    theme: room.theme,
    themes: Object.keys(THEMES).map(key => ({
      id: key,
      name: THEMES[key].name
    }))
  };
}

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.on('create-room', ({ name }) => {
    if (!name || name.trim().length < 1) return;
    let code;
    do {
      code = generateRoomCode();
    } while (rooms.has(code));

    const room = {
      code,
      players: new Map(),
      hostId: socket.id,
      gameState: 'lobby',
      location: null,
      spyId: null,
      timerRemaining: 0,
      timerInterval: null,
      theme: 'classic'
    };

    room.players.set(socket.id, {
      id: socket.id,
      name: name.trim().slice(0, 20),
      socketId: socket.id
    });

    rooms.set(code, room);
    socket.join(code);
    socket.roomCode = code;

    socket.emit('room-joined', {
      ...getRoomState(room),
      yourId: socket.id,
      yourRole: null
    });
    io.to(code).emit('room-update', getRoomState(room));
  });

  socket.on('join-room', ({ code, name }) => {
    code = (code || '').toUpperCase().trim();
    if (!name || name.trim().length < 1 || !rooms.has(code)) {
      socket.emit('error-msg', 'Комната не найдена или имя пустое');
      return;
    }
    const room = rooms.get(code);
    if (room.gameState !== 'lobby') {
      socket.emit('error-msg', 'Игра уже началась');
      return;
    }
    if (room.players.size >= 12) {
      socket.emit('error-msg', 'Комната полная (макс 12)');
      return;
    }

    room.players.set(socket.id, {
      id: socket.id,
      name: name.trim().slice(0, 20),
      socketId: socket.id
    });

    socket.join(code);
    socket.roomCode = code;

    socket.emit('room-joined', {
      ...getRoomState(room),
      yourId: socket.id,
      yourRole: null
    });
    io.to(code).emit('room-update', getRoomState(room));
  });

  socket.on('set-theme', ({ theme }) => {
    const code = socket.roomCode;
    if (!code || !rooms.has(code)) return;
    const room = rooms.get(code);
    if (socket.id !== room.hostId) return;
    if (!THEMES[theme]) return;

    room.theme = theme;
    io.to(code).emit('room-update', getRoomState(room));
  });

  socket.on('start-game', () => {
    const code = socket.roomCode;
    if (!code || !rooms.has(code)) return;
    const room = rooms.get(code);
    if (socket.id !== room.hostId) return;
    if (room.players.size < 3) {
      socket.emit('error-msg', 'Нужно минимум 3 игрока');
      return;
    }

    const locs = THEMES[room.theme]?.locations || THEMES.classic.locations;
    const location = locs[Math.floor(Math.random() * locs.length)];
    const playerIds = Array.from(room.players.keys());
    const spyId = playerIds[Math.floor(Math.random() * playerIds.length)];

    room.location = location;
    room.spyId = spyId;
    room.gameState = 'playing';
    room.timerRemaining = 8 * 60;

    room.players.forEach((player, id) => {
      const isSpy = id === spyId;
      const payload = {
        ...getRoomState(room),
        yourId: id,
        yourRole: isSpy ? 'spy' : 'civilian',
        location: isSpy ? null : location
      };
      io.to(id).emit('game-started', payload);
    });

    if (room.timerInterval) clearInterval(room.timerInterval);
    room.timerInterval = setInterval(() => {
      room.timerRemaining--;
      io.to(code).emit('timer-update', room.timerRemaining);
      if (room.timerRemaining <= 0) {
        clearInterval(room.timerInterval);
        room.gameState = 'ended';
        io.to(code).emit('game-ended', {
          location: room.location,
          spyId: room.spyId,
          spyName: room.players.get(room.spyId)?.name
        });
      }
    }, 1000);
  });

  socket.on('end-round', () => {
    const code = socket.roomCode;
    if (!code || !rooms.has(code)) return;
    const room = rooms.get(code);
    if (socket.id !== room.hostId && socket.id !== room.spyId) return;

    if (room.timerInterval) clearInterval(room.timerInterval);
    room.gameState = 'ended';
    io.to(code).emit('game-ended', {
      location: room.location,
      spyId: room.spyId,
      spyName: room.players.get(room.spyId)?.name
    });
  });

  socket.on('new-round', () => {
    const code = socket.roomCode;
    if (!code || !rooms.has(code)) return;
    const room = rooms.get(code);
    if (socket.id !== room.hostId) return;

    if (room.timerInterval) clearInterval(room.timerInterval);
    room.gameState = 'lobby';
    room.location = null;
    room.spyId = null;
    room.timerRemaining = 0;

    io.to(code).emit('room-update', getRoomState(room));
    io.to(code).emit('back-to-lobby');
  });

  socket.on('disconnect', () => {
    const code = socket.roomCode;
    if (!code || !rooms.has(code)) return;
    const room = rooms.get(code);
    room.players.delete(socket.id);

    if (room.players.size === 0) {
      if (room.timerInterval) clearInterval(room.timerInterval);
      rooms.delete(code);
      return;
    }

    if (socket.id === room.hostId) {
      room.hostId = room.players.keys().next().value;
    }

    io.to(code).emit('room-update', getRoomState(room));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🕵️ Игра в Шпиона запущена на http://localhost:${PORT}`);
});
