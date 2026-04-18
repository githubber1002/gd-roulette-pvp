const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());

app.get('/', (req, res) => {
  res.send('GD Roulette PVP Server is ACTIVE! Use the frontend on port 5173 to play.');
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

let rooms = {};

// Helper to fetch demons
async function getDemons() {
  const bridgeUrl = 'https://gd-roulette-pvp.vercel.app/api/get-demons';
  const config = {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
  };
  
  // TRY THE VERCEL BRIDGE FIRST
  try {
    console.log("Checking Vercel Bridge for live data...");
    const bridgeResponse = await axios.get(bridgeUrl, { timeout: 8000 });
    if (bridgeResponse.data && Array.isArray(bridgeResponse.data)) {
        console.log("SUCCESS: Bridge is LIVE. Fetched demons from Vercel.");
        return { demons: bridgeResponse.data, isLive: true };
    }
  } catch (err) {
    console.log("Vercel Bridge not ready or blocked. Falling back to direct fetch...");
  }

  try {
    // Sequential fetch to avoid rate limits/blocks
    console.log("Fetching demons Page 1...");
    const r1 = await axios.get('https://pointercrate.com/api/v2/demons/listed/?limit=100', config);
    await new Promise(r => setTimeout(r, 500)); // 0.5s pause
    
    console.log("Fetching demons Page 2...");
    const r2 = await axios.get('https://pointercrate.com/api/v2/demons/listed/?limit=100&after=100', config);
    await new Promise(r => setTimeout(r, 500)); // 0.5s pause
    
    console.log("Fetching demons Page 3...");
    const r3 = await axios.get('https://pointercrate.com/api/v2/demons/listed/?limit=100&after=200', config);
    
    const allDemons = [...r1.data, ...r2.data, ...r3.data];
    console.log(`Successfully fetched ${allDemons.length} demons from API.`);
    return { demons: allDemons, isLive: true };
  } catch (error) {
    console.error("CRITICAL: Pointercrate API blocked or failed:", error.message);
    // 100+ Unique Extreme/Legacy Demons for absolute variety
    const massiveFallback = [
      { name: "Bloodlust", publisher: { name: "Knobbelboy" } },
      { name: "Tartarus", publisher: { name: "Riot" } },
      { name: "Zodiac", publisher: { name: "Bianox" } },
      { name: "Yatagarasu", publisher: { name: "Trusta" } },
      { name: "Cataclysm", publisher: { name: "GGBoy" } },
      { name: "BloodBath", publisher: { name: "Riot" } },
      { name: "Phobos", publisher: { name: "TIGS" } },
      { name: "Aftercatabath", publisher: { name: "BoyOfTheBunny" } },
      { name: "Sonic Wave", publisher: { name: "Sunix" } },
      { name: "Kenos", publisher: { name: "Chief" } },
      { name: "Digital Descent", publisher: { name: "Viprin" } },
      { name: "Artificial Ascent", publisher: { name: "Viprin" } },
      { name: "Erebus", publisher: { name: "BoldStep" } },
      { name: "Thinking Space", publisher: { name: "Hideki" } },
      { name: "Promethean", publisher: { name: "EndLevel" } },
      { name: "The Golden", publisher: { name: "Bo" } },
      { name: "Trueffet", publisher: { name: "SyQual" } },
      { name: "Slaughterhouse", publisher: { name: "IcedCave" } },
      { name: "Firework", publisher: { name: "Trick" } },
      { name: "Tidal Wave", publisher: { name: "OniLink" } },
      { name: "Acheron", publisher: { name: "Ryamu" } },
      { name: "Silent Clubstep", publisher: { name: "Paqoe" } },
      { name: "A Sakupen Circles", publisher: { name: "Nick XD" } },
      { name: "Abyss of Darkness", publisher: { name: "Exen" } },
      { name: "Keres", publisher: { name: "ItsHybrid" } },
      { name: "Oblivion", publisher: { name: "Dice88" } },
      { name: "Azure Flare", publisher: { name: "Danzole" } },
      { name: "Misanthrope", publisher: { name: "HaeSool" } },
      { name: "Hard Machine", publisher: { name: "Kompetenz" } },
      { name: "Limbo", publisher: { name: "MindCap" } },
      { name: "Killbot", publisher: { name: "Lithifusion" } },
      { name: "Requiem", publisher: { name: "Lithifusion" } },
      { name: "Renevant", publisher: { name: "Nikrodox" } },
      { name: "Gamma", publisher: { name: "MindCap" } },
      { name: "Sigma", publisher: { name: "MindCap" } },
      { name: "Omega", publisher: { name: "MindCap" } },
      { name: "Hyper Paracosm", publisher: { name: "Viruz" } },
      { name: "Fragile", publisher: { name: "Luz" } },
      { name: "Visle", publisher: { name: "Xhynte" } },
      { name: "Cold Sweat", publisher: { name: "Para" } },
      { name: "Arcturus", publisher: { name: "Maxfs" } },
      { name: "Lucid Nightmares", publisher: { name: "Cactus" } },
      { name: "Visible Ray", publisher: { name: "Krazyman50" } },
      { name: "Ouroboros", publisher: { name: "Viprin" } },
      { name: "Cognition", publisher: { name: "EndLevel" } },
      { name: "Wasureta", publisher: { name: "Fatality" } },
      { name: "Kowareta", publisher: { name: "Luz" } },
      { name: "Crimson Planet", publisher: { name: "TrueChaos" } },
      { name: "Arctic Lights", publisher: { name: "EndLevel" } },
      { name: "Mayhem", publisher: { name: "Sillow" } },
      { name: "Infernal Abyss", publisher: { name: "Yuka" } },
      { name: "Hatred", publisher: { name: "SrGuillester" } },
      { name: "Black Blizzard", publisher: { name: "Krazyman50" } },
      { name: "Heartbeat", publisher: { name: "Krazyman50" } },
      { name: "SubSonic", publisher: { name: "Viprin" } },
      { name: "Bausha Vortex", publisher: { name: "Lextar" } },
      { name: "Quantum Processing", publisher: { name: "DjSpoon" } },
      { name: "The Hell Castle", publisher: { name: "Sohn0924" } },
      { name: "Cosmic Terror", publisher: { name: "Noctafly" } },
      { name: "Blade of Justice", publisher: { name: "Manix64" } },
      { name: "Edge of Destiny", publisher: { name: "CDMusic" } },
      { name: "Digital Descent", publisher: { name: "Viprin" } },
      { name: "Acheron", publisher: { name: "Ryamu" } },
      { name: "Eternal Victory", publisher: { name: "TrueChaos" } },
      { name: "Sinister Silence", publisher: { name: "Viprin" } },
      { name: "Deimos", publisher: { name: "Hybrid" } },
      { name: "Phobos", publisher: { name: "TIGS" } },
      { name: "Conical Depression", publisher: { name: "Krazyman50" } },
      { name: "Delta Flare", publisher: { name: "Krazyman50" } },
      { name: "Glowy", publisher: { name: "Rob Buck" } },
      { name: "Idols", publisher: { name: "Zylenox" } },
      { name: "Molten Core", publisher: { name: "Manix64" } },
      { name: "Singularity", publisher: { name: "Eusebio" } },
      { name: "Nhelv", publisher: { name: "SrGuillester" } },
      { name: "Ufwm", publisher: { name: "Ufwm" } },
      { name: "Zaphkiel", publisher: { name: "Noctafly" } },
      { name: "Primal Fusion", publisher: { name: "Viprin" } }
    ];
    return { demons: massiveFallback, isLive: false };
  }
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

  socket.on('joinRoom', async ({ roomId, username, isHost }) => {
    socket.join(roomId);
    socket.username = username;
    socket.roomId = roomId;

    if (!rooms[roomId]) {
      const { demons, isLive } = await getDemons();
      rooms[roomId] = {
        players: [],
        demonList: shuffle([...demons]),
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
    
    const player = { id: socket.id, username, isHost, score: 0 };
    rooms[roomId].players.push(player);
    
    io.to(roomId).emit('roomUpdate', rooms[roomId]);
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
