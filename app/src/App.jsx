import React, { useState, useEffect, useRef } from 'react';

export default function App() {
  const canvasRef = useRef(null);
  const [isAIActive, setIsAIActive] = useState(false);
  const [mode, setMode] = useState('PEACE');
  const [score, setScore] = useState(0);
  const [distance, setDistance] = useState(0);
  const [enemyHealth, setEnemyHealth] = useState(100);
  const [stats, setStats] = useState({ hits: 0, missiles: 0, flares: 0 });

  // Agents Position & State
  const [ownShip, setOwnShip] = useState({ x: 150, y: 350 });
  const [enemyAgent, setEnemyAgent] = useState({ x: 650, y: 150 });
  const [missiles, setMissiles] = useState([]);
  const [flares, setFlares] = useState([]);
  const [explosions, setExplosions] = useState([]);

  // Keyboard Controls (WASD / Arrows)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const speed = 10;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        setOwnShip(p => ({ ...p, y: Math.max(20, p.y - speed) }));
      }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        setOwnShip(p => ({ ...p, y: Math.min(480, p.y + speed) }));
      }
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        setOwnShip(p => ({ ...p, x: Math.max(20, p.x - speed) }));
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        setOwnShip(p => ({ ...p, x: Math.min(780, p.x + speed) }));
      }
      if (e.code === 'Space') {
        e.preventDefault();
        fireMissile();
      }
      if (e.key === 'f' || e.key === 'F') {
        deployFlare();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [ownShip, enemyAgent]);

  // Fire Counter-Attack Missile
  const fireMissile = () => {
    setMissiles(prev => [...prev, { x: ownShip.x, y: ownShip.y, speed: 6 }]);
    setStats(s => ({ ...s, missiles: s.missiles + 1 }));
  };

  // Deploy Defensive Flares
  const deployFlare = () => {
    setFlares(prev => [...prev, { x: ownShip.x, y: ownShip.y, life: 100 }]);
    setStats(s => ({ ...s, flares: s.flares + 1 }));
  };

  // Main Game / Simulation Loop
  useEffect(() => {
    let interval = setInterval(() => {
      if (!isAIActive) return;

      // 1. Calculate Distance
      const dx = ownShip.x - enemyAgent.x;
      const dy = ownShip.y - enemyAgent.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      setDistance(Math.floor(dist));

      // 2. Enemy AI Logic (Targeting Jet unless Flares exist)
      setEnemyAgent(prev => {
        let targetX = ownShip.x;
        let targetY = ownShip.y;

        // If flares dropped, AI gets distracted by nearest flare
        if (flares.length > 0) {
          targetX = flares[0].x + Math.sin(Date.now() / 100) * 50;
          targetY = flares[0].y + Math.cos(Date.now() / 100) * 50;
        }

        const edx = targetX - prev.x;
        const edy = targetY - prev.y;
        const edist = Math.sqrt(edx * edx + edy * edy);
        const speed = mode === 'WAR' ? 2.5 : 0.8;

        if (edist > 15) {
          return {
            x: prev.x + (edx / edist) * speed,
            y: prev.y + (edy / edist) * speed
          };
        }
        return prev;
      });

      // 3. Move Missiles & Check Collision
      setMissiles(prevMissiles => {
        return prevMissiles.map(m => {
          const mdx = enemyAgent.x - m.x;
          const mdy = enemyAgent.y - m.y;
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy);

          if (mdist < 20) {
            // Hit Enemy!
            setEnemyHealth(h => Math.max(0, h - 20));
            setScore(s => s + 100);
            setStats(s => ({ ...s, hits: s.hits + 1 }));
            setExplosions(ex => [...ex, { x: enemyAgent.x, y: enemyAgent.y, life: 15 }]);
            return null; // Remove missile
          }

          if (mdist < 5) return null;

          return {
            x: m.x + (mdx / mdist) * m.speed,
            y: m.y + (mdy / mdist) * m.speed,
            speed: m.speed
          };
        }).filter(Boolean);
      });

      // 4. Update Flares lifecycle
      setFlares(prevFlares => {
        return prevFlares.map(f => ({ ...f, life: f.life - 2 })).filter(f => f.life > 0);
      });

      // 5. Update Explosion particles
      setExplosions(prevEx => {
        return prevEx.map(e => ({ ...e, life: e.life - 1 })).filter(e => e.life > 0);
      });

    }, 30);

    return () => clearInterval(interval);
  }, [isAIActive, ownShip, enemyAgent, mode, flares]);

  // Canvas Drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Radar Dark Grid Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 50) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }

    // Draw Defense Flares ✨
    flares.forEach(f => {
      ctx.font = '20px Arial';
      ctx.fillText('✨', f.x - 10, f.y + 10);
    });

    // Draw Missiles 🚀
    missiles.forEach(m => {
      ctx.font = '18px Arial';
      ctx.fillText('🚀', m.x - 8, m.y + 8);
    });

    // Draw Hit Explosions 💥
    explosions.forEach(e => {
      ctx.font = '28px Arial';
      ctx.fillText('💥', e.x - 14, e.y + 14);
    });

    // Draw Own Jet ✈️
    ctx.font = '26px Arial';
    ctx.fillText('✈️', ownShip.x - 13, ownShip.y + 10);
    ctx.fillStyle = '#60a5fa';
    ctx.font = '12px sans-serif';
    ctx.fillText('Own Jet (Pilot Controlled)', ownShip.x - 55, ownShip.y - 15);

    // Draw Enemy AI Drone 🛸 (If alive)
    if (enemyHealth > 0) {
      ctx.font = '26px Arial';
      ctx.fillText('🛸', enemyAgent.x - 13, enemyAgent.y + 10);
      ctx.fillStyle = '#f87171';
      ctx.font = '12px sans-serif';
      ctx.fillText(`AI Drone (HP: ${enemyHealth}%)`, enemyAgent.x - 45, enemyAgent.y - 15);
    } else {
      ctx.fillStyle = '#ef4444';
      ctx.font = '14px sans-serif';
      ctx.fillText('🎯 TARGET DESTROYED', enemyAgent.x - 60, enemyAgent.y);
    }

  }, [ownShip, enemyAgent, missiles, flares, explosions, enemyHealth]);

  const handleReset = () => {
    setOwnShip({ x: 150, y: 350 });
    setEnemyAgent({ x: 650, y: 150 });
    setMissiles([]);
    setFlares([]);
    setExplosions([]);
    setEnemyHealth(100);
    setScore(0);
  };

  return (
    <div style={{ backgroundColor: '#020617', color: 'white', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ borderBottom: '1px solid #334155', paddingBottom: '12px', marginBottom: '20px' }}>
        <h1 style={{ color: '#38bdf8', margin: 0, fontSize: '24px' }}>DRDO Tactical Simulator</h1>
        <p style={{ color: '#94a3b8', margin: '4px 0 0 0', fontSize: '14px' }}>Phase 3: Active Interception & Counter-Attack Defense System</p>
      </header>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        
        {/* Radar Screen */}
        <div style={{ flex: '1 1 auto' }}>
          <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              onClick={() => setIsAIActive(!isAIActive)}
              style={{ padding: '10px 18px', backgroundColor: isAIActive ? '#ef4444' : '#22c55e', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              {isAIActive ? '🛑 Stop AI' : '▶️ Start AI'}
            </button>
            <button 
              onClick={() => setMode(mode === 'PEACE' ? 'WAR' : 'PEACE')}
              style={{ padding: '10px 18px', backgroundColor: '#eab308', color: 'black', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Mode: {mode}
            </button>
            <button 
              onClick={fireMissile}
              style={{ padding: '10px 18px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              🚀 Fire Missile (Space)
            </button>
            <button 
              onClick={deployFlare}
              style={{ padding: '10px 18px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              ✨ Deploy Flares (F)
            </button>
            <button 
              onClick={handleReset}
              style={{ padding: '10px 18px', backgroundColor: '#475569', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              🔄 Reset
            </button>
          </div>

          <div style={{ border: '2px solid #334155', borderRadius: '8px', overflow: 'hidden', display: 'inline-block', backgroundColor: 'black' }}>
            <canvas ref={canvasRef} width={800} height={500} style={{ display: 'block', maxWidth: '100%' }} />
          </div>

          <div style={{ color: '#94a3b8', fontSize: '13px', marginTop: '10px' }}>
            🎮 <b>Controls:</b> Arrow Keys or WASD to fly Jet | <b>Spacebar:</b> Fire Missile | <b>F Key:</b> Deploy Flares
          </div>
        </div>

        {/* Analytics & Health Panel */}
        <div style={{ width: '320px', backgroundColor: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px solid #334155', height: 'fit-content' }}>
          <h2 style={{ color: '#38bdf8', fontSize: '18px', marginTop: 0 }}>🛡️ Tactical & Defense Metrics</h2>
          <hr style={{ borderColor: '#334155', marginBottom: '15px' }} />

          {/* Enemy Health Bar */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '13px', marginBottom: '5px' }}>
              <span>Enemy Drone Health:</span>
              <span>{enemyHealth}%</span>
            </div>
            <div style={{ width: '100%', height: '10px', backgroundColor: '#334155', borderRadius: '5px', overflow: 'hidden' }}>
              <div style={{ width: `${enemyHealth}%`, height: '100%', backgroundColor: enemyHealth > 50 ? '#22c55e' : enemyHealth > 20 ? '#eab308' : '#ef4444', transition: 'width 0.3s' }}></div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
            <div style={{ backgroundColor: '#1e293b', padding: '10px', borderRadius: '6px' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px' }}>Proximity:</span>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: distance < 100 ? '#ef4444' : '#22c55e' }}>{distance} m</div>
            </div>
            <div style={{ backgroundColor: '#1e293b', padding: '10px', borderRadius: '6px' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px' }}>Combat Score:</span>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#eab308' }}>{score}</div>
            </div>
          </div>

          <div style={{ backgroundColor: '#1e293b', padding: '12px', borderRadius: '6px' }}>
            <h3 style={{ color: 'white', fontSize: '13px', margin: '0 0 8px 0' }}>Defense Log:</h3>
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