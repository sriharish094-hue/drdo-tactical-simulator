import React, { useState, useEffect, useRef } from 'react';

export default function App() {
  const canvasRef = useRef(null);
  const [isAIActive, setIsAIActive] = useState(false);
  const [mode, setMode] = useState('PEACE');
  const [score, setScore] = useState(0);
  const [baseHealth, setBaseHealth] = useState(100);
  
  // Widescreen Tactical Positions (Center of 1000x600 is 500, 300)
  const [ownShip, setOwnShip] = useState({ x: 450, y: 350 });
  const basePos = { x: 500, y: 300 }; // HQ moved to absolute center of radar
  const radarRadius = 280; // Size of the circular radar

  // Enemies spawn OUTSIDE the radar radius
  const [enemies, setEnemies] = useState([
    { id: 'TRK-01', x: 920, y: 80, health: 100, speed: 1.2 },
    { id: 'TRK-02', x: 100, y: 520, health: 100, speed: 1.0 },
    { id: 'TRK-03', x: 880, y: 550, health: 100, speed: 1.5 }
  ]);

  // Defenses positioned around the center HQ
  const tanks = [
    { id: 'TANK-1', x: 440, y: 350 },
    { id: 'TANK-2', x: 560, y: 350 }
  ];
  const soldiers = [
    { id: 'SOL-1', x: 470, y: 370 }, { id: 'SOL-2', x: 490, y: 370 },
    { id: 'SOL-3', x: 510, y: 370 }, { id: 'SOL-4', x: 530, y: 370 }
  ];

  const [missiles, setMissiles] = useState([]);
  const [flares, setFlares] = useState([]);
  const [explosions, setExplosions] = useState([]);
  
  const lastAutoFire = useRef(0);
  const lastTankFire = useRef({ 'TANK-1': 0, 'TANK-2': 0 });
  const movementRef = useRef({ dx: 0, dy: 0 });

  const [advisorText, setAdvisorText] = useState('SYSTEM READY. AWAITING COMMANDER DIRECTIVE.');
  const [hitProbability, setHitProbability] = useState(0);
  const [enemyStrategy, setEnemyStrategy] = useState('SCANNING BORDERS...');

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
      if (['ArrowUp', 'w', 'W', 'ArrowDown', 's', 'S', 'ArrowLeft', 'a', 'A', 'ArrowRight', 'd', 'D'].includes(e.key)) movementRef.current = { dx: 0, dy: 0 };
    };
    window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, [baseHealth]);

  const fireMissile = () => { if (baseHealth > 0) setMissiles(prev => [...prev, { x: ownShip.x, y: ownShip.y, speed: 12, type: 'MANUAL', targetId: null }]); };
  const deployFlare = () => { if (baseHealth > 0) setFlares(prev => [...prev, { x: ownShip.x, y: ownShip.y, life: 100 }]); };
  const handleTouchMove = (dx, dy) => (e) => { e.preventDefault(); movementRef.current = { dx, dy }; };
  const handleTouchStop = (e) => { e.preventDefault(); movementRef.current = { dx: 0, dy: 0 }; };

  useEffect(() => {
    let animationFrameId;
    let lastTime = performance.now();

    const loop = (time) => {
      if (time - lastTime > 30) {
        lastTime = time;
        setOwnShip(p => ({ x: Math.max(20, Math.min(980, p.x + movementRef.current.dx)), y: Math.max(20, Math.min(580, p.y + movementRef.current.dy)) }));

        if (isAIActive && baseHealth > 0) {
          const cx = basePos.x, cy = basePos.y;
          const sweepAngle = (Date.now() / 1200) % (Math.PI * 2);

          setEnemies(prevEnemies => {
            let activeEnemies = prevEnemies.map(enemy => {
              if (enemy.health <= 0) return enemy;
              let tx = basePos.x, ty = basePos.y;
              if (flares.length > 0) { tx = flares[0].x + Math.sin(Date.now() / 100) * 50; ty = flares[0].y + Math.cos(Date.now() / 100) * 50; }
              const edx = tx - enemy.x, edy = ty - enemy.y;
              const edist = Math.sqrt(edx * edx + edy * edy);
              
              if (edist < 35 && flares.length === 0) {
                setBaseHealth(h => Math.max(0, h - 0.8));
                setExplosions(ex => [...ex, { x: basePos.x + (Math.random()*40 - 20), y: basePos.y - 10, life: 5 }]);
              }
              if (edist > 5) return { ...enemy, x: enemy.x + (edx / edist) * enemy.speed, y: enemy.y + (edy / edist) * enemy.speed };
              return enemy;
            });

            const aliveEnemies = activeEnemies.filter(e => e.health > 0);
            
            setMissiles(prevMissiles => {
              let newMissiles = [...prevMissiles];
              if (aliveEnemies.length > 0) {
                // Only track enemies INSIDE the radar for auto-systems
                let visibleEnemies = aliveEnemies.filter(e => Math.hypot(e.x - cx, e.y - cy) <= radarRadius);

                if (visibleEnemies.length > 0) {
                  let closest = visibleEnemies.reduce((min, e) => {
                    let d = Math.hypot(e.x - basePos.x, e.y - basePos.y);
                    return d < min.dist ? { enemy: e, dist: d } : min;
                  }, { enemy: visibleEnemies[0], dist: 9999 });

                  let target = closest.enemy;
                  let targetDist = Math.floor(closest.dist);

                  setHitProbability(Math.min(98, Math.max(20, 100 - Math.floor(targetDist / 5))));
                  if (targetDist < 100) setEnemyStrategy('CRITICAL: SWARM STRIKING HQ');
                  else if (targetDist < 200) setEnemyStrategy('TACTICAL ENGAGEMENT ZONE');
                  else setEnemyStrategy('TARGET DETECTED ON RADAR');

                  if (targetDist < 120) setAdvisorText(`⚠️ ALARM: ${target.id} BREACHED INNER DEFENSE! ENGAGE JET!`);
                  else setAdvisorText(`🚨 RADAR ALERT: BOGIES ENTERED AIRSPACE. SAM ACTIVE.`);

                  // SAM Auto Fire
                  let objAngle = Math.atan2(target.y - cy, target.x - cx);
                  if (objAngle < 0) objAngle += Math.PI * 2;
                  let diff = sweepAngle - objAngle;
                  if (diff < 0) diff += Math.PI * 2;

                  if (diff < 0.5 && Date.now() - lastAutoFire.current > 400 && flares.length === 0) {
                    newMissiles.push({ x: basePos.x + 20, y: basePos.y - 10, speed: 11, type: 'AUTO', targetId: target.id });
                    lastAutoFire.current = Date.now();
                  }

                  // Tank Auto Fire
                  tanks.forEach(tank => {
                    let closestToTank = visibleEnemies.reduce((min, e) => {
                      let d = Math.hypot(e.x - tank.x, e.y - tank.y);
                      return d < min.dist ? { enemy: e, dist: d } : min;
                    }, { enemy: null, dist: 9999 });

                    if (closestToTank.enemy && closestToTank.dist < 200 && Date.now() - (lastTankFire.current[tank.id] || 0) > 1500) {
                      newMissiles.push({ x: tank.x, y: tank.y - 10, speed: 9, type: 'TANK', targetId: closestToTank.enemy.id });
                      lastTankFire.current[tank.id] = Date.now();
                      setExplosions(ex => [...ex, { x: tank.x, y: tank.y - 15, life: 3 }]);
                    }
                  });
                } else {
                  setAdvisorText('SCANNING BORDERS. ALL CLEAR IN RADAR ZONE.');
                  setHitProbability(0); setEnemyStrategy('APPROACHING...');
                }
              }

              return newMissiles.map(m => {
                let activeTargets = enemies.filter(e => e.health > 0);
                if (activeTargets.length === 0) return null;
                let targetEnemy = activeTargets.find(e => e.id === m.targetId) || activeTargets[0];
                const mdist = Math.hypot(targetEnemy.x - m.x, targetEnemy.y - m.y);

                if (mdist < 25) {
                  let damage = m.type === 'TANK' ? 20 : 35;
                  setEnemies(prev => prev.map(e => e.id === targetEnemy.id ? { ...e, health: Math.max(0, e.health - damage) } : e));
                  setScore(s => s + 150);
                  setExplosions(ex => [...ex, { x: targetEnemy.x, y: targetEnemy.y, life: m.type === 'TANK' ? 10 : 15 }]);
                  return null;
                }
                if (mdist < 5) return null;
                return { ...m, x: m.x + ((targetEnemy.x - m.x) / mdist) * m.speed, y: m.y + ((targetEnemy.y - m.y) / mdist) * m.speed };
              }).filter(Boolean);
            });
            return activeEnemies;
          });
          setFlares(prev => prev.map(f => ({ ...f, life: f.life - 2 })).filter(f => f.life > 0));
          setExplosions(prev => prev.map(e => ({ ...e, life: e.life - 1 })).filter(e => e.life > 0));
        }
      }

      // --- CANVAS DRAWING ---
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const cx = basePos.x, cy = basePos.y; // Center of radar is HQ
        const sweepAngle = (Date.now() / 1200) % (Math.PI * 2);

        // Dark Background for whole monitor
        ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw Classic Circular Radar Bezel (Outer Ring)
        ctx.beginPath(); ctx.arc(cx, cy, radarRadius + 15, 0, Math.PI * 2);
        ctx.fillStyle = '#1e293b'; ctx.fill(); // Metal grey rim
        ctx.strokeStyle = '#475569'; ctx.lineWidth = 4; ctx.stroke();
        
        ctx.beginPath(); ctx.arc(cx, cy, radarRadius + 5, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a'; ctx.fill(); // Inner rim

        // RADAR INNER SCREEN (Clip everything inside the circle)
        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy, radarRadius, 0, Math.PI * 2);
        ctx.clip(); // Mask applied here!

        // Dark Green Radar Base
        ctx.fillStyle = '#022c11'; ctx.fill();

        // Radar Grid Lines
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)'; ctx.lineWidth = 1;
        for (let r = 50; r <= radarRadius; r += 50) {
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        }
        // Crosshairs
        ctx.beginPath(); ctx.moveTo(cx, cy - radarRadius); ctx.lineTo(cx, cy + radarRadius); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - radarRadius, cy); ctx.lineTo(cx + radarRadius, cy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - radarRadius*0.7, cy - radarRadius*0.7); ctx.lineTo(cx + radarRadius*0.7, cy + radarRadius*0.7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + radarRadius*0.7, cy - radarRadius*0.7); ctx.lineTo(cx - radarRadius*0.7, cy + radarRadius*0.7); ctx.stroke();

        // Green Conic Sweep
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(sweepAngle);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, radarRadius, 0, 0.25); ctx.lineTo(0, 0);
        const gradient = ctx.createLinearGradient(0, 0, radarRadius, 0);
        gradient.addColorStop(0, 'rgba(34, 197, 94, 0.6)'); gradient.addColorStop(1, 'rgba(34, 197, 94, 0)');
        ctx.fillStyle = gradient; ctx.fill();
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(radarRadius, 0);
        ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();

        // End of clipped area
        ctx.restore(); 

        const drawTacticalText = (text, x, y, color) => { ctx.fillStyle = color; ctx.font = '10px "Courier New", monospace'; ctx.fillText(text, x, y); };

        // Draw HQ (Center)
        ctx.beginPath(); ctx.rect(basePos.x - 20, basePos.y - 12, 40, 24);
        ctx.fillStyle = `rgba(56, 189, 248, 0.2)`; ctx.fill();
        ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 1; ctx.stroke();
        drawTacticalText(`HQ [${Math.floor(baseHealth)}%]`, basePos.x - 25, basePos.y + 25, '#38bdf8');
        
        ctx.beginPath(); ctx.arc(basePos.x + 25, basePos.y - 8, 5, 0, Math.PI*2);
        ctx.strokeStyle = (Date.now() - lastAutoFire.current < 200) ? '#ff0000' : '#eab308'; ctx.lineWidth = 2; ctx.stroke();

        // Draw Tanks
        tanks.forEach(t => {
          const isFiring = Date.now() - (lastTankFire.current[t.id] || 0) < 200;
          ctx.beginPath(); ctx.rect(t.x - 10, t.y - 6, 20, 12);
          ctx.strokeStyle = isFiring ? '#f97316' : '#22c55e'; 
          ctx.fillStyle = isFiring ? 'rgba(249, 115, 22, 0.4)' : 'transparent';
          ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x, t.y - 10); ctx.strokeStyle = isFiring ? '#f97316' : '#22c55e'; ctx.stroke();
          drawTacticalText('TANK', t.x - 12, t.y + 16, '#22c55e');
        });

        // Draw Soldiers
        soldiers.forEach(s => { ctx.beginPath(); ctx.arc(s.x, s.y, 3, 0, Math.PI * 2); ctx.fillStyle = '#4ade80'; ctx.fill(); });

        // Draw Jet
        ctx.beginPath(); ctx.arc(ownShip.x, ownShip.y, 10, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(96, 165, 250, 0.4)`; ctx.fill();
        ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 2; ctx.stroke();
        drawTacticalText('BLU-01', ownShip.x + 12, ownShip.y - 5, '#60a5fa');

        // Draw Enemies (The Color Change Logic)
        enemies.forEach(enemy => {
          if (enemy.health > 0) {
            const distToCenter = Math.hypot(enemy.x - cx, enemy.y - cy);
            const isInsideRadar = distToCenter <= radarRadius;

            if (isInsideRadar) {
              // ENEMY INSIDE RADAR - RED COLOR + TARGET UI
              ctx.beginPath(); ctx.arc(enemy.x, enemy.y, 6, 0, Math.PI*2);
              ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 2; ctx.stroke();
              
              // Target Line and Text (like in the image)
              ctx.beginPath(); ctx.moveTo(enemy.x + 6, enemy.y - 6); 
              ctx.lineTo(enemy.x + 15, enemy.y - 15); 
              ctx.lineTo(enemy.x + 35, enemy.y - 15); 
              ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 1.5; ctx.stroke();
              
              drawTacticalText(`TARGET`, enemy.x + 38, enemy.y - 12, '#ff0000');
              drawTacticalText(`[${enemy.health}%]`, enemy.x + 38, enemy.y - 2, '#ff0000');
            } else {
              // ENEMY OUTSIDE RADAR - GREY/STEALTH COLOR
              ctx.beginPath(); ctx.rect(enemy.x - 4, enemy.y - 4, 8, 8);
              ctx.fillStyle = '#475569'; ctx.fill(); // Slate grey
              drawTacticalText('UFO', enemy.x + 8, enemy.y, '#64748b');
            }
          }
        });

        // Draw Weapons
        flares.forEach(f => { ctx.beginPath(); ctx.moveTo(f.x - 5, f.y - 5); ctx.lineTo(f.x + 5, f.y + 5); ctx.moveTo(f.x + 5, f.y - 5); ctx.lineTo(f.x - 5, f.y + 5); ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2; ctx.stroke(); });
        missiles.forEach(m => {
          ctx.beginPath(); ctx.arc(m.x, m.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = m.type === 'AUTO' ? '#eab308' : (m.type === 'TANK' ? '#f97316' : '#ffffff');
          ctx.fill();
        });
        explosions.forEach(e => { ctx.beginPath(); ctx.arc(e.x, e.y, (15 - e.life) * 2, 0, Math.PI * 2); ctx.strokeStyle = `rgba(239, 68, 68, ${e.life / 15})`; ctx.lineWidth = 3; ctx.stroke(); });

        // Game Over
        if (baseHealth <= 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#ef4444'; ctx.font = 'bold 36px "Courier New", monospace'; ctx.fillText('SYSTEM FAILURE: HQ BREACHED', 220, 300);
        }
      }
      animationFrameId = requestAnimationFrame(loop);
    };
    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isAIActive, ownShip, enemies, mode, flares, baseHealth, missiles, explosions]);

  const handleReset = () => {
    setOwnShip({ x: 450, y: 350 });
    setEnemies([{ id: 'TRK-01', x: 920, y: 80, health: 100, speed: 1.2 }, { id: 'TRK-02', x: 100, y: 520, health: 100, speed: 1.0 }, { id: 'TRK-03', x: 880, y: 550, health: 100, speed: 1.5 }]);
    setMissiles([]); setFlares([]); setExplosions([]); setBaseHealth(100); setScore(0);
  };

  const btnStyle = { padding: '12px', backgroundColor: '#1e293b', color: 'white', border: '1px solid #334155', borderRadius: '6px', touchAction: 'none', userSelect: 'none', fontWeight: 'bold', cursor: 'pointer' };
  
  // Calculate threats (Only enemies INSIDE radar are counted as Active Threats)
  const activeThreats = enemies.filter(e => e.health > 0 && Math.hypot(e.x - basePos.x, e.y - basePos.y) <= radarRadius).length;

  return (
    <div style={{ backgroundColor: '#000000', color: 'white', minHeight: '100vh', padding: '15px', fontFamily: '"Courier New", monospace', backgroundImage: 'radial-gradient(circle, #0f172a 0%, #000000 90%)', display: 'flex', flexDirection: 'column' }}>
      
      {/* HEADER */}
      <header style={{ borderBottom: '1px solid #38bdf8', paddingBottom: '10px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexShrink: 0 }}>
        <div><h1 style={{ color: '#38bdf8', margin: 0, fontSize: '24px', textShadow: '0 0 10px rgba(56, 189, 248, 0.4)' }}>COMMANDER'S TERMINAL</h1></div>
        <div style={{ color: '#4ade80', fontSize: '12px', border: '1px solid #4ade80', padding: '4px 8px', borderRadius: '4px', backgroundColor: 'rgba(74, 222, 128, 0.1)' }}>STATUS: ONLINE</div>
      </header>

      {/* FULLSCREEN GRID LAYOUT */}
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 220px', gap: '20px', flex: 1, alignItems: 'stretch' }}>
        
        {/* LEFT COMPACT MONITOR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ backgroundColor: '#0f172a', padding: '15px', borderRadius: '6px', border: '1px solid #334155' }}>
            <h2 style={{ color: '#94a3b8', fontSize: '12px', marginTop: 0, marginBottom: '10px', borderBottom: '1px solid #1e293b', paddingBottom: '5px' }}>SYS CONTROLS</h2>
            <button onClick={() => setIsAIActive(!isAIActive)} style={{ width: '100%', padding: '10px', marginBottom: '8px', backgroundColor: isAIActive ? '#7f1d1d' : '#14532d', color: isAIActive ? '#fca5a5' : '#86efac', border: '1px solid ' + (isAIActive ? '#ef4444' : '#22c55e'), borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
              {isAIActive ? 'HALT TRACKING' : 'INITIATE TRACKING'}
            </button>
            <button onClick={handleReset} style={{ width: '100%', padding: '10px', backgroundColor: '#1e293b', color: '#cbd5e1', border: '1px solid #475569', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>RESET FIELD</button>
          </div>

          <div style={{ backgroundColor: '#1e1b4b', border: '1px solid #6366f1', padding: '12px', borderRadius: '6px' }}>
            <div style={{ color: '#818cf8', fontSize: '11px', fontWeight: 'bold', marginBottom: '6px' }}>AI ADVISORY</div>
            <div style={{ color: '#e0e7ff', fontSize: '12px', lineHeight: '1.4' }}>{advisorText}</div>
          </div>

          <div style={{ backgroundColor: 'rgba(20, 83, 45, 0.1)', padding: '12px', border: '1px solid #14532d', borderRadius: '6px' }}>
            <h2 style={{ color: '#4ade80', fontSize: '12px', marginTop: 0, borderBottom: '1px solid #14532d', paddingBottom: '6px' }}>🛡️ ALLIED FORCES</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', fontSize: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#86efac' }}>Jets:</span> <span style={{ color: '#4ade80', fontWeight: 'bold' }}>1 (BLU-01)</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#86efac' }}>Tanks:</span> <span style={{ color: '#4ade80', fontWeight: 'bold' }}>{tanks.length} (Active)</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#86efac' }}>Infantry:</span> <span style={{ color: '#4ade80', fontWeight: 'bold' }}>{soldiers.length} (Standby)</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#86efac' }}>SAMs:</span> <span style={{ color: '#eab308', fontWeight: 'bold' }}>1 (Auto)</span></div>
            </div>
          </div>
        </div>

        {/* CENTER MAXIMIZED WIDESCREEN RADAR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', height: '100%' }}>
          
          <div style={{ flex: 1, position: 'relative', border: '3px solid #1e293b', borderRadius: '8px', backgroundColor: '#020617', boxShadow: '0 0 30px rgba(0, 0, 0, 0.8)', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)', pointerEvents: 'none', zIndex: 10 }}></div>
            <canvas ref={canvasRef} width={1000} height={600} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#0f172a', padding: '10px 20px', borderRadius: '8px', border: '1px solid #1e293b' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
              <div></div><button onPointerDown={handleTouchMove(0, -15)} onPointerUp={handleTouchStop} onPointerLeave={handleTouchStop} style={{...btnStyle, padding: '8px'}}>W</button><div></div>
              <button onPointerDown={handleTouchMove(-15, 0)} onPointerUp={handleTouchStop} onPointerLeave={handleTouchStop} style={{...btnStyle, padding: '8px'}}>A</button>
              <button onPointerDown={handleTouchMove(0, 15)} onPointerUp={handleTouchStop} onPointerLeave={handleTouchStop} style={{...btnStyle, padding: '8px'}}>S</button>
              <button onPointerDown={handleTouchMove(15, 0)} onPointerUp={handleTouchStop} onPointerLeave={handleTouchStop} style={{...btnStyle, padding: '8px'}}>D</button>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button onClick={deployFlare} style={{ ...btnStyle, backgroundColor: '#3b82f6', height: '40px', padding: '0 15px', borderRadius: '20px', fontSize: '12px' }}>✨ FLARE</button>
              <button onClick={fireMissile} style={{ ...btnStyle, backgroundColor: '#dc2626', height: '55px', padding: '0 30px', borderRadius: '8px', fontSize: '16px', boxShadow: '0 4px 0 #991b1b' }}>🚀 FIRE</button>
            </div>
          </div>
        </div>

        {/* RIGHT COMPACT MONITOR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          <div style={{ backgroundColor: 'rgba(127, 29, 29, 0.1)', padding: '12px', border: '1px solid #7f1d1d', borderRadius: '6px' }}>
            <h2 style={{ color: '#ef4444', fontSize: '12px', marginTop: 0, borderBottom: '1px solid #7f1d1d', paddingBottom: '6px' }}>⚠️ THREAT RADAR</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', fontSize: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#fca5a5' }}>Threat:</span> <span style={{ color: activeThreats > 0 ? '#ef4444' : '#4ade80', fontWeight: 'bold' }}>{activeThreats > 0 ? 'ACTIVE' : 'CLEAR'}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#fca5a5' }}>In Radar:</span> <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{activeThreats} / 3</span></div>
              
              <div style={{ backgroundColor: '#451a1a', padding: '8px', borderRadius: '4px', marginTop: '5px' }}>
                <div style={{ color: '#fca5a5', fontSize: '10px', fontWeight: 'bold', marginBottom: '6px' }}>TARGET STATUS</div>
                {enemies.map(e => {
                  const dist = Math.hypot(e.x - basePos.x, e.y - basePos.y);
                  const status = e.health <= 0 ? 'DESTROYED' : (dist <= radarRadius ? `${e.health}% (LOCKED)` : 'STEALTH');
                  const col = e.health <= 0 ? '#78350f' : (dist <= radarRadius ? '#f87171' : '#94a3b8');
                  return (
                    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: col, marginTop: '4px' }}>
                      <span>{e.id}:</span> <span>{status}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: '#0f172a', padding: '12px', border: '1px solid #1e293b', borderRadius: '6px' }}>
            <h2 style={{ color: '#38bdf8', fontSize: '12px', marginTop: 0, borderBottom: '1px solid #1e293b', paddingBottom: '6px' }}>📊 LIVE METRICS</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              <div style={{ backgroundColor: '#1e293b', padding: '10px', borderRadius: '4px', borderLeft: '3px solid #22c55e' }}>
                <div style={{ color: '#94a3b8', fontSize: '10px' }}>HIT PROBABILITY</div>
                <div style={{ fontSize: '20px', color: hitProbability > 70 ? '#4ade80' : hitProbability > 40 ? '#facc15' : '#ef4444', fontWeight: 'bold' }}>{hitProbability}%</div>
              </div>
              <div style={{ backgroundColor: '#1e293b', padding: '10px', borderRadius: '4px', borderLeft: '3px solid #ef4444' }}>
                <div style={{ color: '#94a3b8', fontSize: '10px' }}>DETECTED STRATEGY</div>
                <div style={{ fontSize: '10px', color: '#fca5a5', fontWeight: 'bold', marginTop: '4px' }}>{enemyStrategy}</div>
              </div>
              <div style={{ backgroundColor: '#1e293b', padding: '10px', borderRadius: '4px', borderLeft: '3px solid #38bdf8' }}>
                <div style={{ color: '#94a3b8', fontSize: '10px' }}>HQ INTEGRITY</div>
                <div style={{ fontSize: '18px', color: baseHealth > 30 ? '#38bdf8' : '#ef4444', fontWeight: 'bold' }}>{Math.floor(baseHealth)}%</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}