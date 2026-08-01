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
  const [enemyAgent, setEnemyAgent] = useState({ x: 650, y: 100 });
  const basePos = { x: 400, y: 400 };

  const [missiles, setMissiles] = useState([]);
  const [flares, setFlares] = useState([]);
  const [explosions, setExplosions] = useState([]);
  
  const lastAutoFire = useRef(0);
  
  // Mobile Movement Reference (For smooth touch controls)
  const movementRef = useRef({ dx: 0, dy: 0 });

  // Keyboard Controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      const speed = 15;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') movementRef.current = { dx: 0, dy: -speed };
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') movementRef.current = { dx: 0, dy: speed };
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') movementRef.current = { dx: -speed, dy: 0 };
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') movementRef.current = { dx: speed, dy: 0 };
      if (e.code === 'Space') { e.preventDefault(); fireMissile(); }
      if (e.key === 'f' || e.key === 'F') deployFlare();
    };
    const handleKeyUp = (e) => {
      if (['ArrowUp', 'w', 'W', 'ArrowDown', 's', 'S', 'ArrowLeft', 'a', 'A', 'ArrowRight', 'd', 'D'].includes(e.key)) {
        movementRef.current = { dx: 0, dy: 0 };
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [baseHealth]);

  const fireMissile = () => { if (baseHealth > 0) setMissiles(prev => [...prev, { x: ownShip.x, y: ownShip.y, speed: 12, type: 'MANUAL' }]); };
  const deployFlare = () => { if (baseHealth > 0) setFlares(prev => [...prev, { x: ownShip.x, y: ownShip.y, life: 100 }]); };

  // Touch/Mouse Handlers for Mobile UI
  const handleTouchMove = (dx, dy) => (e) => {
    e.preventDefault(); 
    movementRef.current = { dx, dy };
  };
  const handleTouchStop = (e) => {
    e.preventDefault();
    movementRef.current = { dx: 0, dy: 0 };
  };

  // Main Simulation Engine
  useEffect(() => {
    let animationFrameId;
    let lastTime = performance.now();

    const loop = (time) => {
      if (time - lastTime > 30) {
        lastTime = time;

        // Apply smooth movement for jet (Mobile & Keyboard combined)
        setOwnShip(p => ({
          x: Math.max(20, Math.min(780, p.x + movementRef.current.dx)),
          y: Math.max(20, Math.min(480, p.y + movementRef.current.dy))
        }));

        if (isAIActive && enemyHealth > 0 && baseHealth > 0) {
          const cx = 400, cy = 250;
          const sweepAngle = (Date.now() / 1200) % (Math.PI * 2);

          const dx = ownShip.x - enemyAgent.x, dy = ownShip.y - enemyAgent.y;
          setDistance(Math.floor(Math.sqrt(dx * dx + dy * dy)));

          // 1. Enemy AI Movement
          setEnemyAgent(prev => {
            let tx = basePos.x, ty = basePos.y;
            if (flares.length > 0) {
              tx = flares[0].x + Math.sin(Date.now() / 100) * 50;
              ty = flares[0].y + Math.cos(Date.now() / 100) * 50;
            }
            const edx = tx - prev.x, edy = ty - prev.y;
            const edist = Math.sqrt(edx * edx + edy * edy);
            const speed = mode === 'WAR' ? 2 : 1.2;

            if (edist < 30 && flares.length === 0) {
              setBaseHealth(h => Math.max(0, h - 2));
              setExplosions(ex => [...ex, { x: basePos.x, y: basePos.y - 20, life: 5 }]);
            }
            if (edist > 5) return { x: prev.x + (edx / edist) * speed, y: prev.y + (edy / edist) * speed };
            return prev;
          });

          // 2. Auto-SAM & Missiles Logic
          setMissiles(prevMissiles => {
            let activeMissiles = [...prevMissiles];
            let objAngle = Math.atan2(enemyAgent.y - cy, enemyAgent.x - cx);
            if (objAngle < 0) objAngle += Math.PI * 2;
            let diff = sweepAngle - objAngle;
            if (diff < 0) diff += Math.PI * 2;
            
            if (diff < 0.4 && Date.now() - lastAutoFire.current > 1500 && flares.length === 0) {
              activeMissiles.push({ x: basePos.x + 30, y: basePos.y - 15, speed: 10, type: 'AUTO' });
              lastAutoFire.current = Date.now();
            }

            return activeMissiles.map(m => {
              const mdx = enemyAgent.x - m.x, mdy = enemyAgent.y - m.y;
              const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
              if (mdist < 25) {
                setEnemyHealth(h => Math.max(0, h - 25));
                setScore(s => s + 150);
                setExplosions(ex => [...ex, { x: enemyAgent.x, y: enemyAgent.y, life: 15 }]);
                return null;
              }
              if (mdist < 5) return null;
              return { x: m.x + (mdx / mdist) * m.speed, y: m.y + (mdy / mdist) * m.speed, speed: m.speed, type: m.type };
            }).filter(Boolean);
          });

          setFlares(prev => prev.map(f => ({ ...f, life: f.life - 2 })).filter(f => f.life > 0));
          setExplosions(prev => prev.map(e => ({ ...e, life: e.life - 1 })).filter(e => e.life > 0));
        }
      }

      // --- CANVAS DRAWING ---
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const cx = canvas.width / 2, cy = canvas.height / 2;
        const sweepAngle = (Date.now() / 1200) % (Math.PI * 2);

        ctx.fillStyle = 'rgba(2, 6, 23, 0.4)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = 'rgba(30, 41, 59, 0.6)'; ctx.lineWidth = 1;
        for (let r = 50; r <= 450; r += 50) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(canvas.width, cy); ctx.stroke();

        const radius = Math.max(cx, cy) + 100;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(sweepAngle);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, radius, 0, 0.25); ctx.lineTo(0, 0);
        const gradient = ctx.createLinearGradient(0, 0, radius, 0);
        gradient.addColorStop(0, 'rgba(34, 197, 94, 0.25)'); gradient.addColorStop(1, 'rgba(34, 197, 94, 0)');
        ctx.fillStyle = gradient; ctx.fill();
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(radius, 0);
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.9)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();

        const getIllumination = (x, y) => {
          let objAngle = Math.atan2(y - cy, x - cx);
          if (objAngle < 0) objAngle += Math.PI * 2;
          let diff = sweepAngle - objAngle;
          if (diff < 0) diff += Math.PI * 2;
          return (diff < 0.2) ? 1.0 : (diff < 1.5 ? 1.0 - (diff / 1.5) : 0.1);
        };
        const drawTacticalText = (text, x, y, color) => { ctx.fillStyle = color; ctx.font = '10px "Courier New", monospace'; ctx.fillText(text, x, y); };

        // Base HQ & Auto-SAM
        const baseIllum = getIllumination(basePos.x, basePos.y);
        ctx.beginPath(); ctx.rect(basePos.x - 25, basePos.y - 15, 50, 30);
        ctx.fillStyle = `rgba(56, 189, 248, ${baseIllum > 0.8 ? 0.4 : 0.05})`; ctx.fill();
        ctx.strokeStyle = `rgba(56, 189, 248, ${Math.max(0.3, baseIllum)})`; ctx.lineWidth = baseIllum > 0.8 ? 2 : 1; ctx.stroke();
        drawTacticalText(`HQ [${baseHealth}%]`, basePos.x - 25, basePos.y + 30, `rgba(56, 189, 248, ${Math.max(0.5, baseIllum)})`);
        
        ctx.beginPath(); ctx.arc(basePos.x + 30, basePos.y - 10, 6, 0, Math.PI*2);
        ctx.strokeStyle = (Date.now() - lastAutoFire.current < 500) ? '#ff0000' : '#eab308'; 
        ctx.lineWidth = 2; ctx.stroke();
        drawTacticalText('AUTO-SAM', basePos.x + 40, basePos.y - 10, '#eab308');

        // Own Jet (Blue)
        const jetIllum = getIllumination(ownShip.x, ownShip.y);
        ctx.beginPath(); ctx.arc(ownShip.x, ownShip.y, 12, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(96, 165, 250, ${jetIllum > 0.8 ? 0.6 : 0.1})`; ctx.fill();
        ctx.strokeStyle = `rgba(96, 165, 250, ${Math.max(0.4, jetIllum)})`; ctx.lineWidth = jetIllum > 0.8 ? 2 : 1; ctx.stroke();
        drawTacticalText('BLU-01', ownShip.x + 15, ownShip.y - 5, `rgba(96, 165, 250, ${Math.max(0.5, jetIllum)})`);

        // Enemy Drone (Red)
        if (enemyHealth > 0) {
          const enemyIllum = getIllumination(enemyAgent.x, enemyAgent.y);
          if (enemyIllum > 0.7) {
            ctx.beginPath(); ctx.arc(enemyAgent.x, enemyAgent.y, 30 * (1 - enemyIllum) + 15, 0, Math.PI*2);
            ctx.strokeStyle = `rgba(255, 0, 0, ${(enemyIllum - 0.7) * 3})`; ctx.lineWidth = 3; ctx.stroke();
          }
          ctx.beginPath(); ctx.moveTo(enemyAgent.x, enemyAgent.y - 14); ctx.lineTo(enemyAgent.x + 14, enemyAgent.y);
          ctx.lineTo(enemyAgent.x, enemyAgent.y + 14); ctx.lineTo(enemyAgent.x - 14, enemyAgent.y); ctx.closePath();
          if (enemyIllum > 0.7) { ctx.fillStyle = '#ff0000'; ctx.shadowBlur = 20; ctx.shadowColor = '#ff0000'; } 
          else { ctx.fillStyle = 'rgba(255, 0, 0, 0.15)'; ctx.shadowBlur = 0; }
          ctx.fill();
          ctx.strokeStyle = `rgba(255, 50, 50, ${Math.max(0.4, enemyIllum)})`; ctx.lineWidth = enemyIllum > 0.7 ? 3 : 1.5; ctx.stroke();
          ctx.shadowBlur = 0;
          drawTacticalText(`TRK-99 [${enemyHealth}%]`, enemyAgent.x + 15, enemyAgent.y - 5, `rgba(255, 50, 50, ${Math.max(0.4, enemyIllum)})`);
        } else {
          drawTacticalText('TARGET DESTROYED', enemyAgent.x - 40, enemyAgent.y, '#4ade80');
        }

        // Missiles & Flares Rendering
        flares.forEach(f => {
          ctx.beginPath(); ctx.moveTo(f.x - 5, f.y - 5); ctx.lineTo(f.x + 5, f.y + 5);
          ctx.moveTo(f.x + 5, f.y - 5); ctx.lineTo(f.x - 5, f.y + 5);
          ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2; ctx.stroke();
        });
        
        missiles.forEach(m => {
          ctx.beginPath(); ctx.arc(m.x, m.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = m.type === 'AUTO' ? '#eab308' : '#ffffff'; 
          if (m.type === 'AUTO') { ctx.shadowBlur = 10; ctx.shadowColor = '#eab308'; }
          ctx.fill(); ctx.shadowBlur = 0;
        });

        explosions.forEach(e => {
          ctx.beginPath(); ctx.arc(e.x, e.y, (15 - e.life) * 2, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(239, 68, 68, ${e.life / 15})`; ctx.lineWidth = 3; ctx.stroke();
        });

        if (baseHealth <= 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#ef4444'; ctx.font = 'bold 30px "Courier New", monospace'; ctx.fillText('SYSTEM FAILURE: HQ BREACHED', 150, 240);
        }
      }
      animationFrameId = requestAnimationFrame(loop);
    };
    
    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isAIActive, ownShip, enemyAgent, mode, flares, enemyHealth, baseHealth, missiles, explosions]);

  const handleReset = () => {
    setOwnShip({ x: 150, y: 350 }); setEnemyAgent({ x: 650, y: 100 });
    setMissiles([]); setFlares([]); setExplosions([]);
    setEnemyHealth(100); setBaseHealth(100); setScore(0); setDistance(0);
  };

  const btnStyle = { padding: '15px', backgroundColor: '#1e293b', color: 'white', border: '1px solid #334155', borderRadius: '8px', touchAction: 'none', userSelect: 'none', fontWeight: 'bold', minWidth: '60px' };

  return (
    <div style={{ backgroundColor: '#020617', color: 'white', minHeight: '100vh', padding: '10px', fontFamily: '"Courier New", monospace', overflowX: 'hidden' }}>
      <header style={{ borderBottom: '1px solid #1e293b', paddingBottom: '10px', marginBottom: '10px' }}>
        <h1 style={{ color: '#38bdf8', margin: 0, fontSize: '20px' }}>DRDO-C2 // MOBILE PROTOCOL</h1>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        
        {/* Top Controls */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={() => setIsAIActive(!isAIActive)} style={{ padding: '8px 16px', backgroundColor: isAIActive ? '#7f1d1d' : '#14532d', color: isAIActive ? '#fca5a5' : '#86efac', border: '1px solid ' + (isAIActive ? '#ef4444' : '#22c55e'), fontFamily: 'inherit', borderRadius: '4px' }}>
            {isAIActive ? 'HALT SIMULATION' : 'INITIATE TRACKING'}
          </button>
          <button onClick={handleReset} style={{ padding: '8px 16px', backgroundColor: '#0f172a', color: '#94a3b8', border: '1px solid #334155', fontFamily: 'inherit', borderRadius: '4px' }}>
            RESET
          </button>
        </div>

        {/* Radar Canvas */}
        <div style={{ border: '1px solid #334155', backgroundColor: '#020617', width: '100%', overflow: 'hidden' }}>
          <canvas ref={canvasRef} width={800} height={500} style={{ display: 'block', width: '100%', height: 'auto' }} />
        </div>

        {/* MOBILE ON-SCREEN CONTROLS */}
        <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#0f172a', padding: '15px', borderRadius: '8px', border: '1px solid #1e293b', gap: '10px' }}>
          
          {/* D-Pad / Directional Controls */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px', maxWidth: '200px' }}>
            <div></div>
            <button onPointerDown={handleTouchMove(0, -15)} onPointerUp={handleTouchStop} onPointerLeave={handleTouchStop} style={btnStyle}>⬆️</button>
            <div></div>
            <button onPointerDown={handleTouchMove(-15, 0)} onPointerUp={handleTouchStop} onPointerLeave={handleTouchStop} style={btnStyle}>⬅️</button>
            <button onPointerDown={handleTouchMove(0, 15)} onPointerUp={handleTouchStop} onPointerLeave={handleTouchStop} style={btnStyle}>⬇️</button>
            <button onPointerDown={handleTouchMove(15, 0)} onPointerUp={handleTouchStop} onPointerLeave={handleTouchStop} style={btnStyle}>➡️</button>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center' }}>
            <button onClick={fireMissile} style={{ ...btnStyle, backgroundColor: '#dc2626', padding: '20px' }}>🚀 FIRE</button>
            <button onClick={deployFlare} style={{ ...btnStyle, backgroundColor: '#3b82f6', padding: '15px' }}>✨ FLARE</button>
          </div>

        </div>

      </div>
    </div>
  );
}