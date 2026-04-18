const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const localtunnel = require('localtunnel');

// --- DATABASE / STATE ---
let rooms = {};

// --- EXPRESS SERVER ---
const expressApp = express();
expressApp.use(cors());
expressApp.use(express.static(path.join(__dirname, 'renderer')));

expressApp.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'renderer', 'index.html'));
});

const server = http.createServer(expressApp);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Helper to fetch demons
async function getDemons() {
    try {
        const response = await axios.get('https://pointercrate.com/api/v2/demons/listed/?limit=100');
        return response.data;
    } catch (error) {
        return [{ name: "Tidal Wave", publisher: { name: "OniLink" }, position: 1 }];
    }
}

io.on('connection', (socket) => {
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
                history: [],
                publicUrl: socket.publicUrl || null
            };
        }
        
        rooms[roomId].players.push({ id: socket.id, username, isHost });
        io.to(roomId).emit('roomUpdate', rooms[roomId]);
    });

    socket.on('startGame', (roomId) => {
        if (rooms[roomId]) {
            rooms[roomId].isStarted = true;
            io.to(roomId).emit('roomUpdate', rooms[roomId]);
        }
    });

    socket.on('levelBeaten', (roomId) => {
        if (rooms[roomId]) {
            const room = rooms[roomId];
            const beatenLevel = room.demonList[room.currentIndex];
            if (!beatenLevel) return;

            room.history.unshift({ ...beatenLevel, percentNeeded: room.currentPercent, beatenBy: socket.username });
            room.currentIndex += 1;
            room.currentPercent += 1;
            
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
            if (rooms[socket.roomId].players.length === 0) delete rooms[socket.roomId];
            else io.to(socket.roomId).emit('roomUpdate', rooms[socket.roomId]);
        }
    });
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Server on port ${PORT}`);
});

// --- ELECTRON WINDOW ---
function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 850,
        title: "GD Extreme Demon Roulette - PVP",
        icon: path.join(__dirname, 'renderer', 'favicon.ico'),
        backgroundColor: '#050505',
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false // Allow local file loading
        }
    });

    win.webContents.openDevTools(); // Open tools so user can see errors

    // Load from internal server to bypass file:// protocol issues
    win.loadURL('http://localhost:3001').catch(e => console.error(e));
    
    // Automatic tunneling
    (async () => {
        try {
            const tunnel = await localtunnel({ port: PORT, subdomain: `gd-roul-${Math.floor(Math.random() * 10000)}` });
            console.log(`Public Tunnel: ${tunnel.url}`);
            win.webContents.executeJavaScript(`if(window.setServerPublicUrl) window.setServerPublicUrl("${tunnel.url}")`);
        } catch (err) {
            console.error("Tunnel failed:", err);
        }
    })();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
