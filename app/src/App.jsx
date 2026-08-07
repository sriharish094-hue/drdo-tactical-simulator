import React, { useState, useEffect, useRef } from 'react';

export default function App() {
  const canvasRef = useRef(null);
  const [isAIActive, setIsAIActive] = useState(false);
  const [radarMode, setRadarMode] = useState('AIR'); 
  const [baseHealth, setBaseHealth] = useState(100);
  const [score, setScore] = useState(0);
  
  const basePos = { x: 500, y: 425 }; 
  const radarRadius = 380; 
  const [ownShip, setOwnShip] = useState({ x: 500, y: 480 });

  const [enemies, setEnemies] = useState([
    { id: 'TRK-01', type: 'FIGHTER JET', x: 950, y: 50, health: 100, speed: 1.8, originalSpeed: 1.8, alt: 24000, deathTimer: 0 },
    { id: 'DRN-02', type: 'STEALTH DRONE', x: 50, y: 650, health: 100, speed: 1.1, originalSpeed: 1.1, alt: 18000, deathTimer: 0 },
    { id: 'BMB-03', type: 'HEAVY BOMBER', x: 900, y: 700, health: 100, speed: 0.7, originalSpeed: 0.7, alt: 32000, deathTimer: 0 }
  ]);

  // NEW FEATURE: Manual Priority Target Lock state
  const [priorityTargetId, setPriorityTargetId] = useState(null);

  const units = [ { id: 'DEF-1', x: 440, y: 475 }, { id: 'DEF-2', x: 560, y: 475 } ];
  
  const [missiles, setMissiles] = useState([]);
  const [flares, setFlares] = useState([]);
  const [explosions, setExplosions] = useState([]);
  
  const lastAutoFire = useRef(0);
  const lastDefFire = useRef({ 'DEF-1': 0, 'DEF-2': 0 });
  const movementRef = useRef({ dx: 0, dy: 0 });

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

  const handleReset = (newMode = radarMode) => {
    setOwnShip({ x: 500, y: 480 });
    // Reset priority target on mode switch/reset
    setPriorityTargetId(null);
    if (newMode === 'AIR') {
      setEnemies([
        { id: 'TRK-01', type: 'FIGHTER JET', x: 950, y: 50, health: 100, speed: 1.8, originalSpeed: 1.8, alt: 24000, deathTimer: 0 },
        { id: 'DRN-02', type: 'STEALTH DRONE', x: 50, y: 650, health: 100, speed: 1.1, originalSpeed: 1.1, alt: 18000, deathTimer: 0 },
        { id: 'BMB-03', type: 'HEAVY BOMBER', x: 900, y: 700, health: 100, speed: 0.7, originalSpeed: 0.7, alt: 32000, deathTimer: 0 }
      ]);
      setAdvisorText('AIRSPACE RADAR INITIALIZED.');
    } else {
      setEnemies([
        { id: 'SUB-01', type: 'ATTACK SUB', x: 950, y: 50, health: 100, speed: 1.3, originalSpeed: 1.3, alt: -400, deathTimer: 0 },
        { id: 'FRG-02', type: 'FRIGATE', x: 50, y: 650, health: 100, speed: 0.9, originalSpeed: 0.9, alt: 0, deathTimer: 0 },
        { id: 'CRU-03', type: 'BATTLE CRUISER', x: 900, y: 700, health: 100, speed: 0.6, originalSpeed: 0.6, alt: 0, deathTimer: 0 }
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

  // NEW FEATURE: Mouse Click Listener for Target Locking
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleCanvasClick = (e) => {
      // Correct click position within the canvas
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;

      // Distance test to ensure click is within radar circle
      const cx = basePos.x, cy = basePos.y;
      if (Math.hypot(mouseX - cx, mouseY - cy) > radarRadius + 20) {
          setPriorityTargetId(null); // Clicked outside bezel, clear lock
          return;
      }

      let clickedTargetId = null;
      enemies.forEach(enemy => {
        // Hit test radius: 30 pixels around enemy dot
        if (enemy.health > 0) {
            const dist = Math.hypot(enemy.x - mouseX, enemy.y - mouseY);
            if (dist < 30) { 
                clickedTargetId = enemy.id;
            }
        }
      });

      if (clickedTargetId) {
          setPriorityTargetId(clickedTargetId);
          setAdvisorText(`⚠️ COMMANDER OVERRIDE: PRIORITY LOCK ON ${clickedTargetId}. FOCUS FIRE INITIATED.`);
      } else {
          setPriorityTargetId(null); // Clicked empty space on radar, clear lock
          setAdvisorText(`TARGET MARKER CLEARED. DEFAULT TARGETING PROTOCOL.`);
      }
    };

    canvas.addEventListener('click', handleCanvasClick);
    return () => canvas.removeEventListener('click', handleCanvasClick);
  }, [enemies, isAIActive]);


  useEffect(() => {
    let animationFrameId;
    let lastTime = performance.now();

    const loop = (time) => {
      if (time - lastTime > 30) {
        lastTime = time;
        setOwnShip(p => ({ x: Math.max(20, Math.min(980, p.x + movementRef.current.dx)), y: Math.max(20, Math.min(830, p.y + movementRef.current.dy)) }));

        const cx = basePos.x, cy = basePos.y;

        if (isAIActive && baseHealth > 0) {
          const sweepSpeed = radarMode === 'AIR' ? 1200 : 2500;
          const sweepAngle = (Date.now() / sweepSpeed) % (Math.PI * 2);

          setEnemies(prevEnemies => {
            let activeEnemies = prevEnemies.map(enemy => {
              
              // Continuous Threat respawn
              if (enemy.health <= 0) {
                const newTimer = enemy.deathTimer + 1;
                if (newTimer > 80) { 
                  const angle = Math.random() * Math.PI * 2;
                  const dist = radarRadius + 200 + Math.random() * 200; 
                  return { ...enemy, x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist, health: 100, speed: enemy.originalSpeed, deathTimer: 0 };
                }
                return { ...enemy, deathTimer: newTimer };
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
              if (aliveEnemies.length > 0) { 
                let visibleEnemies = aliveEnemies.filter(e => Math.hypot(e.x - cx, e.y - cy) <= radarRadius);
                if (visibleEnemies.length > 0) {
                  let closest = visibleEnemies.reduce((min, e) => {
                    let d = Math.hypot(e.x - basePos.x, e.y - basePos.y);
                    return d < min.dist ? { enemy: e, dist: d } : min;
                  }, { enemy: visibleEnemies[0], dist: 9999 });

                  // NEW FEATURE: Priortize Marked Target
                  let targetEnemy = visibleEnemies.find(e => e.id === priorityTargetId) || closest.enemy;
                  let targetDist = Math.hypot(targetEnemy.x - basePos.x, targetEnemy.y - basePos.y);

                  setHitProbability(Math.min(98, Math.max(20, 100 - Math.floor(targetDist / 5))));
                  
                  if (!priorityTargetId) {
                      if (targetDist < 120) setAdvisorText(`⚠️ ALARM: ${targetEnemy.id} (${targetEnemy.type}) BREACHED INNER DEFENSE!`);
                      else setAdvisorText(`🚨 ${radarMode === 'AIR' ? 'RADAR' : 'SONAR'} ALERT: BOGIES IN RANGE.`);
                  }

                  let objAngle = Math.atan2(targetEnemy.y - cy, targetEnemy.x - cx);
                  if (objAngle < 0) objAngle += Math.PI * 2;
                  let diff = sweepAngle - objAngle;
                  if (diff < 0) diff += Math.PI * 2;

                  if (diff < 0.5 && Date.now() - lastAutoFire.current > 400 && flares.length === 0) {
                    newMissiles.push({ x: basePos.x + 20, y: basePos.y - 10, speed: 11, type: 'AUTO', targetId: targetEnemy.id });
                    lastAutoFire.current = Date.now();
                  }

                  units.forEach(unit => {
                    let unitTarget = visibleEnemies.find(e => e.id === priorityTargetId);
                    let distToMarked = unitTarget ? Math.hypot(unitTarget.x - unit.x, unitTarget.y - unit.y) : 9999;
                    
                    // Defense tank also prioritizes marked target if in range (280nm)
                    if (unitTarget && distToMarked < 280) {
                        if (Date.now() - (lastDefFire.current[unit.id] || 0) > 1500) {
                            newMissiles.push({ x: unit.x, y: unit.y - 10, speed: 9, type: 'TANK', targetId: unitTarget.id });
                            lastDefFire.current[unit.id] = Date.now();
                        }
                    } else {
                        // Fallback to original closest-to-unit logic
                        let closestToUnit = visibleEnemies.reduce((min, e) => {
                            let d = Math.hypot(e.x - unit.x, e.y - unit.y);
                            return d < min.dist ? { enemy: e, dist: d } : min;
                        }, { enemy: null, dist: 9999 });

                        if (closestToUnit.enemy && closestToUnit.dist < 280 && Date.now() - (lastDefFire.current[unit.id] || 0) > 1500) {
                          newMissiles.push({ x: unit.x, y: unit.y - 10, speed: 9, type: 'TANK', targetId: closestToUnit.enemy.id });
                          lastDefFire.current[unit.id] = Date.now();
                          setExplosions(ex => [...ex, { x: unit.x, y: unit.y - 15, life: 3 }]);
                        }
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
                  setEnemies(prev => prev.map(e => e.id === targetEnemy.id ? { ...e, health: Math.max(0, e.health - damage), speed: 0, deathTimer: 0 } : e));
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

        ctx.beginPath(); ctx.arc(cx, cy, radarRadius + 25, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a'; ctx.fill(); 
        ctx.strokeStyle = '#334155'; ctx.lineWidth = 2; ctx.stroke();
        
        ctx.font = '11px "Courier New", monospace';
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

        if (isNavy && isAIActive) {
          const pingProgress = (Date.now() % 2500) / 2500;
          const pingRadius = pingProgress * radarRadius;
          ctx.beginPath(); ctx.arc(cx, cy, pingRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(56, 189, 248, ${1 - pingProgress})`; 
          ctx.lineWidth = 4; ctx.stroke();
        }

        if (ctx.createConicGradient) {
          const gradient = ctx.createConicGradient(sweepAngle - Math.PI/2, cx, cy);
          gradient.addColorStop(0, radarSweepColorSolid); 
          gradient.addColorStop(isNavy ? 0.05 : 0.1, isNavy ? 'rgba(56,189,248,0.1)' : 'rgba(34,197,94,0.2)'); 
          gradient.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gradient;
          ctx.beginPath(); ctx.arc(cx, cy, radarRadius, 0, Math.PI*2); ctx.fill();
        }
        
        ctx.beginPath(); ctx.moveTo(cx, cy); 
        ctx.lineTo(cx + Math.cos(sweepAngle)*radarRadius, cy + Math.sin(sweepAngle)*radarRadius);
        ctx.strokeStyle = isNavy ? '#7dd3fc' : '#ffffff'; ctx.lineWidth = isNavy ? 1 : 2; ctx.stroke();

        ctx.restore(); // END MASK

        const drawTacticalText = (text, x, y, color, bold=false) => { 
          ctx.fillStyle = color; ctx.font = `${bold ? 'bold ' : ''}11px "Courier New", monospace`; ctx.fillText(text, x, y); 
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

        enemies.forEach(enemy => {
          const distToCenter = Math.hypot(enemy.x - cx, enemy.y - cy);
          const isInsideRadar = distToCenter <= radarRadius;
          
          let bearing = (Math.atan2(enemy.y - cy, enemy.x - cx) * 180 / Math.PI) + 90;
          if (bearing < 0) bearing += 360;
          
          const jetColor = enemy.health <= 0 ? '#475569' : (isInsideRadar ? (isNavy ? '#f59e0b' : '#ef4444') : '#64748b'); 
          const glowColor = enemy.health <= 0 ? '#1e293b' : (isInsideRadar ? (isNavy ? '#d97706' : '#dc2626') : '#475569');
          
          let tx = basePos.x, ty = basePos.y;
          if (flares.length > 0) { tx = flares[0].x; ty = flares[0].y; }
          const angle = Math.atan2(ty - enemy.y, tx - enemy.x) + (Math.PI / 2);

          ctx.save();
          ctx.translate(enemy.x, enemy.y);
          
          // Original target bracket logic (standard visual)
          if(isInsideRadar && enemy.health > 0) {
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

          // NEW VISUAL: Marked Target Crosshair
          if (enemy.id === priorityTargetId && enemy.health > 0) {
              ctx.rotate((Date.now() / 300)); // Flashing and slow rotate
              ctx.beginPath();
              ctx.moveTo(-25, 0); ctx.lineTo(25, 0);
              ctx.moveTo(0, -25); ctx.lineTo(0, 25);
              ctx.strokeStyle = 'red';
              ctx.lineWidth = (Math.sin(Date.now() / 100) > 0) ? 3 : 1; // Flashing
              ctx.stroke();
              ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset for shape drawing
              ctx.translate(enemy.x, enemy.y); // restore position
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
          ctx.lineWidth = 1; ctx.strokeStyle = (isInsideRadar && enemy.health > 0) ? '#ffffff' : '#000000'; ctx.stroke();
          ctx.restore();

          if (enemy.health <= 0) {
            if (isInsideRadar) {
              drawTacticalText(`WRECKAGE [T-${Math.max(0, Math.floor((80 - enemy.deathTimer)/30))}s]`, enemy.x + 15, enemy.y, '#475569');
            }
          } else if (isInsideRadar) {
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
          } else {
            drawTacticalText(isNavy ? `CONTACT` : `UFO M${enemy.speed.toFixed(1)}`, enemy.x + 15, enemy.y, '#94a3b8');
          }
        });

        flares.forEach(f => { ctx.beginPath(); ctx.moveTo(f.x - 5, f.y - 5); ctx.lineTo(f.x + 5, f.y + 5); ctx.moveTo(f.x + 5, f.y - 5); ctx.lineTo(f.x - 5, f.y + 5); ctx.strokeStyle = isNavy ? '#38bdf8' : '#facc15'; ctx.lineWidth = 2; ctx.stroke(); });
        missiles.forEach(m => { ctx.beginPath(); ctx.arc(m.x, m.y, 3, 0, Math.PI * 2); ctx.fillStyle = m.type === 'AUTO' ? '#eab308' : (m.type === 'TANK' ? '#f97316' : '#ffffff'); ctx.fill(); });
        explosions.forEach(e => { 
          ctx.beginPath(); ctx.arc(e.x, e.y, (15 - e.life) * 3, 0, Math.PI * 2); 
          ctx.fillStyle = `rgba(239, 68, 68, ${e.life / 20})`; ctx.fill(); 
          ctx.strokeStyle = `rgba(250, 204, 21, ${e.life / 15})`; ctx.lineWidth = 3; ctx.stroke(); 
        });
      }
      animationFrameId = requestAnimationFrame(loop);
    };
    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isAIActive, ownShip, enemies, radarMode, flares, baseHealth, missiles, explosions, priorityTargetId]); // Added priorityTargetId to dependency list

  const activeThreats = enemies.filter(e => e.health > 0 && Math.hypot(e.x - basePos.x, e.y - basePos.y) <= radarRadius).length;

  return (
    <div style={{ backgroundColor: '#000000', color: 'white', minHeight: '100vh', padding: '20px', fontFamily: '"Courier New", monospace', backgroundImage: 'radial-gradient(circle, #0f172a 0%, #000000 90%)', display: 'flex', flexDirection: 'column' }}>
      
      <header style={{ borderBottom: '1px solid #38bdf8', paddingBottom: '10px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexShrink: 0 }}>
        <div><h1 style={{ color: '#38bdf8', margin: 0, fontSize: '26px', textShadow: '0 0 10px rgba(56, 189, 248, 0.4)' }}>COMMANDER'S TERMINAL // C4ISR SYSTEM 🛡️</h1></div>
        <div style={{ color: '#4ade80', fontSize: '13px', border: '1px solid #4ade80', padding: '5px 10px', borderRadius: '4px', backgroundColor: 'rgba(74, 222, 128, 0.1)' }}>STATUS: SECURE LINK</div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr 280px', gap: '25px', flex: 1, alignItems: 'stretch' }}>
        
        {/* LEFT PANEL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px solid #334155', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)' }}>
            <h2 style={{ color: '#94a3b8', fontSize: '13px', marginTop: 0, marginBottom: '15px', borderBottom: '1px solid #1e293b', paddingBottom: '8px' }}>SYS CONTROLS</h2>
            <button onClick={toggleMode} style={{ width: '100%', padding: '12px', marginBottom: '15px', backgroundColor: radarMode === 'NAVY' ? '#082f49' : '#022c11', color: radarMode === 'NAVY' ? '#7dd3fc' : '#86efac', border: '1px solid ' + (radarMode === 'NAVY' ? '#0ea5e9' : '#22c55e'), borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
              {radarMode === 'AIR' ? '✈️ AIR RADAR MODE' : '🌊 NAVAL SONAR MODE'}
            </button>
            <button onClick={() => setIsAIActive(!isAIActive)} style={{ width: '100%', padding: '12px', marginBottom: '10px', backgroundColor: isAIActive ? '#7f1d1d' : '#1e293b', color: isAIActive ? '#fca5a5' : '#cbd5e1', border: '1px solid ' + (isAIActive ? '#ef4444' : '#475569'), borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
              {isAIActive ? 'HALT TRACKING' : 'INITIATE TRACKING'}
            </button>
            <button onClick={() => handleReset(radarMode)} style={{ width: '100%', padding: '12px', backgroundColor: '#1e293b', color: '#cbd5e1', border: '1px solid #475569', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>RESET FIELD</button>
          </div>

          <div style={{ backgroundColor: '#1e1b4b', border: '1px solid #6366f1', padding: '15px', borderRadius: '8px' }}>
            <div style={{ color: '#818cf8', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>AI ADVISORY</div>
            <div style={{ color: '#e0e7ff', fontSize: '13px', lineHeight: '1.5' }}>{advisorText}</div>
          </div>

          <div style={{ backgroundColor: radarMode === 'NAVY' ? 'rgba(8, 47, 73, 0.4)' : 'rgba(20, 83, 45, 0.1)', padding: '15px', border: `1px solid ${radarMode === 'NAVY' ? '#0ea5e9' : '#14532d'}`, borderRadius: '8px' }}>
            <h2 style={{ color: radarMode === 'NAVY' ? '#38bdf8' : '#4ade80', fontSize: '13px', marginTop: 0, borderBottom: `1px solid ${radarMode === 'NAVY' ? '#0284c7' : '#14532d'}`, paddingBottom: '8px' }}>🛡️ ALLIED FORCES</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#94a3b8' }}>Unit:</span> <span style={{ color: radarMode === 'NAVY' ? '#38bdf8' : '#4ade80', fontWeight: 'bold' }}>1 ({radarMode === 'AIR' ? 'BLU-01 Jet' : 'Submarine'})</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#94a3b8' }}>Defenses:</span> <span style={{ color: radarMode === 'NAVY' ? '#38bdf8' : '#4ade80', fontWeight: 'bold' }}>{units.length} ({radarMode === 'AIR' ? 'SAM tanks' : 'Cruisers'})</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#94a3b8' }}>Auto SAM:</span> <span style={{ color: '#eab308', fontWeight: 'bold' }}>1 Active</span></div>
            </div>
          </div>
        </div>

        {/* CENTER WIDESCREEN RADAR */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ flex: 1, minHeight: '600px', position: 'relative', border: '3px solid #334155', borderRadius: '12px', backgroundColor: '#020617', boxShadow: '0 0 40px rgba(0, 0, 0, 0.9)', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 4px, 3px 100%', pointerEvents: 'none', zIndex: 10 }}></div>
            {/* CANVAS WITH CROSSHAIR CURSOR WHEN MOUSE OVER RADAR AREA */}
            <canvas ref={canvasRef} width={1000} height={850} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', cursor: priorityTargetId ? 'not-allowed' : 'crosshair' }} />
          </div>
        </div>

        {/* RIGHT PANEL - ENEMY TELEMETRY DASHBOARD */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ backgroundColor: 'rgba(127, 29, 29, 0.1)', padding: '15px', border: '1px solid #7f1d1d', borderRadius: '8px' }}>
            <h2 style={{ color: '#ef4444', fontSize: '13px', marginTop: 0, borderBottom: '1px solid #7f1d1d', paddingBottom: '8px' }}>⚠️ THREAT {radarMode === 'AIR' ? 'RADAR' : 'SONAR'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#fca5a5' }}>Threat:</span> <span style={{ color: activeThreats > 0 ? '#ef4444' : '#4ade80', fontWeight: 'bold' }}>{activeThreats > 0 ? 'ACTIVE' : 'CLEAR'}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#fca5a5' }}>Tracking:</span> <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{activeThreats} / 3</span></div>
              
              <div style={{ backgroundColor: '#451a1a', padding: '12px', borderRadius: '6px', marginTop: '8px' }}>
                <div style={{ color: '#fca5a5', fontSize: '11px', fontWeight: 'bold', marginBottom: '10px' }}>TARGET TELEMETRY</div>
                {enemies.map(e => {
                  const dist = Math.hypot(e.x - basePos.x, e.y - basePos.y);
                  const isInside = dist <= radarRadius;
                  
                  // Update status based on locking
                  let status = e.health <= 0 ? 'WRECKAGE' : (isInside ? 'LOCKED' : 'APPROACHING');
                  if (e.id === priorityTargetId) status = 'PRIORITY!!';
                  
                  // Dynamic color based on lock
                  const col = e.id === priorityTargetId ? 'red' : (e.health <= 0 ? '#78350f' : (isInside ? '#f87171' : '#facc15'));
                  
                  return (
                    <div key={e.id} style={{ marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px dashed #7f1d1d' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: col, fontWeight: 'bold' }}>
                        <span>{e.id} [{e.type}]</span> <span>{status}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#fca5a5', marginTop: '5px' }}>
                        <span>Spd: MACH {e.speed.toFixed(1)}</span> <span>HP: {e.health}%</span>
                      </div>
                    </div>
                  );
                })}
                <div style={{ color: 'red', fontSize: '10px', marginTop: '10px', textAlign: 'center', borderTop: '1px dashed red', paddingTop: '5px' }}>
                    COMMANDER: Click enemy to FORCE LOCK. Click empty space to CLEAR.
                </div>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: '#0f172a', padding: '15px', border: '1px solid #1e293b', borderRadius: '8px' }}>
            <h2 style={{ color: '#38bdf8', fontSize: '13px', marginTop: 0, borderBottom: '1px solid #1e293b', paddingBottom: '8px' }}>📊 LIVE METRICS</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
              <div style={{ backgroundColor: '#1e293b', padding: '12px', borderRadius: '6px', borderLeft: '4px solid #22c55e' }}>
                <div style={{ color: '#94a3b8', fontSize: '11px' }}>HIT PROBABILITY</div>
                <div style={{ fontSize: '24px', color: hitProbability > 70 ? '#4ade80' : hitProbability > 40 ? '#facc15' : '#ef4444', fontWeight: 'bold', marginTop: '4px' }}>{hitProbability}%</div>
              </div>
              <div style={{ backgroundColor: '#1e293b', padding: '12px', borderRadius: '6px', borderLeft: '4px solid #38bdf8' }}>
                <div style={{ color: '#94a3b8', fontSize: '11px' }}>HQ INTEGRITY</div>
                <div style={{ fontSize: '20px', color: baseHealth > 30 ? '#38bdf8' : '#ef4444', fontWeight: 'bold', marginTop: '4px' }}>{Math.floor(baseHealth)}%</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}