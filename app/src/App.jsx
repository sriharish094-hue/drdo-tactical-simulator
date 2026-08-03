import React, { useState, useEffect, useRef } from 'react';

export default function App() {
  const canvasRef = useRef(null);
  const [isAIActive, setIsAIActive] = useState(false);
  const [radarMode, setRadarMode] = useState('AIR'); 
  const [baseHealth, setBaseHealth] = useState(100);
  const [score, setScore] = useState(0);
  
  const basePos = { x: 500, y: 400 }; 
  const radarRadius = 360; 
  const [ownShip, setOwnShip] = useState({ x: 500, y: 460 });

  const [enemies, setEnemies] = useState([
    { id: 'TRK-01', type: 'FIGHTER JET', x: 950, y: 50, health: 100, speed: 1.8, alt: 24000 },
    { id: 'DRN-02', type: 'STEALTH DRONE', x: 50, y: 650, health: 100, speed: 1.1, alt: 18000 },
    { id: 'BMB-03', type: 'HEAVY BOMBER', x: 900, y: 700, health: 100, speed: 0.7, alt: 32000 }
  ]);

  const units = [ { id: 'DEF-1', x: 440, y: 450 }, { id: 'DEF-2', x: 560, y: 450 } ];
  const smallUnits = [ { id: 'MIN-1', x: 470, y: 470 }, { id: 'MIN-2', x: 490, y: 470 }, { id: 'MIN-3', x: 510, y: 470 }, { id: 'MIN-4', x: 530, y: 470 } ];

  const [missiles, setMissiles] = useState([]);
  const [flares, setFlares] = useState([]);
  const [explosions, setExplosions] = useState([]);
  
  const lastAutoFire = useRef(0);
  const lastDefFire = useRef({ 'DEF-1': 0, 'DEF-2': 0 });
  const movementRef = useRef({ dx: 0, dy: 0 });

  // TOP SECRET: K.A.L.I WEAPON SYSTEM REF
  const kaliRef = useRef({ active: false, radius: 0 });

  const [advisorText, setAdvisorText] = useState('SYSTEM READY. AWAITING COMMANDER DIRECTIVE.');
  const [hitProbability, setHitProbability] = useState(0);
  const [enemyStrategy, setEnemyStrategy] = useState('SCANNING BORDERS...');

  useEffect(() => {
    const handleKeyDown = (e) => {
      const speed = 15;
      if (['ArrowUp', 'w', 'W'].includes(e.key)) movementRef.current = { dx: 0, dy: -speed };
      if (['ArrowDown', 's', 'S'].includes(e.key)) movementRef.current = { dx: 0, dy: speed };
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) movementRef.current = { dx: -speed, dy: 0 };
      if (['ArrowRight', 'd', 'D'].includes(e.key)) movementRef.current = { dx: speed, dy: 0 };
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

  // INITIATE CLASSIFIED WEAPON
  const triggerKALI = () => {
    if (baseHealth > 0 && !kaliRef.current.active) {
      kaliRef.current = { active: true, radius: 10 };
      setAdvisorText('☢️ CLASSIFIED: PROJECT K.A.L.I ACTIVATED. ORBITAL EMP DISCHARGING!');
    }
  };

  const handleReset = (newMode = radarMode) => {
    setOwnShip({ x: 500, y: 460 });
    kaliRef.current.active = false;
    if (newMode === 'AIR') {
      setEnemies([
        { id: 'TRK-01', type: 'FIGHTER JET', x: 950, y: 50, health: 100, speed: 1.8, alt: 24000 },
        { id: 'DRN-02', type: 'STEALTH DRONE', x: 50, y: 650, health: 100, speed: 1.1, alt: 18000 },
        { id: 'BMB-03', type: 'HEAVY BOMBER', x: 900, y: 700, health: 100, speed: 0.7, alt: 32000 }
      ]);
      setAdvisorText('AIRSPACE RADAR INITIALIZED.');
    } else {
      setEnemies([
        { id: 'SUB-01', type: 'ATTACK SUB', x: 950, y: 50, health: 100, speed: 1.3, alt: -400 },
        { id: 'FRG-02', type: 'FRIGATE', x: 50, y: 650, health: 100, speed: 0.9, alt: 0 },
        { id: 'CRU-03', type: 'BATTLE CRUISER', x: 900, y: 700, health: 100, speed: 0.6, alt: 0 }
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

  useEffect(() => {
    let animationFrameId;
    let lastTime = performance.now();

    const loop = (time) => {
      if (time - lastTime > 30) {
        lastTime = time;
        setOwnShip(p => ({ x: Math.max(20, Math.min(980, p.x + movementRef.current.dx)), y: Math.max(20, Math.min(780, p.y + movementRef.current.dy)) }));

        const cx = basePos.x, cy = basePos.y;

        // K.A.L.I WEAPON LOGIC
        if (kaliRef.current.active) {
          kaliRef.current.radius += 45; // Extremely fast expansion
          if (kaliRef.current.radius > 1200) {
            kaliRef.current.active = false; // Reset after it clears the screen
          }
        }

        if (isAIActive && baseHealth > 0) {
          const sweepSpeed = radarMode === 'AIR' ? 1200 : 2500;
          const sweepAngle = (Date.now() / sweepSpeed) % (Math.PI * 2);

          setEnemies(prevEnemies => {
            let activeEnemies = prevEnemies.map(enemy => {
              if (enemy.health <= 0) return enemy;

              // IF KALI WAVE HITS THEM -> INSTANT DEATH
              const distToCenter = Math.hypot(enemy.x - cx, enemy.y - cy);
              if (kaliRef.current.active && distToCenter <= kaliRef.current.radius) {
                setExplosions(ex => [...ex, { x: enemy.x, y: enemy.y, life: 25 }]); // Big explosion
                setScore(s => s + 500);
                return { ...enemy, health: 0, speed: 0 }; // Engine dead
              }

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
              if (aliveEnemies.length > 0 && !kaliRef.current.active) { // Don't fire normal missiles if KALI is active
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

                  if (!kaliRef.current.active) {
                    if (targetDist < 120) setAdvisorText(`⚠️ ALARM: ${target.id} (${target.type}) BREACHED INNER DEFENSE!`);
                    else setAdvisorText(`🚨 ${radarMode === 'AIR' ? 'RADAR' : 'SONAR'} ALERT: BOGIES IN RANGE.`);
                  }

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
        const isNavy = radarMode === 'NAVY';
        
        const sweepSpeed = isNavy ? 2500 : 1200;
        const sweepAngle = (Date.now() / sweepSpeed) % (Math.PI * 2);

        const radarBgColor = isNavy ? '#010a17' : '#011c09'; 
        const radarLineColor = isNavy ? 'rgba(14, 165, 233, 0.3)' : 'rgba(34, 197, 94, 0.3)'; 
        const radarSweepColorSolid = isNavy ? 'rgba(56, 189, 248, 0.7)' : 'rgba(74, 222, 128, 0.8)';
        const textColor = isNavy ? '#38bdf8' : '#4ade80';

        ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, canvas.width, canvas.height);

        // K.A.L.I BACKGROUND GLITCH EFFECT
        if (kaliRef.current.active) {
          ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.1)' : 'rgba(0,255,255,0.1)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.beginPath(); ctx.arc(cx, cy, radarRadius + 25, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a'; ctx.fill(); 
        ctx.strokeStyle = '#334155'; ctx.lineWidth = 2; ctx.stroke();
        
        ctx.font = '10px "Courier New", monospace';
        ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        
        for(let i=0; i<360; i+= (isNavy ? 45 : 15)) {
          const rad = (i - 90) * (Math.PI / 180);
          const isMajor = i % 90 === 0;
          const outerR = radarRadius + (isMajor ? 20 : 12);
          const innerR = radarRadius + 2;
          
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(rad) * innerR, cy + Math.sin(rad) * innerR);
          ctx.lineTo(cx + Math.cos(rad) * (radarRadius + (isMajor ? 8 : 6)), cy + Math.sin(rad) * (radarRadius + (isMajor ? 8 : 6)));
          ctx.strokeStyle = isMajor ? textColor : '#475569';
          ctx.lineWidth = isMajor ? 2 : 1;
          ctx.stroke();

          if(i % (isNavy ? 45 : 30) === 0) {
             let text = i.toString().padStart(3, '0');
             if(i===0) text = 'N 000'; if(i===90) text = 'E 090'; if(i===180) text = 'S 180'; if(i===270) text = 'W 270';
             ctx.fillStyle = isMajor ? '#ffffff' : '#94a3b8';
             ctx.fillText(text, cx + Math.cos(rad) * outerR, cy + Math.sin(rad) * outerR);
          }
        }
        ctx.textAlign = 'left';

        // RADAR MASK
        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy, radarRadius, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = radarBgColor; ctx.fill();

        ctx.strokeStyle = radarLineColor; ctx.lineWidth = 1;
        if (!isNavy) {
          for (let i=0; i<360; i+=30) {
            const rad = i * (Math.PI / 180);
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(rad) * radarRadius, cy + Math.sin(rad) * radarRadius); ctx.stroke();
          }
        } else {
          ctx.beginPath(); ctx.moveTo(cx, cy - radarRadius); ctx.lineTo(cx, cy + radarRadius); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx - radarRadius, cy); ctx.lineTo(cx + radarRadius, cy); ctx.stroke();
        }
        
        for (let r = 60; r <= radarRadius; r += 60) {
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = radarLineColor;
          ctx.fillText(`${r/2}${isNavy ? 'Yds' : 'NM'}`, cx + 2, cy - r - 2);
        }

        if (isNavy && isAIActive && !kaliRef.current.active) {
          const pingProgress = (Date.now() % 2500) / 2500;
          const pingRadius = pingProgress * radarRadius;
          ctx.beginPath(); ctx.arc(cx, cy, pingRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(56, 189, 248, ${1 - pingProgress})`; 
          ctx.lineWidth = 4; ctx.stroke();
        }

        // Hide regular sweep if KALI is firing
        if (ctx.createConicGradient && !kaliRef.current.active) {
          const gradient = ctx.createConicGradient(sweepAngle - Math.PI/2, cx, cy);
          gradient.addColorStop(0, radarSweepColorSolid); 
          gradient.addColorStop(isNavy ? 0.05 : 0.1, isNavy ? 'rgba(56,189,248,0.1)' : 'rgba(34,197,94,0.2)'); 
          gradient.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gradient;
          ctx.beginPath(); ctx.arc(cx, cy, radarRadius, 0, Math.PI*2); ctx.fill();
        }
        
        if (!kaliRef.current.active) {
          ctx.beginPath(); ctx.moveTo(cx, cy); 
          ctx.lineTo(cx + Math.cos(sweepAngle)*radarRadius, cy + Math.sin(sweepAngle)*radarRadius);
          ctx.strokeStyle = isNavy ? '#7dd3fc' : '#ffffff'; ctx.lineWidth = isNavy ? 1 : 2; ctx.stroke();
        }

        // K.A.L.I BEAM RENDERING (CLASSIFIED WEAPON)
        if (kaliRef.current.active) {
          ctx.beginPath();
          ctx.arc(cx, cy, kaliRef.current.radius, 0, Math.PI * 2);
          
          // Blinding White/Cyan Energy Wave
          const kaliGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, kaliRef.current.radius);
          kaliGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
          kaliGrad.addColorStop(0.8, 'rgba(6, 182, 212, 0.8)'); // Cyan
          kaliGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          
          ctx.fillStyle = kaliGrad;
          ctx.fill();
          
          ctx.strokeStyle = '#22d3ee'; // Bright Cyan Rim
          ctx.lineWidth = 10;
          ctx.stroke();

          // Glitch Warning Text
          ctx.fillStyle = '#ff0000';
          ctx.font = 'bold 30px "Courier New", monospace';
          ctx.shadowBlur = 10;
          ctx.shadowColor = 'red';
          ctx.fillText(">> K.A.L.I EMP DISCHARGE <<", cx - 180, cy + (Math.random() * 10 - 5));
          ctx.shadowBlur = 0;
        }

        ctx.restore(); // END MASK

        const drawTacticalText = (text, x, y, color, bold=false) => { 
          ctx.fillStyle = color; ctx.font = `${bold ? 'bold ' : ''}10px "Courier New", monospace`; ctx.fillText(text, x, y); 
        };

        ctx.beginPath(); ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10); ctx.stroke();
        ctx.beginPath(); ctx.rect(cx - 15, cy - 10, 30, 20);
        ctx.fillStyle = `rgba(56, 189, 248, 0.2)`; ctx.fill();
        ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 1; ctx.stroke();
        drawTacticalText(`HQ-SYS [${Math.floor(baseHealth)}%]`, cx + 20, cy + 5, isNavy ? '#0ea5e9' : '#38bdf8', true);

        units.forEach(u => {
          const isFiring = Date.now() - (lastDefFire.current[u.id] || 0) < 200;
          ctx.beginPath(); ctx.rect(u.x - 8, u.y - 6, 16, 12);
          ctx.strokeStyle = isFiring ? '#f97316' : textColor; 
          ctx.fillStyle = isFiring ? 'rgba(249, 115, 22, 0.4)' : 'transparent';
          ctx.fill(); ctx.stroke();
          drawTacticalText(isNavy ? 'CRU' : 'TNK', u.x - 10, u.y + 14, textColor);
        });

        ctx.beginPath(); ctx.arc(ownShip.x, ownShip.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(96, 165, 250, 0.4)`; ctx.fill();
        ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 2; ctx.stroke();
        drawTacticalText(isNavy ? 'SUB-01' : 'BLU-01', ownShip.x + 10, ownShip.y - 5, '#60a5fa', true);

        // ENEMIES
        enemies.forEach(enemy => {
          if (enemy.health > 0) {
            const distToCenter = Math.hypot(enemy.x - cx, enemy.y - cy);
            const isInsideRadar = distToCenter <= radarRadius;
            
            let bearing = (Math.atan2(enemy.y - cy, enemy.x - cx) * 180 / Math.PI) + 90;
            if (bearing < 0) bearing += 360;
            
            const jetColor = isInsideRadar ? (isNavy ? '#f59e0b' : '#ef4444') : '#64748b'; 
            const glowColor = isInsideRadar ? (isNavy ? '#d97706' : '#dc2626') : '#475569';
            
            let tx = basePos.x, ty = basePos.y;
            if (flares.length > 0) { tx = flares[0].x; ty = flares[0].y; }
            const angle = Math.atan2(ty - enemy.y, tx - enemy.x) + (Math.PI / 2);

            ctx.save();
            ctx.translate(enemy.x, enemy.y);
            
            if(isInsideRadar && !kaliRef.current.active) {
              if (isNavy) {
                ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)'; 
                ctx.setLineDash([4, 6]); ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
              } else {
                ctx.beginPath(); const bSize = 18;
                ctx.moveTo(-bSize, -bSize/2); ctx.lineTo(-bSize, -bSize); ctx.lineTo(-bSize/2, -bSize); 
                ctx.moveTo(bSize/2, -bSize); ctx.lineTo(bSize, -bSize); ctx.lineTo(bSize, -bSize/2);    
                ctx.moveTo(bSize, bSize/2); ctx.lineTo(bSize, bSize); ctx.lineTo(bSize/2, bSize);       
                ctx.moveTo(-bSize/2, bSize); ctx.lineTo(-bSize, bSize); ctx.lineTo(-bSize, bSize/2);    
                ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)'; ctx.lineWidth = 2; ctx.stroke();
              }
            }

            ctx.rotate(angle);
            ctx.beginPath();
            if (isNavy) {
              ctx.moveTo(0, -12); ctx.lineTo(4, -6); ctx.lineTo(4, 8); ctx.lineTo(0, 12); ctx.lineTo(-4, 8); ctx.lineTo(-4, -6);
            } else {
              ctx.moveTo(0, -14); ctx.lineTo(4, -4); ctx.lineTo(14, 2); ctx.lineTo(4, 6); ctx.lineTo(2, 10); ctx.lineTo(8, 14); ctx.lineTo(-8, 14); ctx.lineTo(-2, 10); ctx.lineTo(-4, 6); ctx.lineTo(-14, 2); ctx.lineTo(-4, -4);
            }
            ctx.closePath();
            ctx.fillStyle = jetColor; ctx.shadowBlur = 10; ctx.shadowColor = glowColor; ctx.fill();
            ctx.lineWidth = 1; ctx.strokeStyle = isInsideRadar ? '#ffffff' : '#000000'; ctx.stroke();
            ctx.restore();

            if (isInsideRadar && !kaliRef.current.active) {
              const lineColor = isNavy ? 'rgba(245, 158, 11, 0.5)' : 'rgba(239, 68, 68, 0.5)';
              const txtColor = isNavy ? '#f59e0b' : '#ff0000';
              const subTxtColor = isNavy ? '#fcd34d' : '#fca5a5';

              ctx.beginPath(); ctx.moveTo(enemy.x + 18, enemy.y - 18); 
              ctx.lineTo(enemy.x + 25, enemy.y - 25); ctx.lineTo(enemy.x + 45, enemy.y - 25); 
              ctx.strokeStyle = lineColor; ctx.lineWidth = 1; ctx.stroke();
              
              drawTacticalText(`${enemy.id}`, enemy.x + 50, enemy.y - 30, txtColor, true);
              drawTacticalText(`BRG: ${Math.floor(bearing)}°`, enemy.x + 50, enemy.y - 18, subTxtColor);
              drawTacticalText(`DST: ${Math.floor(distToCenter/2)}${isNavy ? 'Yds' : 'NM'}`, enemy.x + 50, enemy.y - 8, subTxtColor);
              drawTacticalText(`${isNavy?'DPT':'ALT'}: ${enemy.alt}`, enemy.x + 50, enemy.y + 2, subTxtColor);
              drawTacticalText(`KTS: ${Math.floor(enemy.speed * 200)}`, enemy.x + 50, enemy.y + 12, subTxtColor);
            } else if (!kaliRef.current.active) {
              drawTacticalText(isNavy ? `CONTACT` : `UFO M${enemy.speed.toFixed(1)}`, enemy.x + 15, enemy.y, '#94a3b8');
            }
          }
        });

        flares.forEach(f => { ctx.beginPath(); ctx.moveTo(f.x - 5, f.y - 5); ctx.lineTo(f.x + 5, f.y + 5); ctx.moveTo(f.x + 5, f.y - 5); ctx.lineTo(f.x - 5, f.y + 5); ctx.strokeStyle = isNavy ? '#38bdf8' : '#facc15'; ctx.lineWidth = 2; ctx.stroke(); });
        missiles.forEach(m => { ctx.beginPath(); ctx.arc(m.x, m.y, 3, 0, Math.PI * 2); ctx.fillStyle = m.type === 'AUTO' ? '#eab308' : (m.type === 'TANK' ? '#f97316' : '#ffffff'); ctx.fill(); });
        explosions.forEach(e => { 
          ctx.beginPath(); ctx.arc(e.x, e.y, (15 - e.life) * 3, 0, Math.PI * 2); // Bigger explosion
          ctx.fillStyle = `rgba(239, 68, 68, ${e.life / 20})`; ctx.fill(); // Fill for EMP death
          ctx.strokeStyle = `rgba(250, 204, 21, ${e.life / 15})`; ctx.lineWidth = 3; ctx.stroke(); 
        });
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
        <div><h1 style={{ color: '#38bdf8', margin: 0, fontSize: '24px', textShadow: '0 0 10px rgba(56, 189, 248, 0.4)' }}>COMMANDER'S TERMINAL // C4ISR SYSTEM</h1></div>
        <div style={{ color: '#4ade80', fontSize: '12px', border: '1px solid #4ade80', padding: '4px 8px', borderRadius: '4px', backgroundColor: 'rgba(74, 222, 128, 0.1)' }}>STATUS: SECURE LINK</div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr 250px', gap: '20px', flex: 1, alignItems: 'stretch' }}>
        
        {/* LEFT PANEL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ backgroundColor: '#0f172a', padding: '15px', borderRadius: '6px', border: '1px solid #334155', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)' }}>
            <h2 style={{ color: '#94a3b8', fontSize: '12px', marginTop: 0, marginBottom: '10px', borderBottom: '1px solid #1e293b', paddingBottom: '5px' }}>SYS CONTROLS</h2>
            <button onClick={toggleMode} style={{ width: '100%', padding: '10px', marginBottom: '12px', backgroundColor: radarMode === 'NAVY' ? '#082f49' : '#022c11', color: radarMode === 'NAVY' ? '#7dd3fc' : '#86efac', border: '1px solid ' + (radarMode === 'NAVY' ? '#0ea5e9' : '#22c55e'), borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
              {radarMode === 'AIR' ? '✈️ AIR RADAR MODE' : '🌊 NAVAL SONAR MODE'}
            </button>
            <button onClick={() => setIsAIActive(!isAIActive)} style={{ width: '100%', padding: '10px', marginBottom: '8px', backgroundColor: isAIActive ? '#7f1d1d' : '#1e293b', color: isAIActive ? '#fca5a5' : '#cbd5e1', border: '1px solid ' + (isAIActive ? '#ef4444' : '#475569'), borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
              {isAIActive ? 'HALT TRACKING' : 'INITIATE TRACKING'}
            </button>
            <button onClick={() => handleReset(radarMode)} style={{ width: '100%', padding: '10px', backgroundColor: '#1e293b', color: '#cbd5e1', border: '1px solid #475569', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>RESET FIELD</button>
          </div>
          
          {/* TOP SECRET: PROJECT K.A.L.I BUTTON */}
          <div style={{ backgroundColor: '#450a0a', padding: '15px', borderRadius: '6px', border: '2px dashed #dc2626', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'repeating-linear-gradient(45deg, #ef4444, #ef4444 10px, #000 10px, #000 20px)' }}></div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px', background: 'repeating-linear-gradient(45deg, #ef4444, #ef4444 10px, #000 10px, #000 20px)' }}></div>
            <h2 style={{ color: '#ef4444', fontSize: '12px', marginTop: '5px', marginBottom: '10px', textAlign: 'center', textShadow: '0 0 5px red' }}>⚠️ CLASSIFIED WEAPON</h2>
            <button onClick={triggerKALI} style={{ width: '100%', padding: '15px 10px', backgroundColor: '#000000', color: '#ef4444', border: '1px solid #dc2626', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', textShadow: '0 0 5px red', boxShadow: '0 0 15px rgba(220, 38, 38, 0.4)' }}>
              ☢️ INITIATE K.A.L.I
            </button>
            <div style={{ color: '#fca5a5', fontSize: '9px', textAlign: 'center', marginTop: '8px' }}>ORBITAL DIRECTED ENERGY EMP</div>
          </div>

          <div style={{ backgroundColor: '#1e1b4b', border: '1px solid #6366f1', padding: '12px', borderRadius: '6px' }}>
            <div style={{ color: '#818cf8', fontSize: '11px', fontWeight: 'bold', marginBottom: '6px' }}>AI ADVISORY</div>
            <div style={{ color: '#e0e7ff', fontSize: '12px', lineHeight: '1.4' }}>{advisorText}</div>
          </div>
        </div>

        {/* CENTER WIDESCREEN RADAR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', height: '100%' }}>
          <div style={{ flex: 1, position: 'relative', border: '2px solid #334155', borderRadius: '8px', backgroundColor: '#020617', boxShadow: '0 0 40px rgba(0, 0, 0, 0.9)', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 4px, 3px 100%', pointerEvents: 'none', zIndex: 10 }}></div>
            <canvas ref={canvasRef} width={1000} height={850} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
        </div>

        {/* RIGHT PANEL - ENEMY TELEMETRY DASHBOARD */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ backgroundColor: 'rgba(127, 29, 29, 0.1)', padding: '12px', border: '1px solid #7f1d1d', borderRadius: '6px' }}>
            <h2 style={{ color: '#ef4444', fontSize: '12px', marginTop: 0, borderBottom: '1px solid #7f1d1d', paddingBottom: '6px' }}>⚠️ THREAT {radarMode === 'AIR' ? 'RADAR' : 'SONAR'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', fontSize: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#fca5a5' }}>Threat:</span> <span style={{ color: activeThreats > 0 ? '#ef4444' : '#4ade80', fontWeight: 'bold' }}>{activeThreats > 0 ? 'ACTIVE' : 'CLEAR'}</span></div>
              
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