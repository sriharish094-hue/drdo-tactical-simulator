import React, { useState, useEffect, useRef } from 'react';

export default function App() {
  const canvasRef = useRef(null);
  const [isAIActive, setIsAIActive] = useState(false);
  const [mode, setMode] = useState('PEACE');
  const [score, setScore] = useState(0);
  const [distance, setDistance] = useState(0);
  const [enemyHealth, setEnemyHealth] = useState(100);
  const [baseHealth, setBaseHealth] = useState(100); // New: Base Health
  const [stats, setStats] = useState({ hits: 0, missiles: 0, flares: 0 });

  // Agents Position & State
  const [ownShip, setOwnShip] = useState({ x: 150, y: 350 });
  const [enemyAgent, setEnemyAgent] = useState({ x: 650, y: 50 });
  const basePos = { x: 400, y: 450 }; // Base Location (Bottom Center)

  const [missiles, setMissiles] = useState([]);
  const [flares, setFlares] = useState([]);
  const [explosions, setExplosions] = useState([]);

  // Keyboard Controls (WASD / Arrows)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const speed = 12;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') setOwnShip(p => ({ ...p, y: Math.max(20, p.y - speed) }));
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') setOwnShip(p => ({ ...p, y: Math.min(480, p.y + speed) }));
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') setOwnShip(p => ({ ...p, x: Math.max(20, p.x - speed) }));
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') setOwnShip(p => ({ ...p, x: Math.min(780, p.x + speed) }));
      if (e.code === 'Space') { e.preventDefault(); fireMissile(); }
      if (e.key === 'f' || e.key === 'F') deployFlare();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [ownShip, enemyAgent]);

  const fireMissile = () => {
    if (baseHealth > 0) {
      setMissiles(prev => [...prev, { x: ownShip.x, y: ownShip.y, speed: 8 }]);
      setStats(s => ({ ...s, missiles: s.missiles + 1 }));
    }
  };

  const deployFlare = () => {
    if (baseHealth > 0) {
      setFlares(prev => [...prev, { x: ownShip.x, y: ownShip.y, life: 100 }]);
      setStats(s => ({ ...s, flares: s.flares + 1 }));
    }
  };

  // Main Simulation Loop
  useEffect(() => {
    let interval = setInterval(() => {
      // Stop AI if Game Over or Enemy Dead
      if (!isAIActive || enemyHealth <= 0 || baseHealth <= 0) return;

      // 1. Calculate Jet to Enemy Distance (Proximity)
      const dx = ownShip.x - enemyAgent.x;
      const dy = ownShip.y - enemyAgent.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      setDistance(Math.floor(dist));

      // 2. Enemy AI Logic - Target BaseHQ!
      setEnemyAgent(prev => {
        let targetX = basePos.x; // Default target is Base HQ
        let targetY = basePos.y;

        // Distract AI with Flares
        if (flares.length > 0) {
          targetX = flares[0].x + Math.sin(Date.now() / 100) * 50;
          targetY = flares[0].y + Math.cos(Date.now() / 100) * 50;
        }

        const edx = targetX - prev.x;
        const edy = targetY - prev.y;
        const edist = Math.sqrt(edx * edx + edy * edy);
        const speed = mode === 'WAR' ? 2 : 1;

        // Check if Enemy reached the Base to deal damage
        if (edist < 30 && flares.length === 0) {
          setBaseHealth(h => Math.max(0, h - 2)); // Damage base
          setExplosions(ex => [...ex, { x: basePos.x, y: basePos.y - 20, life: 5 }]);
        }

        if (edist > 5) {
          return { x: prev.x + (edx / edist) * speed, y: prev.y + (edy / edist) * speed };
        }
        return prev;
      });

      // 3. Move Missiles & Check Collisions
      setMissiles(prevMissiles => {
        return prevMissiles.map(m => {
          const mdx = enemyAgent.x - m.x;
          const mdy = enemyAgent.y - m.y;
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy);

          if (mdist < 25) { // Hit Enemy
            setEnemyHealth(h => Math.max(0, h - 25)); // Takes 4 hits to destroy 100 HP
            setScore(s => s + 150);
            setStats(s => ({ ...s, hits: s.hits + 1 }));
            setExplosions(ex => [...ex, { x: enemyAgent.x, y: enemyAgent.y, life: 15 }]);
            return null;
          }
          if (mdist < 5) return null;
          return { x: m.x + (mdx / mdist) * m.speed, y: m.y + (mdy / mdist) * m.speed, speed: m.speed };
        }).filter(Boolean);
      });

      // 4. Update Particles
      setFlares(prev => prev.map(f => ({ ...f, life: f.life - 2 })).filter(f => f.life > 0));
      setExplosions(prev => prev.map(e => ({ ...e, life: e.life - 1 })).filter(e => e.life > 0));

    }, 30);

    return () => clearInterval(interval);
  }, [isAIActive, ownShip, enemyAgent, mode, flares, enemyHealth, baseHealth]);

  // Canvas Drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Radar Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 50) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }

    // Draw Military Base HQ 🏢
    ctx.font = '36px Arial';
    ctx.fillText('🏢', basePos.x - 18, basePos.y + 10);
    ctx.fillStyle = baseHealth > 30 ? '#38bdf8' : '#ef4444';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`HQ BASE (${baseHealth}%)`, basePos.x - 40, basePos.y + 30);
    
    // Draw Base Defense Radius
    ctx.beginPath();
    ctx.arc(basePos.x, basePos.y, 80, 0, Math.PI * 2);
    ctx.strokeStyle = baseHealth > 30 ? 'rgba(56, 189, 248, 0.2)' : 'rgba(239, 68, 68, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw Flares ✨ & Missiles 🚀 & Explosions 💥
    flares.forEach(f => { ctx.font = '20px Arial'; ctx.fillText('✨', f.x - 10, f.y + 10); });
    missiles.forEach(m => { ctx.font = '18px Arial'; ctx.fillText('🚀', m.x - 8, m.y + 8); });
    explosions.forEach(e => { ctx.font = '28px Arial'; ctx.fillText('💥', e.x - 14, e.y + 14); });

    // Draw Own Jet ✈️
    ctx.font = '26px Arial';
    ctx.fillText('✈️', ownShip.x - 13, ownShip.y + 10);
    ctx.fillStyle = '#60a5fa';
    ctx.font = '12px sans-serif';
    ctx.fillText('Interceptor', ownShip.x - 25, ownShip.y - 15);

    // Draw Enemy / Game Over States
    if (baseHealth <= 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 40px sans-serif';
      ctx.fillText('GAME OVER - BASE DESTROYED', 90, 240);
    } else if (enemyHealth > 0) {
      ctx.font = '26px Arial';
      ctx.fillText('🛸', enemyAgent.x - 13, enemyAgent.y + 10);
      ctx.fillStyle = '#f87171';
      ctx.font = '12px sans-serif';
      ctx.fillText(`Kamikaze Drone (${enemyHealth}%)`, enemyAgent.x - 50, enemyAgent.y - 15);
    } else {
      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText('MISSION SUCCESS - THREAT NEUTRALIZED', 90, 240);
    }

  }, [ownShip, enemyAgent, missiles, flares, explosions, enemyHealth, baseHealth]);

  const handleReset = () => {
    setOwnShip({ x: 150, y: 350 });
    setEnemyAgent({ x: 650, y: 50 });
    setMissiles([]); setFlares([]); setExplosions([]);
    setEnemyHealth(100); setBaseHealth(100);
    setScore(0); setDistance(0);
  };

  return (
    <div style={{ backgroundColor: '#020617', color: 'white', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ borderBottom: '1px solid #334155', paddingBottom: '12px', marginBottom: '20px' }}>
        <h1 style={{ color: '#38bdf8', margin: 0, fontSize: '24px' }}>DRDO Tactical Simulator</h1>
        <p style={{ color: '#94a3b8', margin: '4px 0 0 0', fontSize: '14px' }}>Phase 4: Base Defense Protocol (Protect the HQ)</p>
      </header>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 auto' }}>
          <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => setIsAIActive(!isAIActive)} style={{ padding: '10px 18px', backgroundColor: isAIActive ? '#ef4444' : '#22c55e', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              {isAIActive ? '🛑 Stop Simulation' : '▶️ Start Attack'}
            </button>
            <button onClick={() => setMode(mode === 'PEACE' ? 'WAR' : 'PEACE')} style={{ padding: '10px 18px', backgroundColor: '#eab308', color: 'black', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              Enemy Speed: {mode}
            </button>
            <button onClick={handleReset} style={{ padding: '10px 18px', backgroundColor: '#475569', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              🔄 Reset Mission
            </button>
          </div>

          <div style={{ border: '2px solid #334155', borderRadius: '8px', overflow: 'hidden', display: 'inline-block', backgroundColor: 'black' }}>
            <canvas ref={canvasRef} width={800} height={500} style={{ display: 'block', maxWidth: '100%' }} />
          </div>

          <div style={{ color: '#94a3b8', fontSize: '14px', marginTop: '10px', backgroundColor: '#1e293b', padding: '10px', borderRadius: '6px' }}>
            🎮 <b>Controls:</b> Keyboard (Arrow/WASD) to Fly | <b>Spacebar:</b> Fire Missiles | <b>F:</b> Drop Flares
          </div>
        </div>

        <div style={{ width: '320px', backgroundColor: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px solid #334155', height: 'fit-content' }}>
          <h2 style={{ color: '#38bdf8', fontSize: '18px', marginTop: 0 }}>🛡️ Mission Status</h2>
          <hr style={{ borderColor: '#334155', marginBottom: '15px' }} />

          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'white', fontSize: '14px', marginBottom: '5px', fontWeight: 'bold' }}>
              <span>HQ Base Integrity:</span>
              <span style={{ color: baseHealth > 30 ? '#4ade80' : '#ef4444' }}>{baseHealth}%</span>
            </div>
            <div style={{ width: '100%', height: '12px', backgroundColor: '#334155', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{ width: `${baseHealth}%`, height: '100%', backgroundColor: baseHealth > 50 ? '#38bdf8' : '#ef4444', transition: 'width 0.3s' }}></div>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '13px', marginBottom: '5px' }}>
              <span>Enemy Drone Health:</span>
              <span>{enemyHealth > 0 ? `${enemyHealth}%` : 'DESTROYED'}</span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: '#334155', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${enemyHealth}%`, height: '100%', backgroundColor: enemyHealth > 50 ? '#22c55e' : '#ef4444', transition: 'width 0.3s' }}></div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
            <div style={{ backgroundColor: '#1e293b', padding: '10px', borderRadius: '6px' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px' }}>Proximity to Enemy:</span>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: enemyHealth === 0 ? '#94a3b8' : (distance < 100 ? '#ef4444' : '#22c55e') }}>
                {enemyHealth > 0 ? `${distance} m` : 'N/A'}
              </div>
            </div>
            <div style={{ backgroundColor: '#1e293b', padding: '10px', borderRadius: '6px' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px' }}>Mission Score:</span>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#eab308' }}>{score}</div>
            </div>
          </div>

          <div style={{ backgroundColor: '#1e293b', padding: '12px', borderRadius: '6px' }}>
            <h3 style={{ color: 'white', fontSize: '13px', margin: '0 0 8px 0' }}>Combat Log:</h3>
            <div style={{ fontSize: '13px', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div>🚀 Missiles Fired: <b style={{ color: 'white' }}>{stats.missiles}</b></div>
              <div>✨ Flares Deployed: <b style={{ color: 'white' }}>{stats.flares}</b></div>
              <div>💥 Target Hits: <b style={{ color: '#4ade80' }}>{stats.hits}</b></div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}