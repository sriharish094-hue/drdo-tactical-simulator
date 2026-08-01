import React, { useState, useEffect, useRef } from 'react';

export default function App() {
  const canvasRef = useRef(null);
  const [isAIActive, setIsAIActive] = useState(false);
  const [mode, setMode] = useState('PEACE');
  const [score, setScore] = useState(0);
  const [distance, setDistance] = useState(0);
  const [enemyHealth, setEnemyHealth] = useState(100);
  const [baseHealth, setBaseHealth] = useState(100);
  
  // Tactical Positions
  const [ownShip, setOwnShip] = useState({ x: 150, y: 350 });
  const [enemyAgent, setEnemyAgent] = useState({ x: 650, y: 50 });
  const basePos = { x: 400, y: 450 };

  const [missiles, setMissiles] = useState([]);
  const [flares, setFlares] = useState([]);
  const [explosions, setExplosions] = useState([]);

  // Keyboard Controls
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
    if (baseHealth > 0) setMissiles(prev => [...prev, { x: ownShip.x, y: ownShip.y, speed: 10 }]);
  };

  const deployFlare = () => {
    if (baseHealth > 0) setFlares(prev => [...prev, { x: ownShip.x, y: ownShip.y, life: 100 }]);
  };

  // Main Simulation & Radar Engine
  useEffect(() => {
    let animationFrameId;
    let lastTime = performance.now();

    const loop = (time) => {
      // Run AI logic every ~30ms frame equivalent
      if (time - lastTime > 30) {
        lastTime = time;

        if (isAIActive && enemyHealth > 0 && baseHealth > 0) {
          const dx = ownShip.x - enemyAgent.x;
          const dy = ownShip.y - enemyAgent.y;
          setDistance(Math.floor(Math.sqrt(dx * dx + dy * dy)));

          setEnemyAgent(prev => {
            let tx = basePos.x, ty = basePos.y;
            if (flares.length > 0) {
              tx = flares[0].x + Math.sin(Date.now() / 100) * 50;
              ty = flares[0].y + Math.cos(Date.now() / 100) * 50;
            }
            const edx = tx - prev.x, edy = ty - prev.y;
            const edist = Math.sqrt(edx * edx + edy * edy);
            const speed = mode === 'WAR' ? 2 : 1;

            if (edist < 30 && flares.length === 0) {
              setBaseHealth(h => Math.max(0, h - 2));
              setExplosions(ex => [...ex, { x: basePos.x, y: basePos.y - 20, life: 5 }]);
            }
            if (edist > 5) return { x: prev.x + (edx / edist) * speed, y: prev.y + (edy / edist) * speed };
            return prev;
          });

          setMissiles(prev => prev.map(m => {
            const mdx = enemyAgent.x - m.x, mdy = enemyAgent.y - m.y;
            const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
            if (mdist < 25) {
              setEnemyHealth(h => Math.max(0, h - 25));
              setScore(s => s + 150);
              setExplosions(ex => [...ex, { x: enemyAgent.x, y: enemyAgent.y, life: 15 }]);
              return null;
            }
            if (mdist < 5) return null;
            return { x: m.x + (mdx / mdist) * m.speed, y: m.y + (mdy / mdist) * m.speed, speed: m.speed };
          }).filter(Boolean));

          setFlares(prev => prev.map(f => ({ ...f, life: f.life - 2 })).filter(f => f.life > 0));
          setExplosions(prev => prev.map(e => ({ ...e, life: e.life - 1 })).filter(e => e.life > 0));
        }
      }

      // --- CANVAS DRAWING (60 FPS for smooth radar sweep) ---
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        
        // Dark Radar Background with fade effect (creates trail)
        ctx.fillStyle = 'rgba(2, 6, 23, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Grid Background
        ctx.strokeStyle = 'rgba(30, 41, 59, 0.5)';
        ctx.lineWidth = 1;
        for (let i = 0; i < canvas.width; i += 50) {
          ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
        }

        // Draw Rotating Radar Sweep
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const radius = Math.max(cx, cy) + 100;
        const currentAngle = (Date.now() / 1500) % (Math.PI * 2);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(currentAngle);
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, 0, 0.3); // Radar beam width
        ctx.lineTo(0, 0);
        const gradient = ctx.createLinearGradient(0, 0, radius, 0);
        gradient.addColorStop(0, 'rgba(34, 197, 94, 0.2)');
        gradient.addColorStop(1, 'rgba(34, 197, 94, 0)');
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(radius, 0);
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.8)'; // Bright sweep line
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        // Helper function for tactical text
        const drawTacticalText = (text, x, y, color) => {
          ctx.fillStyle = color;
          ctx.font = '10px "Courier New", monospace';
          ctx.fillText(text, x, y);
        };

        // Base HQ (NATO Friendly Ground - Blue Rectangle)
        ctx.beginPath();
        ctx.rect(basePos.x - 25, basePos.y - 15, 50, 30);
        ctx.strokeStyle = baseHealth > 30 ? '#38bdf8' : '#ef4444';
        ctx.lineWidth = 2;
        ctx.stroke();
        drawTacticalText(`HQ [${baseHealth}%]`, basePos.x - 25, basePos.y + 30, '#38bdf8');
        drawTacticalText(`LAT:45.2 LON:12.8`, basePos.x - 40, basePos.y + 45, 'rgba(148, 163, 184, 0.7)');

        // Base Radius
        ctx.beginPath();
        ctx.arc(basePos.x, basePos.y, 80, 0, Math.PI * 2);
        ctx.strokeStyle = baseHealth > 30 ? 'rgba(56, 189, 248, 0.15)' : 'rgba(239, 68, 68, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Own Jet (NATO Friendly Air - Blue Circle/Arc)
        ctx.beginPath();
        ctx.arc(ownShip.x, ownShip.y, 12, 0, Math.PI * 2);
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ownShip.x, ownShip.y);
        ctx.lineTo(ownShip.x + 15, ownShip.y - 15); // Velocity vector line
        ctx.stroke();
        drawTacticalText('BLU-01', ownShip.x + 15, ownShip.y - 15, '#60a5fa');
        drawTacticalText(`SPD: M1.2`, ownShip.x + 15, ownShip.y - 5, 'rgba(148, 163, 184, 0.7)');

        // Enemy Drone (NATO Hostile Air - Red Diamond)
        if (enemyHealth > 0) {
          ctx.beginPath();
          ctx.moveTo(enemyAgent.x, enemyAgent.y - 14);
          ctx.lineTo(enemyAgent.x + 14, enemyAgent.y);
          ctx.lineTo(enemyAgent.x, enemyAgent.y + 14);
          ctx.lineTo(enemyAgent.x - 14, enemyAgent.y);
          ctx.closePath();
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.stroke();
          drawTacticalText(`TRK-99 [${enemyHealth}%]`, enemyAgent.x + 15, enemyAgent.y - 15, '#ef4444');
          drawTacticalText(`ALT: 15000`, enemyAgent.x + 15, enemyAgent.y - 5, 'rgba(148, 163, 184, 0.7)');
        } else {
          drawTacticalText('TARGET DESTROYED', enemyAgent.x - 40, enemyAgent.y, '#4ade80');
        }

        // Flares (Chaff/Flare Decoys - Yellow cross)
        flares.forEach(f => {
          ctx.beginPath();
          ctx.moveTo(f.x - 5, f.y - 5); ctx.lineTo(f.x + 5, f.y + 5);
          ctx.moveTo(f.x + 5, f.y - 5); ctx.lineTo(f.x - 5, f.y + 5);
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 2;
          ctx.stroke();
        });

        // Missiles (White Interceptor lines)
        missiles.forEach(m => {
          ctx.beginPath();
          ctx.arc(m.x, m.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        });

        // Explosions
        explosions.forEach(e => {
          ctx.beginPath();
          ctx.arc(e.x, e.y, (15 - e.life) * 2, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(239, 68, 68, ${e.life / 15})`;
          ctx.lineWidth = 3;
          ctx.stroke();
        });

        // Game Over Overlay
        if (baseHealth <= 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.8)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 30px "Courier New", monospace';
          ctx.fillText('SYSTEM FAILURE: HQ BREACHED', 150, 240);
        }
      }
      animationFrameId = requestAnimationFrame(loop);
    };
    
    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isAIActive, ownShip, enemyAgent, mode, flares, enemyHealth, baseHealth, missiles, explosions]);

  const handleReset = () => {
    setOwnShip({ x: 150, y: 350 }); setEnemyAgent({ x: 650, y: 50 });
    setMissiles([]); setFlares([]); setExplosions([]);
    setEnemyHealth(100); setBaseHealth(100); setScore(0); setDistance(0);
  };

  return (
    <div style={{ backgroundColor: '#020617', color: 'white', minHeight: '100vh', padding: '20px', fontFamily: '"Courier New", monospace' }}>
      <header style={{ borderBottom: '1px solid #1e293b', paddingBottom: '12px', marginBottom: '20px' }}>
        <h1 style={{ color: '#38bdf8', margin: 0, fontSize: '24px', letterSpacing: '1px' }}>TACTICAL DISPLAY SYSTM // DRDO-C2</h1>
        <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '12px' }}>OP-MODE: ACTIVE DEFENSE | MIL-STD-2525 SYMBOLOGY ACTIVE</p>
      </header>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 auto' }}>
          <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => setIsAIActive(!isAIActive)} style={{ padding: '8px 16px', backgroundColor: isAIActive ? '#7f1d1d' : '#14532d', color: isAIActive ? '#fca5a5' : '#86efac', border: '1px solid ' + (isAIActive ? '#ef4444' : '#22c55e'), fontFamily: 'inherit', cursor: 'pointer' }}>
              {isAIActive ? 'HALT SIMULATION' : 'INITIATE TRACKING'}
            </button>
            <button onClick={handleReset} style={{ padding: '8px 16px', backgroundColor: '#0f172a', color: '#94a3b8', border: '1px solid #334155', fontFamily: 'inherit', cursor: 'pointer' }}>
              RESET SYS
            </button>
          </div>

          <div style={{ border: '1px solid #334155', display: 'inline-block', backgroundColor: '#020617', position: 'relative' }}>
            {/* CRT Scanline Overlay effect */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)', pointerEvents: 'none' }}></div>
            <canvas ref={canvasRef} width={800} height={500} style={{ display: 'block', maxWidth: '100%' }} />
          </div>

          <div style={{ color: '#64748b', fontSize: '12px', marginTop: '10px' }}>
            INPUT: [WASD] VECTOR CONTROL | [SPACE] FIRE INTERCEPTOR | [F] DEPLOY COUNTERMEASURE
          </div>
        </div>

        <div style={{ width: '300px', backgroundColor: '#0f172a', padding: '20px', border: '1px solid #1e293b' }}>
          <h2 style={{ color: '#38bdf8', fontSize: '16px', marginTop: 0, borderBottom: '1px solid #1e293b', paddingBottom: '10px' }}>TELEMETRY DATA</h2>
          
          <div style={{ display: 'grid', gap: '15px', marginTop: '15px' }}>
            <div>
              <div style={{ color: '#64748b', fontSize: '11px' }}>HQ INTEGRITY</div>
              <div style={{ fontSize: '20px', color: baseHealth > 30 ? '#38bdf8' : '#ef4444' }}>{baseHealth}%</div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: '11px' }}>HOSTILE TRK-99 STAT</div>
              <div style={{ fontSize: '20px', color: enemyHealth > 0 ? '#ef4444' : '#4ade80' }}>
                {enemyHealth > 0 ? `ACTIVE (${enemyHealth}%)` : 'NEUTRALIZED'}
              </div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: '11px' }}>INTERCEPT DISTANCE</div>
              <div style={{ fontSize: '20px', color: '#facc15' }}>{enemyHealth > 0 ? `${distance} NM` : '---'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}