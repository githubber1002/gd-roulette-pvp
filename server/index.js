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
  try {
    // Fetch top 300 demons (1-300) to include Legacy list
    const p1 = axios.get('https://pointercrate.com/api/v2/demons/listed/?limit=100');
    const p2 = axios.get('https://pointercrate.com/api/v2/demons/listed/?limit=100&after=100');
    const p3 = axios.get('https://pointercrate.com/api/v2/demons/listed/?limit=100&after=200');
    
    const results = await Promise.all([p1, p2, p3]);
    const allDemons = [...results[0].data, ...results[1].data, ...results[2].data];
    
    console.log(`Successfully fetched ${allDemons.length} demons.`);
    return allDemons;
  } catch (error) {
    console.error("Error fetching demons:", error);
    // Bigger fallback list
    return [
      { name: "Tidal Wave", publisher: { name: "OniLink" }, position: 1 },
      { name: "Acheron", publisher: { name: "Ryamu" }, position: 2 },
      { name: "Silent Clubstep", publisher: { name: "Paqoe" }, position: 3 },
      { name: "Kenos", publisher: { name: "Chief" }, position: 40 },
      { name: "Sonic Wave", publisher: { name: "Sunix" }, position: 100 },
      { name: "Bloodbath", publisher: { name: "Riot" }, position: 250 }
    ];
  }
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinRoom', async ({ roomId, username, isHost }) => {
    socket.join(roomId);
    socket.username = username;
    socket.roomId = roomId;

    if (!rooms[roomId]) {
      const demonList = await getDemons();
      rooms[roomId] = {
        players: [],
        demonList: demonList.sort(() => Math.random() - 0.5),
        currentIndex: 0,
        currentPercent: 1,
        isStarted: false,
        history: []
      };
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
