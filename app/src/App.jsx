import React, { useState, useEffect, useRef } from 'react';

export default function App() {
  const canvasRef = useRef(null);
  const [isAIActive, setIsAIActive] = useState(false);
  const [mode, setMode] = useState('PEACE');
  const [score, setScore] = useState(0);
  const [baseHealth, setBaseHealth] = useState(100);
  
  // Tactical Positions
  const [ownShip, setOwnShip] = useState({ x: 150, y: 350 });
  const basePos = { x: 400, y: 400 };

  // Multiple Enemies (Swarm)
  const [enemies, setEnemies] = useState([
    { id: 'TRK-01', x: 700, y: 80, health: 100, speed: 1.2 },
    { id: 'TRK-02', x: 650, y: 420, health: 100, speed: 1.0 },
    { id: 'TRK-03', x: 750, y: 250, health: 100, speed: 1.5 }
  ]);

  // Ground Units
  const tanks = [
    { id: 'TANK-1', x: 340, y: 420 },
    { id: 'TANK-2', x: 460, y: 420 }
  ];
  const soldiers = [
    { id: 'SOL-1', x: 370, y: 450 },
    { id: 'SOL-2', x: 390, y: 450 },
    { id: 'SOL-3', x: 410, y: 450 },
    { id: 'SOL-4', x: 430, y: 450 }
  ];

  const [missiles, setMissiles] = useState([]);
  const [flares, setFlares] = useState([]);
  const [explosions, setExplosions] = useState([]);
  
  const lastAutoFire = useRef(0);
  const movementRef = useRef({ dx: 0, dy: 0 });

  // AI Tactical Advisory & Probability States
  const [advisorText, setAdvisorText] = useState('SYSTEM READY. INITIATE TRACKING.');
  const [hitProbability, setHitProbability] = useState(0);
  const [enemyStrategy, setEnemyStrategy] = useState('SCANNING...');

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

  const fireMissile = () => { if (baseHealth > 0) setMissiles(prev => [...prev, { x: ownShip.x, y: ownShip.y, speed: 12, type: 'MANUAL', targetId: null }]); };
  const deployFlare = () => { if (baseHealth > 0) setFlares(prev => [...prev, { x: ownShip.x, y: ownShip.y, life: 100 }]); };

  const handleTouchMove = (dx, dy) => (e) => { e.preventDefault(); movementRef.current = { dx, dy }; };
  const handleTouchStop = (e) => { e.preventDefault(); movementRef.current = { dx: 0, dy: 0 }; };

  // Main Simulation Loop
  useEffect(() => {
    let animationFrameId;
    let lastTime = performance.now();

    const loop = (time) => {
      if (time - lastTime > 30) {
        lastTime = time;

        // Jet Movement
        setOwnShip(p => ({
          x: Math.max(20, Math.min(780, p.x + movementRef.current.dx)),
          y: Math.max(20, Math.min(480, p.y + movementRef.current.dy))
        }));

        if (isAIActive && baseHealth > 0) {
          const cx = 400, cy = 250;
          const sweepAngle = (Date.now() / 1200) % (Math.PI * 2);

          // 1. Enemy Swarm AI Movement & Damage Logic
          setEnemies(prevEnemies => {
            let activeEnemies = prevEnemies.map(enemy => {
              if (enemy.health <= 0) return enemy;

              let tx = basePos.x, ty = basePos.y;
              if (flares.length > 0) {
                tx = flares[0].x + Math.sin(Date.now() / 100) * 50;
                ty = flares[0].y + Math.cos(Date.now() / 100) * 50;
              }

              const edx = tx - enemy.x, edy = ty - enemy.y;
              const edist = Math.sqrt(edx * edx + edy * edy);
              const spd = mode === 'WAR' ? enemy.speed * 1.5 : enemy.speed;

              if (edist < 35 && flares.length === 0) {
                setBaseHealth(h => Math.max(0, h - 0.8));
                setExplosions(ex => [...ex, { x: basePos.x + (Math.random()*40 - 20), y: basePos.y - 10, life: 5 }]);
              }

              if (edist > 5) {
                return { ...enemy, x: enemy.x + (edx / edist) * spd, y: enemy.y + (edy / edist) * spd };
              }
              return enemy;
            });

            // 2. Continuous SAM Missile Fire & AI Advisory Engine
            const aliveEnemies = activeEnemies.filter(e => e.health > 0);
            
            if (aliveEnemies.length > 0) {
              // Find closest enemy to HQ
              let closest = aliveEnemies.reduce((min, e) => {
                let d = Math.sqrt(Math.pow(e.x - basePos.x, 2) + Math.pow(e.y - basePos.y, 2));
                return d < min.dist ? { enemy: e, dist: d } : min;
              }, { enemy: aliveEnemies[0], dist: 9999 });

              let target = closest.enemy;
              let targetDist = Math.floor(closest.dist);

              // Calculate Hit Probability %
              let prob = Math.min(98, Math.max(20, 100 - Math.floor(targetDist / 5)));
              setHitProbability(prob);

              // Set Enemy Strategy Text
              if (targetDist < 150) setEnemyStrategy('PINPOINT SWARM STRIKE ON HQ');
              else if (targetDist < 300) setEnemyStrategy('TACTICAL FLANKING ATTACK');
              else setEnemyStrategy('LONG-RANGE HIGH ALTITUDE APPROACH');

              // Commander Strategic Suggestion System
              if (targetDist < 120) {
                setAdvisorText(`⚠️ CRITICAL: ${target.id} CLOSE TO TANKS/SOLDIERS! ENGAGE JET IMMEDIATELY!`);
              } else if (targetDist < 250) {
                setAdvisorText(`💡 SUGGESTION: USE GROUND TANKS / SAM COVER. FLY JET TO INTERCEPT ${target.id}.`);
              } else {
                setAdvisorText(`🛡️ RADAR DETECTED SWARM. LET AUTO-SAM WEAKEN ENEMY FIRST.`);
              }

              // Check if Radar Sweep intersects target -> CONTINUOUS AUTOMATIC LAUNCH
              let objAngle = Math.atan2(target.y - cy, target.x - cx);
              if (objAngle < 0) objAngle += Math.PI * 2;
              let diff = sweepAngle - objAngle;
              if (diff < 0) diff += Math.PI * 2;

              // Continuous SAM Fire (reduced cooldown to 400ms for continuous firing on sweep)
              if (diff < 0.5 && Date.now() - lastAutoFire.current > 400 && flares.length === 0) {
                setMissiles(prev => [...prev, { x: basePos.x + 30, y: basePos.y - 15, speed: 11, type: 'AUTO', targetId: target.id }]);
                lastAutoFire.current = Date.now();
              }
            } else {
              setAdvisorText('🎉 ALL THREATS NEUTRALIZED. HQ SECURE.');
              setHitProbability(0);
              setEnemyStrategy('NONE');
            }

            return activeEnemies;
          });

          // 3. Missiles Movement & Damage System
          setMissiles(prevMissiles => {
            return prevMissiles.map(m => {
              // Find target enemy or nearest alive enemy
              let activeEnemies = enemies.filter(e => e.health > 0);
              if (activeEnemies.length === 0) return null;

              let targetEnemy = activeEnemies.find(e => e.id === m.targetId) || activeEnemies[0];

              const mdx = targetEnemy.x - m.x, mdy = targetEnemy.y - m.y;
              const mdist = Math.sqrt(mdx * mdx + mdy * mdy);

              if (mdist < 25) {
                // Hit enemy!
                setEnemies(prev => prev.map(e => e.id === targetEnemy.id ? { ...e, health: Math.max(0, e.health - 35) } : e));
                setScore(s => s + 150);
                setExplosions(ex => [...ex, { x: targetEnemy.x, y: targetEnemy.y, life: 15 }]);
                return null;
              }
              if (mdist < 5) return null;
              return { ...m, x: m.x + (mdx / mdist) * m.speed, y: m.y + (mdy / mdist) * m.speed };
            }).filter(Boolean);
          });

          setFlares(prev => prev.map(f => ({ ...f, life: f.life - 2 })).filter(f => f.life > 0));
          setExplosions(prev => prev.map(e => ({ ...e, life: e.life - 1 })).filter(e => e.life > 0));
        }
      }

      // --- CANVAS DRAWING (Tactical Screen) ---
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const cx = canvas.width / 2, cy = canvas.height / 2;
        const sweepAngle = (Date.now() / 1200) % (Math.PI * 2);

        // Grid & Radar BG
        ctx.fillStyle = 'rgba(2, 6, 23, 0.4)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = 'rgba(30, 41, 59, 0.6)'; ctx.lineWidth = 1;
        for (let r = 50; r <= 450; r += 50) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(canvas.width, cy); ctx.stroke();

        // Green Sweep Beam
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

        // Base HQ
        const baseIllum = getIllumination(basePos.x, basePos.y);
        ctx.beginPath(); ctx.rect(basePos.x - 25, basePos.y - 15, 50, 30);
        ctx.fillStyle = `rgba(56, 189, 248, ${baseIllum > 0.8 ? 0.4 : 0.05})`; ctx.fill();
        ctx.strokeStyle = `rgba(56, 189, 248, ${Math.max(0.3, baseIllum)})`; ctx.lineWidth = baseIllum > 0.8 ? 2 : 1; ctx.stroke();
        drawTacticalText(`HQ [${Math.floor(baseHealth)}%]`, basePos.x - 25, basePos.y + 30, `rgba(56, 189, 248, ${Math.max(0.5, baseIllum)})`);
        
        // Auto SAM Launcher
        ctx.beginPath(); ctx.arc(basePos.x + 30, basePos.y - 10, 6, 0, Math.PI*2);
        ctx.strokeStyle = (Date.now() - lastAutoFire.current < 200) ? '#ff0000' : '#eab308'; 
        ctx.lineWidth = 2; ctx.stroke();
        drawTacticalText('SAM', basePos.x + 38, basePos.y - 10, '#eab308');

        // Draw Ground Tanks 🪖
        tanks.forEach(t => {
          ctx.beginPath(); ctx.rect(t.x - 10, t.y - 6, 20, 12);
          ctx.strokeStyle = '#22c55e'; ctx.stroke();
          drawTacticalText('TANK', t.x - 12, t.y + 16, '#22c55e');
        });

        // Draw Soldiers 🎖️
        soldiers.forEach(s => {
          ctx.beginPath(); ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#4ade80'; ctx.fill();
        });

        // Own Jet (Blue)
        const jetIllum = getIllumination(ownShip.x, ownShip.y);
        ctx.beginPath(); ctx.arc(ownShip.x, ownShip.y, 12, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(96, 165, 250, ${jetIllum > 0.8 ? 0.6 : 0.1})`; ctx.fill();
        ctx.strokeStyle = `rgba(96, 165, 250, ${Math.max(0.4, jetIllum)})`; ctx.lineWidth = jetIllum > 0.8 ? 2 : 1; ctx.stroke();
        drawTacticalText('BLU-01', ownShip.x + 15, ownShip.y - 5, `rgba(96, 165, 250, ${Math.max(0.5, jetIllum)})`);

        // Multiple Enemies Rendering 🛸
        enemies.forEach(enemy => {
          if (enemy.health > 0) {
            const enemyIllum = getIllumination(enemy.x, enemy.y);
            if (enemyIllum > 0.7) {
              ctx.beginPath(); ctx.arc(enemy.x, enemy.y, 30 * (1 - enemyIllum) + 15, 0, Math.PI*2);
              ctx.strokeStyle = `rgba(255, 0, 0, ${(enemyIllum - 0.7) * 3})`; ctx.lineWidth = 3; ctx.stroke();
            }
            ctx.beginPath();
            ctx.moveTo(enemy.x, enemy.y - 12); ctx.lineTo(enemy.x + 12, enemy.y);
            ctx.lineTo(enemy.x, enemy.y + 12); ctx.lineTo(enemy.x - 12, enemy.y); ctx.closePath();
            
            if (enemyIllum > 0.7) { ctx.fillStyle = '#ff0000'; ctx.shadowBlur = 15; ctx.shadowColor = '#ff0000'; } 
            else { ctx.fillStyle = 'rgba(255, 0, 0, 0.2)'; ctx.shadowBlur = 0; }
            ctx.fill();
            ctx.strokeStyle = `rgba(255, 50, 50, ${Math.max(0.4, enemyIllum)})`; ctx.lineWidth = enemyIllum > 0.7 ? 2.5 : 1; ctx.stroke();
            ctx.shadowBlur = 0;
            drawTacticalText(`${enemy.id} [${enemy.health}%]`, enemy.x + 14, enemy.y - 5, `rgba(255, 50, 50, ${Math.max(0.4, enemyIllum)})`);
          }
        });

        // Missiles & Flares
        flares.forEach(f => {
          ctx.beginPath(); ctx.moveTo(f.x - 5, f.y - 5); ctx.lineTo(f.x + 5, f.y + 5);
          ctx.moveTo(f.x + 5, f.y - 5); ctx.lineTo(f.x - 5, f.y + 5);
          ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2; ctx.stroke();
        });
        
        missiles.forEach(m => {
          ctx.beginPath(); ctx.arc(m.x, m.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = m.type === 'AUTO' ? '#eab308' : '#ffffff'; 
          if (m.type === 'AUTO') { ctx.shadowBlur = 8; ctx.shadowColor = '#eab308'; }
          ctx.fill(); ctx.shadowBlur = 0;
        });

        explosions.forEach(e => {
          ctx.beginPath(); ctx.arc(e.x, e.y, (15 - e.life) * 2, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(239, 68, 68, ${e.life / 15})`; ctx.lineWidth = 3; ctx.stroke();
        });

        if (baseHealth <= 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#ef4444'; ctx.font = 'bold 28px "Courier New", monospace'; ctx.fillText('SYSTEM FAILURE: HQ BREACHED', 160, 240);
        }
      }
      animationFrameId = requestAnimationFrame(loop);
    };
    
    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isAIActive, ownShip, enemies, mode, flares, baseHealth, missiles, explosions]);

  const handleReset = () => {
    setOwnShip({ x: 150, y: 350 });
    setEnemies([
      { id: 'TRK-01', x: 700, y: 80, health: 100, speed: 1.2 },
      { id: 'TRK-02', x: 650, y: 420, health: 100, speed: 1.0 },
      { id: 'TRK-03', x: 750, y: 250, health: 100, speed: 1.5 }
    ]);
    setMissiles([]); setFlares([]); setExplosions([]);
    setBaseHealth(100); setScore(0);
  };

  const btnStyle = { padding: '15px', backgroundColor: '#1e293b', color: 'white', border: '1px solid #334155', borderRadius: '8px', touchAction: 'none', userSelect: 'none', fontWeight: 'bold', minWidth: '55px' };

  return (
    <div style={{ backgroundColor: '#020617', color: 'white', minHeight: '100vh', padding: '10px', fontFamily: '"Courier New", monospace', overflowX: 'hidden' }}>
      <header style={{ borderBottom: '1px solid #1e293b', paddingBottom: '10px', marginBottom: '10px' }}>
        <h1 style={{ color: '#38bdf8', margin: 0, fontSize: '20px' }}>DRDO-C2 // TACTICAL COMMAND CENTER</h1>
      </header>

      {/* AI Commander Tactical Suggestion Box */}
      <div style={{ backgroundColor: '#1e1b4b', border: '1px solid #6366f1', padding: '12px', borderRadius: '6px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '20px' }}>🧠</span>
        <div>
          <div style={{ color: '#818cf8', fontSize: '11px', fontWeight: 'bold' }}>AI COMMANDER STRATEGIC ADVISORY</div>
          <div style={{ color: '#e0e7ff', fontSize: '13px', fontWeight: 'bold', marginTop: '2px' }}>{advisorText}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
        
        {/* Main Radar Screen */}
        <div style={{ flex: '1 1 500px' }}>
          <div style={{ marginBottom: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => setIsAIActive(!isAIActive)} style={{ padding: '8px 16px', backgroundColor: isAIActive ? '#7f1d1d' : '#14532d', color: isAIActive ? '#fca5a5' : '#86efac', border: '1px solid ' + (isAIActive ? '#ef4444' : '#22c55e'), fontFamily: 'inherit', borderRadius: '4px', cursor: 'pointer' }}>
              {isAIActive ? 'HALT SIMULATION' : 'INITIATE TRACKING'}
            </button>
            <button onClick={handleReset} style={{ padding: '8px 16px', backgroundColor: '#0f172a', color: '#94a3b8', border: '1px solid #334155', fontFamily: 'inherit', borderRadius: '4px', cursor: 'pointer' }}>
              RESET UNITS
            </button>
          </div>

          <div style={{ border: '1px solid #334155', backgroundColor: '#020617', width: '100%', overflow: 'hidden' }}>
            <canvas ref={canvasRef} width={800} height={500} style={{ display: 'block', width: '100%', height: 'auto' }} />
          </div>

          {/* Mobile On-Screen Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#0f172a', padding: '10px', borderRadius: '6px', border: '1px solid #1e293b', gap: '10px', marginTop: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', maxWidth: '180px' }}>
              <div></div>
              <button onPointerDown={handleTouchMove(0, -15)} onPointerUp={handleTouchStop} onPointerLeave={handleTouchStop} style={btnStyle}>⬆️</button>
              <div></div>
              <button onPointerDown={handleTouchMove(-15, 0)} onPointerUp={handleTouchStop} onPointerLeave={handleTouchStop} style={btnStyle}>⬅️</button>
              <button onPointerDown={handleTouchMove(0, 15)} onPointerUp={handleTouchStop} onPointerLeave={handleTouchStop} style={btnStyle}>⬇️</button>
              <button onPointerDown={handleTouchMove(15, 0)} onPointerUp={handleTouchStop} onPointerLeave={handleTouchStop} style={btnStyle}>➡️</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
              <button onClick={fireMissile} style={{ ...btnStyle, backgroundColor: '#dc2626', padding: '15px' }}>🚀 FIRE</button>
              <button onClick={deployFlare} style={{ ...btnStyle, backgroundColor: '#3b82f6', padding: '10px' }}>✨ FLARE</button>
            </div>
          </div>
        </div>

        {/* Tactical Strategy & Analytics Side Panel */}
        <div style={{ width: '280px', backgroundColor: '#0f172a', padding: '15px', border: '1px solid #1e293b', borderRadius: '6px', height: 'fit-content' }}>
          <h2 style={{ color: '#38bdf8', fontSize: '15px', marginTop: 0, borderBottom: '1px solid #1e293b', paddingBottom: '8px' }}>STRATEGY & METRICS</h2>
          
          <div style={{ display: 'grid', gap: '12px', marginTop: '12px' }}>
            
            {/* Probability % Display */}
            <div style={{ backgroundColor: '#1e293b', padding: '10px', borderRadius: '4px', borderLeft: '3px solid #22c55e' }}>
              <div style={{ color: '#94a3b8', fontSize: '10px' }}>INTERCEPT HIT PROBABILITY</div>
              <div style={{ fontSize: '24px', color: hitProbability > 70 ? '#4ade80' : hitProbability > 40 ? '#facc15' : '#ef4444', fontWeight: 'bold' }}>
                {hitProbability}%
              </div>
            </div>

            {/* Enemy Strategy Display */}
            <div style={{ backgroundColor: '#1e293b', padding: '10px', borderRadius: '4px', borderLeft: '3px solid #ef4444' }}>
              <div style={{ color: '#94a3b8', fontSize: '10px' }}>ENEMY STRATEGY DETECTED</div>
              <div style={{ fontSize: '11px', color: '#fca5a5', fontWeight: 'bold', marginTop: '4px' }}>
                {enemyStrategy}
              </div>
            </div>

            {/* Base & Units Status */}
            <div>
              <div style={{ color: '#64748b', fontSize: '10px' }}>HQ INTEGRITY</div>
              <div style={{ fontSize: '18px', color: baseHealth > 30 ? '#38bdf8' : '#ef4444' }}>{Math.floor(baseHealth)}%</div>
            </div>

            {/* Enemy Targets Status */}
            <div style={{ backgroundColor: '#090d16', padding: '10px', borderRadius: '4px' }}>
              <div style={{ color: '#38bdf8', fontSize: '11px', marginBottom: '6px', fontWeight: 'bold' }}>TARGET SWARM LIST</div>
              {enemies.map(e => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: e.health > 0 ? '#f87171' : '#4ade80', marginBottom: '3px' }}>
                  <span>{e.id}:</span>
                  <span>{e.health > 0 ? `${e.health}% HP` : 'DESTROYED'}</span>
                </div>
              ))}
            </div>

            {/* Ground Forces */}
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
              <div>🛡️ Ground Defense: <b style={{ color: '#4ade80' }}>2 TANKS, 4 INFANTRY</b></div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}