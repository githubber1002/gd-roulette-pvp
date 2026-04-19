const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('GD Roulette PVP Server is ACTIVE! Use the frontend on port 5173 to play.');
});

// MOD API ENDPOINTS
app.post('/api/mod/connect', (req, res) => {
  const token = req.body.token?.trim();
  console.log(`Mod attempting to connect with token: "${token}"`);
  
  if (!token || !modTokens[token]) {
    console.log(`Failed connection: Token "${token}" not found in modTokens. Available tokens:`, Object.keys(modTokens));
    return res.status(401).json({ error: 'Invalid or missing token' });
  }
  
  const playerData = modTokens[token];
  const room = rooms[playerData.roomId];
  
  if (room) {
    const player = room.players.find(p => p.id === playerData.socketId);
    if (player) {
      player.modVerified = true;
      io.to(playerData.roomId).emit('roomUpdate', room);
      io.to(playerData.roomId).emit('modConnected', { username: player.username });
      return res.json({ success: true, message: 'Connected to room ' + playerData.roomId });
    }
  }
  
  return res.status(404).json({ error: 'Room or player not found' });
});

app.post('/api/mod/report', (req, res) => {
  const { token, levelName, levelId, percent, completed } = req.body;
  
  if (!token || !modTokens[token]) {
    return res.status(401).json({ error: 'Invalid or missing token' });
  }

  const playerData = modTokens[token];
  const room = rooms[playerData.roomId];
  
  if (!room || !room.isStarted) {
    return res.status(400).json({ error: 'Room not active' });
  }

  const currentLevel = room.demonList[room.currentIndex];
  if (!currentLevel) {
    return res.status(400).json({ error: 'No active level' });
  }

  // ID ENFORCEMENT: Check if the reported level ID matches the current target
  // We check both level_id (Pointercrate) and id (Pointercrate fallback)
  const targetId = currentLevel.level_id || currentLevel.id;
  
  if (levelId && targetId && parseInt(levelId) !== parseInt(targetId)) {
    console.warn(`[CHEAT DETECTED] ${playerData.username} reported progress on level ID ${levelId}, but target is ${currentLevel.name} (ID: ${targetId})`);
    return res.status(403).json({ error: 'Level ID mismatch - incorrect level being played' });
  }

  // Auto-advance if they meet the required percentage or completed it
  if (percent >= room.currentPercent || completed) {
    const now = Date.now();
    if (room.lastBeaten && now - room.lastBeaten < 2000) {
      return res.status(429).json({ error: 'Rate limit' });
    }
    room.lastBeaten = now;

    room.history.unshift({ ...currentLevel, percentNeeded: room.currentPercent, beatenBy: playerData.username });
    
    // Award points
    const player = room.players.find(p => p.id === playerData.socketId);
    if (player) {
        player.score += room.currentPercent;
    }

    room.currentIndex += 1;
    room.currentPercent += 1;
    
    if (room.currentPercent > 100) {
        io.to(playerData.roomId).emit('gameOver', { winner: playerData.username });
    } else {
        io.to(playerData.roomId).emit('levelBeatenAnnounce', { username: playerData.username, levelName: currentLevel.name });
        room.skipVotes = [];
        io.to(playerData.roomId).emit('roomUpdate', room);
    }
    
    return res.json({ success: true, message: 'Progress recorded' });
  }

  return res.json({ success: true, message: 'Progress ignored (insufficient percent)' });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

let rooms = {};
let modTokens = {}; // Maps token -> { roomId, socketId, username }

// Helper for fallback demons
function getFallbackDemons() {
  const massiveFallback = [
    { name: "Bloodlust", level_id: 35140325, publisher: { name: "Knobbelboy" } },
    { name: "Tartarus", level_id: 56616053, publisher: { name: "Riot" } },
    { name: "Zodiac", level_id: 51221051, publisher: { name: "Bianox" } },
    { name: "Yatagarasu", level_id: 28405022, publisher: { name: "Trusta" } },
    { name: "Cataclysm", level_id: 391901, publisher: { name: "GGBoy" } },
    { name: "Acheron", level_id: 82436340, publisher: { name: "Riot" } },
    { name: "Slaughterhouse", level_id: 74681602, publisher: { name: "IcedCave" } },
    { name: "Firework", level_id: 74682025, publisher: { name: "CherryTeam" } },
    { name: "Mainframe", level_id: 83030467, publisher: { name: "Zebus" } },
    { name: "Sonic Wave", level_id: 25482315, publisher: { name: "Sunix" } },
    { name: "Limbo", level_id: 85651581, publisher: { name: "MindCap" } },
    { name: "Kenos", level_id: 58140417, publisher: { name: "Bianox" } },
    { name: "The Golden", level_id: 60925841, publisher: { name: "Bo" } },
    { name: "Sakupen Circles", level_id: 77146522, publisher: { name: "Nick136" } },
    { name: "Abyss of Darkness", level_id: 79354065, publisher: { name: "Exen" } },
    { name: "Trueffet", level_id: 73062638, publisher: { name: "Synergi" } },
    { name: "Hard Machine", level_id: 70877960, publisher: { name: "Komek" } },
    { name: "VSC", level_id: 74345293, publisher: { name: "Cursed" } },
    { name: "Silent Clubstep", level_id: 81861343, publisher: { name: "Paqoe" } },
    { name: "Azure Flare", level_id: 82956105, publisher: { name: "Slayer" } },
    { name: "Eternal Night", level_id: 81861456, publisher: { name: "CherryTeam" } },
    { name: "Oblivion", level_id: 82255745, publisher: { name: "Dizzy" } },
    { name: "Sinister Silence", level_id: 83464522, publisher: { name: "Eternity" } },
    { name: "Kyouki", level_id: 84646525, publisher: { name: "Demishow" } },
    { name: "Poocubed", level_id: 84646525, publisher: { name: "PooBear" } },
    { name: "Fragile", level_id: 65161405, publisher: { name: "Nova" } },
    { name: "Cognition", level_id: 59714856, publisher: { name: "EndLevel" } },
    { name: "Renevant", level_id: 57577543, publisher: { name: "Nikro" } },
    { name: "Thinking Space", level_id: 58197176, publisher: { name: "Hideki" } },
    { name: "Promethean", level_id: 58210332, publisher: { name: "EndLevel" } }
  ];
  return massiveFallback;
}

function shuffle(array) {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinRoom', async ({ roomId, username, isHost, customDemons }) => {
    socket.join(roomId);
    socket.username = username;
    socket.roomId = roomId;

    if (!rooms[roomId]) {
      let isLive = false;
      let demonsToUse = [];

      if (customDemons && Array.isArray(customDemons) && customDemons.length > 0) {
        demonsToUse = customDemons;
        isLive = true;
      } else {
        demonsToUse = getFallbackDemons();
        isLive = false;
      }

      rooms[roomId] = {
        players: [],
        demonList: shuffle([...demonsToUse]),
        currentIndex: 0,
        currentPercent: 1,
        isStarted: false,
        isLive,
        history: [],
        restartVotes: [],
        skipsRemaining: 1,
        skipVotes: []
      };
      console.log(`Lobby ${roomId} initialized with ${rooms[roomId].demonList.length} shuffled demons. API Live: ${isLive}`);
    }
    
    const player = { id: socket.id, username, isHost, score: 0, modVerified: false };
    
    // Generate token if room already requires mod
    if (rooms[roomId].requireMod) {
      const token = 'GD-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      player.modToken = token;
      modTokens[token] = { roomId, socketId: socket.id, username: player.username };
      console.log(`Generated late-join token ${token} for ${username} in room ${roomId}`);
    }

    rooms[roomId].players.push(player);
    
    io.to(roomId).emit('roomUpdate', rooms[roomId]);
  });

  socket.on('setRequireMod', ({ roomId, requireMod }) => {
    const room = rooms[roomId];
    if (room && !room.isStarted) {
      room.requireMod = requireMod;
      
      // Generate tokens for all players when enabling mod requirement
      if (requireMod) {
        room.players.forEach(p => {
          const token = 'GD-' + Math.random().toString(36).substring(2, 6).toUpperCase();
          p.modToken = token;
          modTokens[token] = { roomId, socketId: p.id, username: p.username };
        });
      } else {
        // Clear tokens when disabling
        room.players.forEach(p => {
          if (p.modToken) {
            delete modTokens[p.modToken];
            delete p.modToken;
          }
          p.modVerified = false;
        });
      }
      
      io.to(roomId).emit('roomUpdate', room);
    }
  });

  socket.on('startGame', (roomId) => {
    if (rooms[roomId]) {
      rooms[roomId].isStarted = true;
      io.to(roomId).emit('roomUpdate', rooms[roomId]);
    }
  });

  socket.on('levelBeaten', (roomId) => {
    const room = rooms[roomId];
    if (room) {
      // If mod is required, block manual browser submissions
      if (room.requireMod) {
        console.log(`Blocked manual levelBeaten in verified room ${roomId}`);
        return;
      }
      
      const now = Date.now();
      // 4.5 second buffer to prevent race conditions/double-clicking
      if (room.lastBeaten && now - room.lastBeaten < 4500) {
          console.log(`Rate limit hit for room ${roomId}`);
          return;
      }
      room.lastBeaten = now;

      const beatenLevel = room.demonList[room.currentIndex];
      
      if (!beatenLevel) return;

      room.history.unshift({ ...beatenLevel, percentNeeded: room.currentPercent, beatenBy: socket.username });
      
      room.currentIndex += 1;
      room.currentPercent += 1;
      
      // Award points to the player
      const player = room.players.find(p => p.id === socket.id);
      if (player) {
          player.score += room.currentPercent;
      }

      if (room.currentPercent > 100) {
          io.to(roomId).emit('gameOver', { winner: socket.username });
      } else {
          io.to(roomId).emit('levelBeatenAnnounce', { username: socket.username, levelName: beatenLevel.name });
          room.skipVotes = []; // Clear skip votes for the new level
          io.to(roomId).emit('roomUpdate', room);
      }
    }
  });

  socket.on('requestRestart', (roomId) => {
    const room = rooms[roomId];
    if (room) {
      if (!room.restartVotes.includes(socket.id)) {
        room.restartVotes.push(socket.id);
      }

      const totalPlayers = room.players.length;
      // If 2 players, both must vote. Otherwise, majority.
      const votesNeeded = totalPlayers === 2 ? 2 : Math.ceil(totalPlayers / 2);

      if (room.restartVotes.length >= votesNeeded) {
        // Reset the run
        room.currentIndex = 0;
        room.currentPercent = 1;
        room.history = [];
        room.isStarted = false;
        room.restartVotes = [];
        room.skipsRemaining = 1;
        room.skipVotes = [];
        // Reset scores
        room.players.forEach(p => p.score = 0);
        // Reshuffle using unbiased Fisher-Yates
        room.demonList = shuffle([...room.demonList]);
        
        io.to(roomId).emit('roomUpdate', room);
        io.to(roomId).emit('gameRestarted', { by: socket.username });
      } else {
        io.to(roomId).emit('roomUpdate', room);
      }
    }
  });

  socket.on('requestSkip', (roomId) => {
    const room = rooms[roomId];
    if (room && room.skipsRemaining > 0) {
      if (!room.skipVotes.includes(socket.id)) {
        room.skipVotes.push(socket.id);
      }

      const totalPlayers = room.players.length;
      if (room.skipVotes.length >= totalPlayers) {
        // Unanimous skip!
        room.currentIndex += 1;
        room.skipsRemaining = 0;
        room.skipVotes = [];
        
        io.to(roomId).emit('roomUpdate', room);
        io.to(roomId).emit('levelSkipped', { by: 'The Whole Party' });
      } else {
        io.to(roomId).emit('roomUpdate', room);
      }
    }
  });

  socket.on('disconnect', () => {
    if (socket.roomId && rooms[socket.roomId]) {
      rooms[socket.roomId].players = rooms[socket.roomId].players.filter(p => p.id !== socket.id);
      if (rooms[socket.roomId].players.length === 0) {
        delete rooms[socket.roomId];
      } else {
        io.to(socket.roomId).emit('roomUpdate', rooms[socket.roomId]);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
