import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Trophy, Users, Play, Target, LogOut, ChevronRight, Award, Globe, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

function App() {
  const [username, setUsername] = useState(localStorage.getItem('gdUsername') || '');
  const [view, setView] = useState('home'); // home, lobby, game
  const [serverUrl, setServerUrl] = useState(import.meta.env.VITE_SERVER_URL || 'http://localhost:3001');
  const [publicUrl, setPublicUrl] = useState('');
  const [roomId, setRoomId] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [error, setError] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  
  const socketRef = useRef(null);

  useEffect(() => {
    // Listen for public tunnel URL from Electron
    window.setServerPublicUrl = (url) => setPublicUrl(url);
  }, []);

  useEffect(() => {
    if (username) localStorage.setItem('gdUsername', username);
  }, [username]);

  useEffect(() => {
    if (!serverUrl) return;

    console.log("Connecting to:", serverUrl);
    const socket = io(serverUrl);
    socketRef.current = socket;

    socket.on('connect', () => {
        console.log("Socket connected!");
        setIsConnected(true);
        setError('');
    });

    socket.on('roomUpdate', (data) => {
      if (roomData && data.currentIndex !== roomData.currentIndex) {
        setCooldown(5);
      }
      setRoomData(data);
      if (data.isStarted) {
        setView('game');
      }
    });

    socket.on('connect_error', (err) => {
        console.error("Connection error:", err);
        setIsConnected(false);
        setError("Failed to connect to server.");
    });

    socket.on('gameOver', ({ winner }) => {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        alert(`${winner} has COMPLETED the Extreme Demon Roulette!`);
    });

    return () => {
      socket.disconnect();
    };
  }, [serverUrl]);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleCreateRoom = () => {
    if (!username) return setError('Please enter a username');
    if (!isConnected) return setError('Not connected to server yet...');
    
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(id);
    setRoomData(null); // Reset room data for new lobby
    socketRef.current.emit('joinRoom', { roomId: id, username, isHost: true });
    setView('lobby');
  };

  const handleJoinRoom = () => {
    if (!username) return setError('Please enter a username');
    if (!roomId) return setError('Please enter a room ID');
    if (!isConnected) return setError('Not connected to server yet...');
    
    setRoomData(null);
    socketRef.current.emit('joinRoom', { roomId, username, isHost: false });
    setView('lobby');
  };

  const startGame = () => {
    if (socketRef.current) socketRef.current.emit('startGame', roomId);
  };

  const markBeaten = () => {
    if (socketRef.current) socketRef.current.emit('levelBeaten', roomId);
    confetti({ particleCount: 100, spread: 60, origin: { y: 0.8 }, colors: ['#00f2ff', '#bc13fe'] });
  };

  return (
    <div className="app-container">
      <AnimatePresence mode="wait">
        {view === 'home' && (
          <motion.div key="home" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="lobby-card glass">
            <h1>Demon Roulette <span style={{color: 'var(--text-dim)', fontSize: '1.5rem'}}>PVP</span></h1>
            
            <div style={{ marginBottom: '2rem', width: '100%', maxWidth: '400px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: '8px', textTransform: 'uppercase' }}>
                    <Globe size={14} /> Server Address
                </div>
                <input 
                    placeholder="http://localhost:3001" 
                    value={serverUrl} 
                    onChange={(e) => setServerUrl(e.target.value)} 
                    style={{ width: '100%', textAlign: 'center', border: '1px dashed var(--accent)' }}
                />
            </div>

            <input placeholder="YOUR USERNAME" value={username} onChange={(e) => setUsername(e.target.value)} style={{ marginBottom: '1rem', width: '300px', textAlign: 'center' }} />
            
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                className="btn btn-primary" 
                onClick={handleCreateRoom}
                disabled={!isConnected}
                style={{ opacity: isConnected ? 1 : 0.5 }}
              > 
                HOST LOBBY 
              </button>
              <div style={{ display: 'flex' }}>
                <input placeholder="ROOM ID" value={roomId} onChange={(e) => setRoomId(e.target.value.toUpperCase())} style={{ width: '120px', borderRadius: '12px 0 0 12px', borderRight: 'none' }} />
                <button 
                    className="btn btn-secondary" 
                    onClick={handleJoinRoom}
                    disabled={!isConnected}
                    style={{ borderRadius: '0 12px 12px 0', opacity: isConnected ? 1 : 0.5 }}
                > 
                    JOIN 
                </button>
              </div>
            </div>
            {!isConnected && <p style={{ color: 'var(--text-dim)', marginTop: '1rem', fontSize: '0.8rem' }}>Connecting to background server...</p>}
            {error && <p style={{ color: 'var(--danger)', marginTop: '1rem' }}>{error}</p>}
          </motion.div>
        )}

        {view === 'lobby' && (
          <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="lobby-card glass" style={{ width: '100%', maxWidth: '600px', margin: '0 auto' }} >
            {!roomData ? (
                <div style={{ padding: '3rem', textAlign: 'center' }}>
                    <Loader2 size={48} className="pulsing" style={{ color: 'var(--accent)', marginBottom: '1rem' }} />
                    <h2>Creating Room...</h2>
                    <p style={{ color: 'var(--text-dim)', marginTop: '1rem' }}>If this takes more than 5 seconds, restart the app.</p>
                </div>
            ) : (
                <>
                <div style={{ marginBottom: '2rem' }}>
                    <h2 style={{ marginBottom: '0.5rem' }}>ROOM: {roomId}</h2>
                    <span className="pulsing" style={{ color: 'var(--accent)', fontSize: '0.9rem' }}>WAITING FOR PLAYERS...</span>
                    
                    {publicUrl && (
                        <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid var(--accent)', borderRadius: '12px', background: 'rgba(0, 242, 255, 0.05)' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>Invite Link for Friend</div>
                            <div style={{ color: 'var(--accent)', fontWeight: 'bold', wordBreak: 'break-all' }}>{publicUrl}</div>
                        </div>
                    )}
                </div>

                <div style={{ width: '100%', textAlign: 'left', marginBottom: '2rem' }}>
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginBottom: '1rem', textTransform: 'uppercase' }}> Current Party ({roomData.players.length}) </div>
                    {roomData.players.map(p => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', marginBottom: '8px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: p.isHost ? 'var(--accent)' : 'var(--text-dim)' }}></div>
                             <div style={{ flex: 1 }}>{p.username}</div>
                             <div style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{p.score} PTS</div>
                        </div>
                    ))}
                </div>

                {roomData.players.some(p => p.id === socketRef.current?.id && p.isHost) ? (
                    <button className="btn btn-primary" onClick={startGame}> START GAME </button>
                ) : (
                    <p style={{ color: 'var(--text-dim)' }}>Waiting for host to start...</p>
                )}
                </>
            )}
          </motion.div>
        )}

        {view === 'game' && roomData && (
          <motion.div key="game" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ width: '100%' }} >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <div>
                    <h2 style={{ margin: 0 }}>ROULETTE PVP</h2>
                    <span style={{ color: 'var(--accent)' }}>LEVEL {roomData.currentIndex + 1} / 100</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>ROOM ID</div>
                    <div style={{ fontWeight: '800' }}>{roomId}</div>
                </div>
            </div>

            <div className="grid-2">
                <main>
                    <motion.div className="level-card glass" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} key={roomData.currentIndex} >
                        <div className="percent-display">{roomData.currentPercent}%</div>
                        <div className="percent-label">REQUIRED TO ADVANCE</div>
                        <h1 style={{ fontSize: '2.5rem', wordBreak: 'break-word' }}>{roomData.demonList[roomData.currentIndex]?.name}</h1>
                        <p style={{ color: 'var(--text-dim)' }}>by {roomData.demonList[roomData.currentIndex]?.publisher?.name}</p>
                        <button 
                            className="btn btn-success" 
                            onClick={markBeaten} 
                            style={{ marginTop: '2rem', width: '100%', opacity: cooldown > 0 ? 0.5 : 1 }} 
                            disabled={cooldown > 0}
                        > 
                            {cooldown > 0 ? `COOLDOWN (${cooldown}s)` : `I GOT ${roomData.currentPercent}%!`}
                        </button>
                    </motion.div>
                </main>
                 <aside>
                    <div className="glass" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
                        <h3 style={{ marginBottom: '1rem', color: 'var(--text-dim)', fontSize: '0.8rem', textTransform: 'uppercase' }}>LEADERBOARD</h3>
                        {roomData.players.sort((a, b) => b.score - a.score).map(p => (
                            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                <span>{p.username}</span>
                                <span style={{ color: 'var(--accent)' }}>{p.score}</span>
                            </div>
                        ))}
                    </div>
                    <div className="glass" style={{ padding: '1.5rem' }}>
                        <h3 style={{ marginBottom: '1rem', color: 'var(--text-dim)', fontSize: '0.8rem', textTransform: 'uppercase' }}>HISTORY</h3>
                        {roomData.history.map((h, i) => (
                            <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: '0.9rem' }}>
                                <b>{h.name}</b> by <span style={{color: 'var(--text-dim)'}}>{h.beatenBy}</span>
                            </div>
                        ))}
                    </div>
                </aside>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
