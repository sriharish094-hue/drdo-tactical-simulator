import React, { useState, useEffect, useRef } from 'react';

export default function App() {
  const canvasRef = useRef(null);
  const [isAIActive, setIsAIActive] = useState(false);
  const [radarMode, setRadarMode] = useState('AIR'); // 'AIR' or 'NAVY'
  const [baseHealth, setBaseHealth] = useState(100);
  const [score, setScore] = useState(0);
  
  // Widescreen Maximized Dimensions
  const basePos = { x: 500, y: 400 }; 
  const radarRadius = 380; // Bigger radar radius!
  const [ownShip, setOwnShip] = useState({ x: 500, y: 460 });

  const [enemies, setEnemies] = useState([
    { id: 'TRK-01', type: 'FIGHTER JET', x: 950, y: 50, health: 100, speed: 1.8 },
    { id: 'DRN-02', type: 'STEALTH DRONE', x: 50, y: 650, health: 100, speed: 1.1 },
    { id: 'BMB-03', type: 'HEAVY BOMBER', x: 900, y: 700, health: 100, speed: 0.7 }
  ]);

  const units = [
    { id: 'DEF-1', x: 440, y: 450 },
    { id: 'DEF-2', x: 560, y: 450 }
  ];
  const smallUnits = [
    { id: 'MIN-1', x: 470, y: 470 }, { id: 'MIN-2', x: 490, y: 470 },
    { id: 'MIN-3', x: 510, y: 470 }, { id: 'MIN-4', x: 530, y: 470 }
  ];

  const [missiles, setMissiles] = useState([]);
  const [flares, setFlares] = useState([]);
  const [explosions, setExplosions] = useState([]);
  
  const lastAutoFire = useRef(0);
  const lastDefFire = useRef({ 'DEF-1': 0, 'DEF-2': 0 });
  const movementRef = useRef({ dx: 0, dy: 0 });

  const [advisorText, setAdvisorText] = useState('SYSTEM READY. AWAITING COMMANDER DIRECTIVE.');
  const [hitProbability, setHitProbability] = useState(0);
  const [enemyStrategy, setEnemyStrategy] = useState('SCANNING BORDERS...');

  // KEYBOARD ONLY CONTROLS
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

  // RESET / SWITCH MODE LOGIC
  const handleReset = (newMode = radarMode) => {
    setOwnShip({ x: 500, y: 460 });
    if (newMode === 'AIR') {
      setEnemies([
        { id: 'TRK-01', type: 'FIGHTER JET', x: 950, y: 50, health: 100, speed: 1.8 },
        { id: 'DRN-02', type: 'STEALTH DRONE', x: 50, y: 650, health: 100, speed: 1.1 },
        { id: 'BMB-03', type: 'HEAVY BOMBER', x: 900, y: 700, health: 100, speed: 0.7 }
      ]);
      setAdvisorText('AIRSPACE RADAR INITIALIZED.');
    } else {
      setEnemies([
        { id: 'SUB-01', type: 'ATTACK SUB', x: 950, y: 50, health: 100, speed: 1.3 },
        { id: 'FRG-02', type: 'FRIGATE', x: 50, y: 650, health: 100, speed: 0.9 },
        { id: 'CRU-03', type: 'BATTLE CRUISER', x: 900, y: 700, health: 100, speed: 0.6 }
      ]);
      setAdvisorText('NAVAL SONAR INITIALIZED. TRACKING SUBS.');
    }
    setMissiles([]); setFlares([]); setExplosions([]); setBaseHealth(100); setScore(0);
  };

  const toggleMode = () => {
    const nextMode = radarMode === 'AIR' ? 'NAVY' : 'AIR';
    setRadarMode(nextMode);
    handleReset(nextMode);
  };

  // CORE LOOP
  useEffect(() => {
    let animationFrameId;
    let lastTime = performance.now();

    const loop = (time) => {
      if (time - lastTime > 30) {
        lastTime = time;
        setOwnShip(p => ({ x: Math.max(20, Math.min(980, p.x + movementRef.current.dx)), y: Math.max(20, Math.min(780, p.y + movementRef.current.dy)) }));

        if (isAIActive && baseHealth > 0) {
          const cx = basePos.x, cy = basePos.y;
          const sweepAngle = (Date.now() / (radarMode === 'AIR' ? 1200 : 1600)) % (Math.PI * 2); // Sonar is slightly slower

          setEnemies(prevEnemies => {
            let activeEnemies = prevEnemies.map(enemy => {
              if (enemy.health <= 0) return enemy;
              let tx = basePos.x, ty = basePos.y;
              if (flares.length > 0) { tx = flares[0].x + Math.sin(Date.now() / 100) * 50; ty = flares[0].y + Math.cos(Date.now() / 100) * 50; }
              const edx = tx - enemy.x, edy = ty - enemy.y;
              const edist = Math.sqrt(edx * edx + edy * edy);
              
              if (edist < 40 && flares.length === 0) {
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
                let visibleEnemies = aliveEnemies.filter(e => Math.hypot(e.x - cx, e.y - cy) <= radarRadius);

                if (visibleEnemies.length > 0) {
                  let closest = visibleEnemies.reduce((min, e) => {
                    let d = Math.hypot(e.x - basePos.x, e.y - basePos.y);
                    return d < min.dist ? { enemy: e, dist: d } : min;
                  }, { enemy: visibleEnemies[0], dist: 9999 });

                  let target = closest.enemy;
                  let targetDist = Math.floor(closest.dist);

                  setHitProbability(Math.min(98, Math.max(20, 100 - Math.floor(targetDist / 5))));
                  if (targetDist < 120) setEnemyStrategy(radarMode === 'AIR' ? 'CRITICAL: SWARM STRIKING HQ' : 'CRITICAL: TORPEDO RANGE');
                  else if (targetDist < 250) setEnemyStrategy('TACTICAL ENGAGEMENT ZONE');
                  else setEnemyStrategy(radarMode === 'AIR' ? 'TARGET DETECTED ON RADAR' : 'SONAR CONTACT ACQUIRED');

                  if (targetDist < 120) setAdvisorText(`⚠️ ALARM: ${target.id} (${target.type}) BREACHED INNER DEFENSE!`);
                  else setAdvisorText(`🚨 ${radarMode === 'AIR' ? 'RADAR' : 'SONAR'} ALERT: BOGIES IN RANGE. AUTO-DEFENSE ACTIVE.`);

                  let objAngle = Math.atan2(target.y - cy, target.x - cx);
                  if (objAngle < 0) objAngle += Math.PI * 2;
                  let diff = sweepAngle - objAngle;
                  if (diff < 0) diff += Math.PI * 2;

                  if (diff < 0.5 && Date.now() - lastAutoFire.current > 400 && flares.length === 0) {
                    newMissiles.push({ x: basePos.x + 20, y: basePos.y - 10, speed: 11, type: 'AUTO', targetId: target.id });
                    lastAutoFire.current = Date.now();
                  }

                  units.forEach(unit => {
                    let closestToUnit = visibleEnemies.reduce((min, e) => {
                      let d = Math.hypot(e.x - unit.x, e.y - unit.y);
                      return d < min.dist ? { enemy: e, dist: d } : min;
                    }, { enemy: null, dist: 9999 });

                    if (closestToUnit.enemy && closestToUnit.dist < 280 && Date.now() - (lastDefFire.current[unit.id] || 0) > 1500) {
                      newMissiles.push({ x: unit.x, y: unit.y - 10, speed: 9, type: 'TANK', targetId: closestToUnit.enemy.id });
                      lastDefFire.current[unit.id] = Date.now();
                      setExplosions(ex => [...ex, { x: unit.x, y: unit.y - 15, life: 3 }]);
                    }
                  });
                } else {
                  setAdvisorText(`SCANNING BORDERS. NO CONTACTS IN ${radarMode === 'AIR' ? 'RADAR' : 'SONAR'}.`);
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
        const cx = basePos.x, cy = basePos.y; 
        const sweepAngle = (Date.now() / (radarMode === 'AIR' ? 1200 : 1600)) % (Math.PI * 2);

        // Styling based on Mode
        const isNavy = radarMode === 'NAVY';
        const radarBgColor = isNavy ? '#041e3a' : '#022c11';
        const radarLineColor = isNavy ? 'rgba(56, 189, 248, 0.4)' : 'rgba(34, 197, 94, 0.4)';
        const radarSweepColorSolid = isNavy ? '#38bdf8' : '#4ade80';
        const radarSweepColorFade = isNavy ? 'rgba(56, 189, 248, 0.6)' : 'rgba(34, 197, 94, 0.6)';
        const radarSweepColorClear = isNavy ? 'rgba(56, 189, 248, 0)' : 'rgba(34, 197, 94, 0)';

        ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Radar Outer Bezel
        ctx.beginPath(); ctx.arc(cx, cy, radarRadius + 15, 0, Math.PI * 2);
        ctx.fillStyle = '#1e293b'; ctx.fill(); 
        ctx.strokeStyle = '#475569'; ctx.lineWidth = 4; ctx.stroke();
        
        ctx.beginPath(); ctx.arc(cx, cy, radarRadius + 5, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a'; ctx.fill();

        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy, radarRadius, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = radarBgColor; ctx.fill();

        // Radar Grid
        ctx.strokeStyle = radarLineColor; ctx.lineWidth = 1;
        for (let r = 50; r <= radarRadius; r += 50) {
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.beginPath(); ctx.moveTo(cx, cy - radarRadius); ctx.lineTo(cx, cy + radarRadius); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - radarRadius, cy); ctx.lineTo(cx + radarRadius, cy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - radarRadius*0.7, cy - radarRadius*0.7); ctx.lineTo(cx + radarRadius*0.7, cy + radarRadius*0.7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + radarRadius*0.7, cy - radarRadius*0.7); ctx.lineTo(cx - radarRadius*0.7, cy + radarRadius*0.7); ctx.stroke();

        // Sweep
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(sweepAngle);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, radarRadius, 0, 0.25); ctx.lineTo(0, 0);
        const gradient = ctx.createLinearGradient(0, 0, radarRadius, 0);
        gradient.addColorStop(0, radarSweepColorFade); gradient.addColorStop(1, radarSweepColorClear);
        ctx.fillStyle = gradient; ctx.fill();
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(radarRadius, 0);
        ctx.strokeStyle = radarSweepColorSolid; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();

        ctx.restore(); // END MASK

        const drawTacticalText = (text, x, y, color) => { ctx.fillStyle = color; ctx.font = '10px "Courier New", monospace'; ctx.fillText(text, x, y); };

        // HQ
        ctx.beginPath(); ctx.rect(basePos.x - 20, basePos.y - 12, 40, 24);
        ctx.fillStyle = `rgba(56, 189, 248, 0.2)`; ctx.fill();
        ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 1; ctx.stroke();
        drawTacticalText(`HQ [${Math.floor(baseHealth)}%]`, basePos.x - 25, basePos.y + 25, '#38bdf8');
        
        ctx.beginPath(); ctx.arc(basePos.x + 25, basePos.y - 8, 5, 0, Math.PI*2);
        ctx.strokeStyle = (Date.now() - lastAutoFire.current < 200) ? '#ff0000' : '#eab308'; ctx.lineWidth = 2; ctx.stroke();

        // Defense Units (Tanks or Cruisers)
        units.forEach(u => {
          const isFiring = Date.now() - (lastDefFire.current[u.id] || 0) < 200;
          ctx.beginPath(); ctx.rect(u.x - 10, u.y - 6, 20, 12);
          ctx.strokeStyle = isFiring ? '#f97316' : (isNavy ? '#38bdf8' : '#22c55e'); 
          ctx.fillStyle = isFiring ? 'rgba(249, 115, 22, 0.4)' : 'transparent';
          ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(u.x, u.y - 10); ctx.strokeStyle = isFiring ? '#f97316' : (isNavy ? '#38bdf8' : '#22c55e'); ctx.stroke();
          drawTacticalText(isNavy ? 'CRUISER' : 'TANK', u.x - 16, u.y + 16, isNavy ? '#38bdf8' : '#22c55e');
        });

        smallUnits.forEach(s => { ctx.beginPath(); ctx.arc(s.x, s.y, 3, 0, Math.PI * 2); ctx.fillStyle = isNavy ? '#38bdf8' : '#4ade80'; ctx.fill(); });

        // Own Ship/Jet
        ctx.beginPath(); ctx.arc(ownShip.x, ownShip.y, 10, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(96, 165, 250, 0.4)`; ctx.fill();
        ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 2; ctx.stroke();
        drawTacticalText(isNavy ? 'SUB-01' : 'BLU-01', ownShip.x + 12, ownShip.y - 5, '#60a5fa');

        // ENEMIES
        enemies.forEach(enemy => {
          if (enemy.health > 0) {
            const distToCenter = Math.hypot(enemy.x - cx, enemy.y - cy);
            const isInsideRadar = distToCenter <= radarRadius;
            
            const jetColor = isInsideRadar ? '#ef4444' : '#eab308'; 
            const glowColor = isInsideRadar ? '#dc2626' : '#ca8a04';

            let tx = basePos.x, ty = basePos.y;
            if (flares.length > 0) { tx = flares[0].x; ty = flares[0].y; }
            const angle = Math.atan2(ty - enemy.y, tx - enemy.x) + (Math.PI / 2);

            ctx.save();
            ctx.translate(enemy.x, enemy.y);
            ctx.rotate(angle);

            ctx.beginPath();
            if (isNavy) {
              // Naval Submarine Shape
              ctx.moveTo(0, -14);
              ctx.lineTo(4, -8);
              ctx.lineTo(4, 10);
              ctx.lineTo(0, 14);
              ctx.lineTo(-4, 10);
              ctx.lineTo(-4, -8);
            } else {
              // Air Jet Shape
              ctx.moveTo(0, -16); 
              ctx.lineTo(4, -4);
              ctx.lineTo(16, 2); 
              ctx.lineTo(4, 6);
              ctx.lineTo(2, 12);
              ctx.lineTo(8, 16); 
              ctx.lineTo(-8, 16); 
              ctx.lineTo(-2, 12);
              ctx.lineTo(-4, 6);
              ctx.lineTo(-16, 2); 
              ctx.lineTo(-4, -4);
            }
            ctx.closePath();

            ctx.fillStyle = jetColor;
            ctx.shadowBlur = 10;
            ctx.shadowColor = glowColor;
            ctx.fill();
            
            ctx.lineWidth = 1;
            ctx.strokeStyle = isInsideRadar ? '#ffffff' : '#000000';
            ctx.stroke();
            ctx.restore();

            // DISPLAY TELEMETRY
            if (isInsideRadar) {
              ctx.beginPath(); ctx.moveTo(enemy.x + 12, enemy.y - 12); 
              ctx.lineTo(enemy.x + 20, enemy.y - 20); 
              ctx.lineTo(enemy.x + 40, enemy.y - 20); 
              ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 1.5; ctx.stroke();
              
              drawTacticalText(`${enemy.id} [${enemy.type}]`, enemy.x + 43, enemy.y - 22, '#ff0000');
              drawTacticalText(`SPD: MACH ${enemy.speed.toFixed(1)}`, enemy.x + 43, enemy.y - 10, '#ff0000');
              drawTacticalText(`HP:  ${enemy.health}%`, enemy.x + 43, enemy.y + 2, '#ff0000');
            } else {
              drawTacticalText(`BOGEY [MACH ${enemy.speed.toFixed(1)}]`, enemy.x + 18, enemy.y, '#facc15');
            }
          }
        });

        // Weapons
        flares.forEach(f => { ctx.beginPath(); ctx.moveTo(f.x - 5, f.y - 5); ctx.lineTo(f.x + 5, f.y + 5); ctx.moveTo(f.x + 5, f.y - 5); ctx.lineTo(f.x - 5, f.y + 5); ctx.strokeStyle = isNavy ? '#38bdf8' : '#facc15'; ctx.lineWidth = 2; ctx.stroke(); });
        missiles.forEach(m => {
          ctx.beginPath(); ctx.arc(m.x, m.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = m.type === 'AUTO' ? '#eab308' : (m.type === 'TANK' ? '#f97316' : '#ffffff');
          ctx.fill();
        });
        explosions.forEach(e => { ctx.beginPath(); ctx.arc(e.x, e.y, (15 - e.life) * 2, 0, Math.PI * 2); ctx.strokeStyle = `rgba(239, 68, 68, ${e.life / 15})`; ctx.lineWidth = 3; ctx.stroke(); });

        if (baseHealth <= 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#ef4444'; ctx.font = 'bold 36px "Courier New", monospace'; ctx.fillText('SYSTEM FAILURE: HQ BREACHED', 220, 350);
        }
      }
      animationFrameId = requestAnimationFrame(loop);
    };
    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isAIActive, ownShip, enemies, radarMode, flares, baseHealth, missiles, explosions]);

  const activeThreats = enemies.filter(e => e.health > 0 && Math.hypot(e.x - basePos.x, e.y - basePos.y) <= radarRadius).length;

  return (
    <div style={{ backgroundColor: '#000000', color: 'white', minHeight: '100vh', padding: '15px', fontFamily: '"Courier New", monospace', backgroundImage: 'radial-gradient(circle, #0f172a 0%, #000000 90%)', display: 'flex', flexDirection: 'column' }}>
      
      <header style={{ borderBottom: '1px solid #38bdf8', paddingBottom: '10px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexShrink: 0 }}>
        <div><h1 style={{ color: '#38bdf8', margin: 0, fontSize: '24px', textShadow: '0 0 10px rgba(56, 189, 248, 0.4)' }}>COMMANDER'S TERMINAL</h1></div>
        <div style={{ color: '#4ade80', fontSize: '12px', border: '1px solid #4ade80', padding: '4px 8px', borderRadius: '4px', backgroundColor: 'rgba(74, 222, 128, 0.1)' }}>STATUS: ONLINE</div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr 250px', gap: '20px', flex: 1, alignItems: 'stretch' }}>
        
        {/* LEFT PANEL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          <div style={{ backgroundColor: '#0f172a', padding: '15px', borderRadius: '6px', border: '1px solid #334155', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)' }}>
            <h2 style={{ color: '#94a3b8', fontSize: '12px', marginTop: 0, marginBottom: '10px', borderBottom: '1px solid #1e293b', paddingBottom: '5px' }}>SYS CONTROLS</h2>
            
            {/* NEW NAVY/AIR TOGGLE BUTTON */}
            <button onClick={toggleMode} style={{ width: '100%', padding: '10px', marginBottom: '12px', backgroundColor: radarMode === 'NAVY' ? '#082f49' : '#022c11', color: radarMode === 'NAVY' ? '#7dd3fc' : '#86efac', border: '1px solid ' + (radarMode === 'NAVY' ? '#0ea5e9' : '#22c55e'), borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
              {radarMode === 'AIR' ? '✈️ AIR RADAR MODE' : '🌊 NAVAL SONAR MODE'}
            </button>

            <button onClick={() => setIsAIActive(!isAIActive)} style={{ width: '100%', padding: '10px', marginBottom: '8px', backgroundColor: isAIActive ? '#7f1d1d' : '#1e293b', color: isAIActive ? '#fca5a5' : '#cbd5e1', border: '1px solid ' + (isAIActive ? '#ef4444' : '#475569'), borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
              {isAIActive ? 'HALT TRACKING' : 'INITIATE TRACKING'}
            </button>
            <button onClick={() => handleReset(radarMode)} style={{ width: '100%', padding: '10px', backgroundColor: '#1e293b', color: '#cbd5e1', border: '1px solid #475569', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>RESET FIELD</button>
          </div>

          <div style={{ backgroundColor: '#1e1b4b', border: '1px solid #6366f1', padding: '12px', borderRadius: '6px' }}>
            <div style={{ color: '#818cf8', fontSize: '11px', fontWeight: 'bold', marginBottom: '6px' }}>AI ADVISORY</div>
            <div style={{ color: '#e0e7ff', fontSize: '12px', lineHeight: '1.4' }}>{advisorText}</div>
          </div>

          <div style={{ backgroundColor: radarMode === 'NAVY' ? 'rgba(8, 47, 73, 0.4)' : 'rgba(20, 83, 45, 0.1)', padding: '12px', border: `1px solid ${radarMode === 'NAVY' ? '#0ea5e9' : '#14532d'}`, borderRadius: '6px' }}>
            <h2 style={{ color: radarMode === 'NAVY' ? '#38bdf8' : '#4ade80', fontSize: '12px', marginTop: 0, borderBottom: `1px solid ${radarMode === 'NAVY' ? '#0284c7' : '#14532d'}`, paddingBottom: '6px' }}>🛡️ ALLIED FORCES</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', fontSize: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#94a3b8' }}>Unit:</span> <span style={{ color: radarMode === 'NAVY' ? '#38bdf8' : '#4ade80', fontWeight: 'bold' }}>1 ({radarMode === 'AIR' ? 'BLU-01 Jet' : 'Submarine'})</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#94a3b8' }}>Defenses:</span> <span style={{ color: radarMode === 'NAVY' ? '#38bdf8' : '#4ade80', fontWeight: 'bold' }}>{units.length} ({radarMode === 'AIR' ? 'Tanks' : 'Cruisers'})</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#94a3b8' }}>Turrets:</span> <span style={{ color: radarMode === 'NAVY' ? '#38bdf8' : '#4ade80', fontWeight: 'bold' }}>{smallUnits.length} (Active)</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#94a3b8' }}>{radarMode === 'AIR' ? 'SAMs:' : 'Torpedo:'}</span> <span style={{ color: '#eab308', fontWeight: 'bold' }}>1 (Auto)</span></div>
            </div>
            <div style={{ marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #334155', color: '#94a3b8', fontSize: '10px' }}>
              <b>CONTROLS:</b><br/>[W,A,S,D] - Move<br/>[SPACE] - Fire Weapon<br/>[F] - Deploy Countermeasure
            </div>
          </div>
        </div>

        {/* CENTER WIDESCREEN RADAR (MAX HEIGHT NOW) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', height: '100%' }}>
          <div style={{ flex: 1, position: 'relative', border: '3px solid #1e293b', borderRadius: '8px', backgroundColor: '#020617', boxShadow: '0 0 30px rgba(0, 0, 0, 0.8)', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)', pointerEvents: 'none', zIndex: 10 }}></div>
            {/* CANVAS HEIGHT INCREASED SINCE BOTTOM CONTROLS ARE GONE */}
            <canvas ref={canvasRef} width={1000} height={850} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
        </div>

        {/* RIGHT PANEL - ENEMY TELEMETRY DASHBOARD */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ backgroundColor: 'rgba(127, 29, 29, 0.1)', padding: '12px', border: '1px solid #7f1d1d', borderRadius: '6px' }}>
            <h2 style={{ color: '#ef4444', fontSize: '12px', marginTop: 0, borderBottom: '1px solid #7f1d1d', paddingBottom: '6px' }}>⚠️ THREAT {radarMode === 'AIR' ? 'RADAR' : 'SONAR'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', fontSize: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#fca5a5' }}>Threat:</span> <span style={{ color: activeThreats > 0 ? '#ef4444' : '#4ade80', fontWeight: 'bold' }}>{activeThreats > 0 ? 'ACTIVE' : 'CLEAR'}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#fca5a5' }}>Tracking:</span> <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{activeThreats} / 3</span></div>
              
              <div style={{ backgroundColor: '#451a1a', padding: '10px', borderRadius: '4px', marginTop: '5px' }}>
                <div style={{ color: '#fca5a5', fontSize: '10px', fontWeight: 'bold', marginBottom: '8px' }}>TARGET TELEMETRY</div>
                {enemies.map(e => {
                  const dist = Math.hypot(e.x - basePos.x, e.y - basePos.y);
                  const isInside = dist <= radarRadius;
                  const status = e.health <= 0 ? 'DESTROYED' : (isInside ? 'LOCKED' : 'APPROACHING');
                  const col = e.health <= 0 ? '#78350f' : (isInside ? '#f87171' : '#facc15');
                  
                  return (
                    <div key={e.id} style={{ marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px dashed #7f1d1d' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: col, fontWeight: 'bold' }}>
                        <span>{e.id} [{e.type}]</span> <span>{status}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#fca5a5', marginTop: '4px' }}>
                        <span>Spd: MACH {e.speed.toFixed(1)}</span> <span>HP: {e.health}%</span>
                      </div>
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