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
  
  // Auto-Fire Cooldown Reference
  const lastAutoFire = useRef(0);

  // Keyboard Controls (Aircraft manual move & fire)
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
  }, [ownShip, enemyAgent, baseHealth]);

  const fireMissile = () => { if (baseHealth > 0) setMissiles(prev => [...prev, { x: ownShip.x, y: ownShip.y, speed: 12, type: 'MANUAL' }]); };
  const deployFlare = () => { if (baseHealth > 0) setFlares(prev => [...prev, { x: ownShip.x, y: ownShip.y, life: 100 }]); };

  // Main Simulation Engine
  useEffect(() => {
    let animationFrameId;
    let lastTime = performance.now();

    const loop = (time) => {
      if (time - lastTime > 30) {
        lastTime = time;

        if (isAIActive && enemyHealth > 0 && baseHealth > 0) {
          const cx = 400; // canvas center X
          const cy = 250; // canvas center Y
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

          // 2. BUG FIX: Missiles Logic (Auto-Fire + Movement combined safely)
          setMissiles(prevMissiles => {
            let activeMissiles = [...prevMissiles];

            // AUTO-SAM DETECTION LOGIC
            let objAngle = Math.atan2(enemyAgent.y - cy, enemyAgent.x - cx);
            if (objAngle < 0) objAngle += Math.PI * 2;
            let diff = sweepAngle - objAngle;
            if (diff < 0) diff += Math.PI * 2;
            
            // If radar passes over enemy (diff < 0.4) and cooldown (1.5s) passed -> FIRE!
            if (diff < 0.4 && Date.now() - lastAutoFire.current > 1500 && flares.length === 0) {
              activeMissiles.push({ x: basePos.x + 30, y: basePos.y - 15, speed: 10, type: 'AUTO' });
              lastAutoFire.current = Date.now(); // Reset cooldown
            }

            // MOVEMENT & COLLISION
            return activeMissiles.map(m => {
              const mdx = enemyAgent.x - m.x, mdy = enemyAgent.y - m.y;
              const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
              
              if (mdist < 25) {
                setEnemyHealth(h => Math.max(0, h - 25));
                setScore(s => s + 150);
                setExplosions(ex => [...ex, { x: enemyAgent.x, y: enemyAgent.y, life: 15 }]);
                return null; // Destroy missile
              }
              if (mdist < 5) return null;
              
              return { x: m.x + (mdx / mdist) * m.speed, y: m.y + (mdy / mdist) * m.speed, speed: m.speed, type: m.type };
            }).filter(Boolean);
          });

          // 3. Update particles
          setFlares(prev => prev.map(f => ({ ...f, life: f.life - 2 })).filter(f => f.life > 0));
          setExplosions(prev => prev.map(e => ({ ...e, life: e.life - 1 })).filter(e => e.life > 0));
        }
      }

      // --- CANVAS DRAWING (UI) ---
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const cx = canvas.width / 2, cy = canvas.height / 2;
        const sweepAngle = (Date.now() / 1200) % (Math.PI * 2);

        // Dark Background & Grid
        ctx.fillStyle = 'rgba(2, 6, 23, 0.4)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = 'rgba(30, 41, 59, 0.6)'; ctx.lineWidth = 1;
        for (let r = 50; r <= 450; r += 50) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(canvas.width, cy); ctx.stroke();

        // Green Radar Sweep
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

        // Base HQ & Auto-SAM Turret
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
          ctx.fillStyle = m.type === 'AUTO' ? '#eab308' : '#ffffff'; // AUTO = Yellow, MANUAL = White
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

  return (
    <div style={{ backgroundColor: '#020617', color: 'white', minHeight: '100vh', padding: '20px', fontFamily: '"Courier New", monospace' }}>
      <header style={{ borderBottom: '1px solid #1e293b', paddingBottom: '12px', marginBottom: '20px' }}>
        <h1 style={{ color: '#38bdf8', margin: 0, fontSize: '24px', letterSpacing: '1px' }}>TACTICAL DISPLAY SYSTM // DRDO-C2</h1>
        <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '12px' }}>OP-MODE: AUTO-SAM DEPLOYED | MANUAL OVERRIDE STANDBY</p>
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
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)', pointerEvents: 'none' }}></div>
            <canvas ref={canvasRef} width={800} height={500} style={{ display: 'block', maxWidth: '100%' }} />
          </div>

          <div style={{ color: '#64748b', fontSize: '12px', marginTop: '10px' }}>
            INPUT: [WASD] JET VECTOR | [SPACE] MANUAL FIRE (White) | AUTO-SAM: ACTIVE (Yellow)
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
            <div style={{ backgroundColor: '#1e293b', padding: '10px', borderRadius: '4px', borderLeft: '3px solid #eab308' }}>
              <div style={{ color: '#94a3b8', fontSize: '11px' }}>AUTO-SAM STATUS</div>
              <div style={{ fontSize: '14px', color: '#eab308', fontWeight: 'bold' }}>
                {enemyHealth > 0 ? 'SCANNING...' : 'STANDBY'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}