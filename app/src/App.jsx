import React, { useState, useEffect, useRef } from 'react';

// HELPER: Spawn contacts
const spawnContact = (isNavy) => {
  const angle = Math.random() * Math.PI * 2;
  const dist = 600; 
  const startX = 500 + Math.cos(angle) * dist;
  const startY = 425 + Math.sin(angle) * dist;
  
  const targetAngle = angle + Math.PI + (Math.random() * 0.8 - 0.4); 
  const speed = (Math.random() * 1.5) + (isNavy ? 0.4 : 0.8);
  const isCiv = Math.random() > 0.65; 
  let type, trueIff;
  
  if (isNavy) {
    if (isCiv) {
        type = ['FISHING VESSEL', 'CARGO SHIP', 'CRUISE LINER'][Math.floor(Math.random() * 3)];
        trueIff = 'CIVILIAN';
    } else {
        type = ['ATTACK SUB', 'FRIGATE', 'DESTROYER'][Math.floor(Math.random() * 3)];
        trueIff = 'HOSTILE';
    }
  } else {
    if (isCiv) {
        type = ['B737 COMMERCIAL', 'A320 FLIGHT', 'CARGO HEAVY'][Math.floor(Math.random() * 3)];
        trueIff = 'CIVILIAN';
    } else {
        type = ['FIGHTER JET', 'STEALTH DRONE', 'HEAVY BOMBER'][Math.floor(Math.random() * 3)];
        trueIff = 'HOSTILE';
    }
  }

  const isStealth = trueIff === 'HOSTILE' && Math.random() > 0.5;

  return {
    id: `TRK-${Math.floor(Math.random()*9000)+1000}`,
    type: isStealth ? 'UNKNOWN CLASSIFIED' : type,
    trueIff: trueIff,
    displayIff: 'UNKNOWN',
    isStealth: isStealth,
    authorized: false,
    x: startX,
    y: startY,
    vx: Math.cos(targetAngle) * speed,
    vy: Math.sin(targetAngle) * speed,
    hdg: (targetAngle * 180 / Math.PI + 90 + 360) % 360,
    speed: speed,
    alt: isNavy ? -(Math.floor(Math.random() * 50) * 10) : Math.floor(Math.random() * 300 + 100) * 100,
    status: 'ACTIVE',
    deathTimer: 0
  };
};

export default function App() {
  const canvasRef = useRef(null);
  const [isAIActive, setIsAIActive] = useState(false); 
  const [radarMode, setRadarMode] = useState('AIR'); 
  
  const logicalWidth = 1000;
  const logicalHeight = 850;
  const basePos = { x: logicalWidth/2, y: logicalHeight/2 }; 
  const radarRadius = 380; 

  const samBatteries = [
    { id: 'SAM-ALPHA', x: 420, y: 360 },
    { id: 'SAM-BRAVO', x: 580, y: 360 },
    { id: 'SAM-CHARLIE', x: 500, y: 510 }
  ];

  const [contacts, setContacts] = useState([spawnContact(false), spawnContact(false), spawnContact(false), spawnContact(false)]);
  const [priorityTargetId, setPriorityTargetId] = useState(null);
  const [interceptors, setInterceptors] = useState([]);
  const [score, setScore] = useState(0);
  
  const lastAutoFire = useRef(0);
  const casualtyTimer = useRef(0); 
  const stormRef = useRef({ x: basePos.x, y: basePos.y - 150, radius: 120 });
  const [explosions, setExplosions] = useState([]);
  
  // NEW: DEDICATED AI LOG SYSTEM
  const [logs, setLogs] = useState([
    { id: 1, time: new Date().toLocaleTimeString('en-US', { hour12: false }), sender: 'SYSTEM', text: 'C4ISR AI ADVISORY TERMINAL ONLINE.', type: 'info' }
  ]);
  const logsEndRef = useRef(null);
  const seenContacts = useRef({}); // Prevents spamming warnings for the same contact

  const addLog = (sender, text, type = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => {
        const newLogs = [...prev, { id: Math.random(), time, sender, text, type }];
        return newLogs.slice(-50); // Keep only last 50 logs to prevent memory issues
    });
  };

  useEffect(() => {
    if (logsEndRef.current) {
        logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Mouse Interaction (Click to Identify & Authorize)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleCanvasClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = logicalWidth / rect.width;
      const scaleY = logicalHeight / rect.height;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;

      if (Math.hypot(mouseX - basePos.x, mouseY - basePos.y) > radarRadius + 20) {
          setPriorityTargetId(null); 
          return;
      }

      let clickedTargetId = null;
      contacts.forEach(contact => {
        if (contact.status === 'ACTIVE') {
            const dist = Math.hypot(contact.x - mouseX, contact.y - mouseY);
            if (dist < 30) clickedTargetId = contact.id;
        }
      });

      if (clickedTargetId) {
          const contact = contacts.find(c => c.id === clickedTargetId);
          setContacts(prev => prev.map(c => 
            c.id === clickedTargetId ? { ...c, displayIff: c.trueIff, type: c.trueIff === 'HOSTILE' ? (c.isStealth ? 'STEALTH DRONE' : c.type) : c.type, authorized: true } : c
          ));
          setPriorityTargetId(clickedTargetId);
          
          // AI ADVISORY LOGIC ON COMMANDER CLICK
          if (contact && !contact.authorized) {
              addLog('COMMANDER', `Interrogating target ${contact.id}...`, 'cmd');
              setTimeout(() => {
                  if (contact.trueIff === 'HOSTILE') {
                      addLog('AI ADVISOR', `THREAT IDENTIFIED! Hostile ${contact.isStealth ? 'STEALTH' : ''} ${contact.type}.`, 'alert');
                      addLog('AI ADVISOR', `TELEMETRY: Power/Speed is ${Math.floor(contact.speed * 200)} KTS. Approaching from Heading ${Math.floor(contact.hdg)}°.`, 'info');
                      
                      // Dynamic Tactical Recommendations
                      let rec = 'Authorize standard SAM engagement.';
                      if (radarMode === 'NAVY') {
                         if (contact.type.includes('SUB')) rec = 'Submerged threat. Deploy Anti-Submarine (ASW) Helicopters/Drones!';
                         else rec = 'Surface threat. Engage with Harpoon missiles!';
                      } else {
                         if (contact.speed > 1.2) rec = 'Supersonic threat detected. Scramble Interceptor Aircraft immediately!';
                         else if (contact.isStealth) rec = 'EW Jamming detected. Send recon Drones for visual confirmation!';
                         else if (contact.type.includes('BOMBER')) rec = 'Heavy payload threat. Intercept with Fighter Squadron!';
                      }
                      addLog('AI ADVISOR', `TACTICAL RECOMMENDATION: ${rec}`, 'suggest');
                  } else if (contact.trueIff === 'CIVILIAN') {
                      addLog('AI ADVISOR', `Verified as CIVILIAN Commercial Flight. DO NOT ENGAGE.`, 'safe');
                  }
              }, 500);
          }
      } else {
          setPriorityTargetId(null);
      }
    };

    canvas.addEventListener('click', handleCanvasClick);
    return () => canvas.removeEventListener('click', handleCanvasClick);
  }, [contacts, radarMode]);

  const handleReset = (newMode = radarMode) => {
    setPriorityTargetId(null);
    setInterceptors([]);
    setExplosions([]);
    setScore(0);
    casualtyTimer.current = 0;
    seenContacts.current = {};
    setContacts([spawnContact(newMode === 'NAVY'), spawnContact(newMode === 'NAVY'), spawnContact(newMode === 'NAVY'), spawnContact(newMode === 'NAVY')]);
    addLog('SYSTEM', `${newMode === 'AIR' ? 'AIR EARLY WARNING' : 'NAVAL SONAR SEARCH'} INITIALIZED.`, 'info');
  };

  const toggleMode = () => {
    const nextMode = radarMode === 'AIR' ? 'NAVY' : 'AIR';
    setRadarMode(nextMode);
    handleReset(nextMode);
  };

  // CORE RADAR LOOP
  useEffect(() => {
    let animationFrameId;
    let lastTime = performance.now();

    const loop = (time) => {
      if (time - lastTime > 30) {
        lastTime = time;
        const sweepSpeed = radarMode === 'AIR' ? 1200 : 2500;
        const sweepAngle = (Date.now() / sweepSpeed) % (Math.PI * 2);

        stormRef.current.x = basePos.x - 100 + Math.sin(Date.now() / 10000) * 200;
        stormRef.current.y = basePos.y - 50 + Math.cos(Date.now() / 15000) * 150;

        setContacts(prevContacts => {
          let updatedContacts = prevContacts.map(contact => {
            if (contact.status === 'DESTROYED') {
              const newTimer = contact.deathTimer + 1;
              if (newTimer > 60) return spawnContact(radarMode === 'NAVY');
              return { ...contact, deathTimer: newTimer };
            }
            let newX = contact.x + contact.vx;
            let newY = contact.y + contact.vy;
            if (Math.hypot(newX - basePos.x, newY - basePos.y) > 700) {
                return spawnContact(radarMode === 'NAVY');
            }
            return { ...contact, x: newX, y: newY };
          });

          // RADAR TEAM WARNING LOGIC
          updatedContacts.forEach(c => {
             const dist = Math.hypot(c.x - basePos.x, c.y - basePos.y);
             if (dist <= radarRadius && c.status === 'ACTIVE' && !seenContacts.current[c.id]) {
                 seenContacts.current[c.id] = true;
                 // Timeout used to safely update state outside the fast render loop
                 setTimeout(() => {
                     addLog('RADAR TEAM', `Unknown contact ${c.id} entering airspace. Transmitting [WARN TX] on Guard Frequency.`, 'warn');
                 }, 0);
             }
          });

          // FIRE CONTROL LOGIC
          setInterceptors(prevInterceptors => {
            let newInterceptors = [...prevInterceptors];
            
            const activeContacts = updatedContacts.filter(c => 
              c.status === 'ACTIVE' && c.displayIff !== 'CIVILIAN' && c.authorized === true && Math.hypot(c.x - basePos.x, c.y - basePos.y) <= radarRadius
            );
            
            if (isAIActive && activeContacts.length > 0) {
              let targetContact = activeContacts.find(c => c.id === priorityTargetId) || activeContacts[0];
              let targetDist = Math.hypot(targetContact.x - basePos.x, targetContact.y - basePos.y);
              
              if (targetDist < 300 && Date.now() - lastAutoFire.current > 1500) {
                let closestBattery = samBatteries.reduce((min, bat) => {
                    let d = Math.hypot(bat.x - targetContact.x, bat.y - targetContact.y);
                    return d < min.dist ? { battery: bat, dist: d } : min;
                }, { battery: samBatteries[0], dist: 9999 }).battery;

                newInterceptors.push({ 
                    x: closestBattery.x, y: closestBattery.y, speed: 20, 
                    targetId: targetContact.id, source: closestBattery.id
                });
                
                lastAutoFire.current = Date.now();
                setTimeout(() => addLog('SYSTEM', `LAUNCH DETECTED: ${closestBattery.id} FIRED AT ${targetContact.id}`, 'info'), 0);
              }
            }

            return newInterceptors.map(inter => {
              let tEnemy = updatedContacts.find(c => c.id === inter.targetId && c.status === 'ACTIVE');
              if (!tEnemy) return null; 

              const mdist = Math.hypot(tEnemy.x - inter.x, tEnemy.y - inter.y);
              if (mdist < 15) {
                if (tEnemy.trueIff === 'CIVILIAN') {
                    casualtyTimer.current = 150; 
                    setScore(s => s - 1000);
                    setTimeout(() => addLog('SYSTEM', `CRITICAL: CIVILIAN CASUALTY. PROTOCOL BREACH.`, 'alert'), 0);
                } else {
                    setScore(s => s + 150);
                    setTimeout(() => addLog('RADAR TEAM', `Target ${tEnemy.id} destroyed. Good hit.`, 'safe'), 0);
                }
                updatedContacts = updatedContacts.map(c => c.id === tEnemy.id ? { ...c, status: 'DESTROYED', vx: 0, vy: 0, deathTimer: 0, displayIff: c.trueIff } : c);
                setExplosions(ex => [...ex, { x: tEnemy.x, y: tEnemy.y, life: 15 }]);
                return null;
              }
              return { ...inter, x: inter.x + ((tEnemy.x - inter.x) / mdist) * inter.speed, y: inter.y + ((tEnemy.y - inter.y) / mdist) * inter.speed };
            }).filter(Boolean);
          });

          return updatedContacts;
        });
        setExplosions(prev => prev.map(e => ({ ...e, life: e.life - 1 })).filter(e => e.life > 0));
      }

      // --- CANVAS DRAWING ---
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const cx = basePos.x, cy = basePos.y; 
        const isNavy = radarMode === 'NAVY';
        const sweepAngle = (Date.now() / (isNavy ? 2500 : 1200)) % (Math.PI * 2);

        const radarBgColor = isNavy ? '#010a17' : '#011c09'; 
        const radarLineColor = isNavy ? 'rgba(14, 165, 233, 0.3)' : 'rgba(34, 197, 94, 0.3)'; 
        const radarSweepColorSolid = isNavy ? 'rgba(56, 189, 248, 0.7)' : 'rgba(74, 222, 128, 0.8)';
        const textColor = isNavy ? '#38bdf8' : '#4ade80';

        ctx.save();
        ctx.scale(2, 2); 

        ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, logicalWidth, logicalHeight);

        // BEZEL
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
          ctx.strokeStyle = isMajor ? textColor : '#475569'; ctx.lineWidth = isMajor ? 2 : 1; ctx.stroke();

          if(i % (isNavy ? 45 : 30) === 0) {
             let text = i.toString().padStart(3, '0');
             if(i===0) text = 'N 000'; if(i===90) text = 'E 090'; if(i===180) text = 'S 180'; if(i===270) text = 'W 270';
             ctx.fillStyle = isMajor ? '#ffffff' : '#94a3b8';
             ctx.fillText(text, cx + Math.cos(rad) * outerR, cy + Math.sin(rad) * outerR);
          }
        }
        ctx.textAlign = 'left';

        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy, radarRadius, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = radarBgColor; ctx.fill();

        ctx.beginPath();
        ctx.moveTo(cx - 300, cy - 400);
        ctx.bezierCurveTo(cx - 100, cy - 200, cx + 50, cy + 100, cx + 400, cy - 50);
        ctx.lineTo(cx + 400, cy + 400); ctx.lineTo(cx - 400, cy + 400);
        ctx.closePath();
        ctx.fillStyle = isNavy ? 'rgba(8, 47, 73, 0.4)' : 'rgba(20, 83, 45, 0.2)'; ctx.fill();
        ctx.strokeStyle = isNavy ? 'rgba(14, 165, 233, 0.2)' : 'rgba(34, 197, 94, 0.2)';
        ctx.lineWidth = 2; ctx.stroke();

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
          ctx.fillStyle = radarLineColor; ctx.fillText(`${r/2}${isNavy ? 'Yds' : 'NM'}`, cx + 2, cy - r - 2);
        }

        ctx.beginPath(); ctx.arc(cx, cy, 220, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.2)'; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
        
        ctx.beginPath(); ctx.arc(cx, cy, 120, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.3)'; ctx.setLineDash([2, 4]); ctx.stroke(); ctx.setLineDash([]);

        const sX = stormRef.current.x;
        const sY = stormRef.current.y;
        const sR = stormRef.current.radius;
        ctx.beginPath(); ctx.arc(sX, sY, sR, 0, Math.PI*2);
        ctx.fillStyle = isNavy ? 'rgba(56, 189, 248, 0.05)' : 'rgba(148, 163, 184, 0.1)'; ctx.fill();
        ctx.strokeStyle = isNavy ? 'rgba(56, 189, 248, 0.1)' : 'rgba(148, 163, 184, 0.2)';
        ctx.setLineDash([10, 10]); ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);

        if (isNavy && isAIActive) {
          const pingProgress = (Date.now() % 2500) / 2500;
          ctx.beginPath(); ctx.arc(cx, cy, pingProgress * radarRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(56, 189, 248, ${1 - pingProgress})`; ctx.lineWidth = 4; ctx.stroke();
        }

        if (ctx.createConicGradient) {
          const gradient = ctx.createConicGradient(sweepAngle - Math.PI/2, cx, cy);
          gradient.addColorStop(0, radarSweepColorSolid); 
          gradient.addColorStop(isNavy ? 0.05 : 0.1, isNavy ? 'rgba(56,189,248,0.1)' : 'rgba(34,197,94,0.2)'); 
          gradient.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gradient;
          ctx.beginPath(); ctx.arc(cx, cy, radarRadius, 0, Math.PI*2); ctx.fill();
        }
        
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(sweepAngle)*radarRadius, cy + Math.sin(sweepAngle)*radarRadius);
        ctx.strokeStyle = isNavy ? '#7dd3fc' : '#ffffff'; ctx.lineWidth = isNavy ? 1 : 2; ctx.stroke();

        ctx.restore(); // END MASK

        const drawTacticalText = (text, x, y, color, bold=false) => { 
          ctx.fillStyle = color; ctx.font = `${bold ? 'bold ' : ''}11px "Courier New", monospace`; ctx.fillText(text, x, y); 
        };

        // EW-RADAR
        ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.strokeStyle = textColor; ctx.lineWidth = 1; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - 10); ctx.stroke();
        drawTacticalText(`EW-RADAR`, cx + 10, cy - 5, isNavy ? '#0ea5e9' : '#38bdf8', true);
        
        drawTacticalText(`WX: STORM CELL`, sX - 40, sY, isNavy ? '#38bdf8' : '#94a3b8');

        samBatteries.forEach(bat => {
            ctx.beginPath(); ctx.rect(bat.x - 5, bat.y - 5, 10, 10);
            ctx.fillStyle = 'rgba(74, 222, 128, 0.2)'; ctx.fill();
            ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 1; ctx.stroke();
            const isFiring = Date.now() - lastAutoFire.current < 300 && interceptors.some(i => i.source === bat.id);
            if (isFiring) {
                ctx.beginPath(); ctx.arc(bat.x, bat.y, 12, 0, Math.PI*2); ctx.strokeStyle = '#f97316'; ctx.stroke();
            }
            drawTacticalText(bat.id, bat.x - 25, bat.y + 15, '#94a3b8');
        });

        contacts.forEach(contact => {
          const distToCenter = Math.hypot(contact.x - cx, contact.y - cy);
          if (distToCenter > radarRadius) return;

          const isActive = contact.status === 'ACTIVE';
          const isMarked = contact.id === priorityTargetId;
          const distToStorm = Math.hypot(contact.x - sX, contact.y - sY);
          const isWeatherJammed = distToStorm < sR && isActive;
          const isJamming = (contact.isStealth && !contact.authorized && isActive) || isWeatherJammed; 
          
          let color = '#475569';
          if (isActive) {
              if (contact.displayIff === 'UNKNOWN') color = isJamming ? '#a1a1aa' : '#facc15';
              else if (contact.displayIff === 'HOSTILE') color = '#ef4444';
              else if (contact.displayIff === 'CIVILIAN') color = '#22d3ee';
          }
          
          ctx.save();
          if (isJamming) {
              ctx.globalAlpha = Math.random() > 0.4 ? 0.3 : 0.9;
              ctx.translate(contact.x + (Math.random() * 4 - 2), contact.y + (Math.random() * 4 - 2));
          } else {
              ctx.globalAlpha = 1.0;
              ctx.translate(contact.x, contact.y);
          }
          
          if (isActive && !isJamming) {
             ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(contact.vx * 60, contact.vy * 60);
             ctx.strokeStyle = color; ctx.globalAlpha = 0.4; ctx.setLineDash([3, 4]); ctx.lineWidth = 1; ctx.stroke();
             ctx.setLineDash([]); ctx.globalAlpha = 1.0; 
          }

          if (isActive) {
            ctx.beginPath();
            if (contact.authorized && !isWeatherJammed) {
                ctx.rotate(Date.now()/500);
                ctx.moveTo(-15, 0); ctx.lineTo(15, 0); ctx.moveTo(0, -15); ctx.lineTo(0, 15);
                ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
                ctx.rotate(-Date.now()/500); 
            } else if (isJamming) {
                ctx.moveTo(-5, -5); ctx.lineTo(5, 5); ctx.moveTo(5, -5); ctx.lineTo(-5, 5);
                ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
            } else {
                ctx.arc(0, 0, 8, 0, Math.PI * 2);
                ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
            }
          }

          if (isActive && !isJamming) {
             ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(contact.vx * 15, contact.vy * 15);
             ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
          }
          ctx.restore();

          if (isActive) {
            ctx.beginPath(); ctx.moveTo(contact.x + 10, contact.y - 10); ctx.lineTo(contact.x + 20, contact.y - 20); ctx.lineTo(contact.x + 40, contact.y - 20); 
            ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
            
            let displayName = isJamming ? (isWeatherJammed ? 'WX CLUTTER' : 'ERR: JAMMING') : contact.id;
            drawTacticalText(`${displayName}`, contact.x + 45, contact.y - 25, isJamming ? '#ef4444' : color, true);
            drawTacticalText(`HDG: ${isJamming ? '---' : Math.floor(contact.hdg) + '°'}`, contact.x + 45, contact.y - 13, '#94a3b8');
            drawTacticalText(`SPD: ${isJamming ? '---' : Math.floor(contact.speed * 200)}`, contact.x + 45, contact.y - 3, '#94a3b8');
            
            if (!isJamming) {
                if (contact.authorized) {
                    drawTacticalText(`[ENGAGE AUTH]`, contact.x + 45, contact.y + 10, '#ef4444', true); 
                } else {
                    drawTacticalText(`[WARN TX]`, contact.x + 45, contact.y + 10, '#facc15', true); 
                }
            }
          } else {
            drawTacticalText(`SPLASH [T-${Math.max(0, Math.floor((60 - contact.deathTimer)/30))}s]`, contact.x + 10, contact.y, '#475569');
          }
        });

        interceptors.forEach(inter => { 
            ctx.beginPath(); ctx.arc(inter.x, inter.y, 2, 0, Math.PI * 2); 
            ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.shadowBlur = 5; ctx.shadowColor = '#ffffff';
        });

        explosions.forEach(e => { 
          ctx.beginPath(); ctx.arc(e.x, e.y, (15 - e.life) * 3, 0, Math.PI * 2); 
          ctx.fillStyle = `rgba(239, 68, 68, ${e.life / 20})`; ctx.fill(); 
        });

        if (casualtyTimer.current > 0) {
            ctx.fillStyle = `rgba(220, 38, 38, ${Math.abs(Math.sin(Date.now() / 150)) * 0.4})`;
            ctx.fillRect(0, 0, logicalWidth, logicalHeight);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 24px "Courier New", monospace';
            ctx.textAlign = 'center';
            ctx.shadowBlur = 10; ctx.shadowColor = 'red';
            ctx.fillText("CRITICAL ERROR: CIVILIAN CASUALTY DETECTED", logicalWidth/2, logicalHeight/2 - 20);
            ctx.fillText("PROTOCOL BREACH", logicalWidth/2, logicalHeight/2 + 20);
            ctx.textAlign = 'left'; ctx.shadowBlur = 0;
            casualtyTimer.current--;
        }
        
        ctx.restore(); 
      }
      animationFrameId = requestAnimationFrame(loop);
    };
    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isAIActive, contacts, radarMode, interceptors, priorityTargetId]); 

  const activeThreats = contacts.filter(c => c.status === 'ACTIVE' && Math.hypot(c.x - basePos.x, c.y - basePos.y) <= radarRadius);

  return (
    <div style={{ backgroundColor: '#020617', color: 'white', minHeight: '100vh', padding: '15px', fontFamily: '"Courier New", monospace', display: 'flex', flexDirection: 'column' }}>
      
      <header style={{ borderBottom: '1px solid #38bdf8', paddingBottom: '10px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexShrink: 0 }}>
        <div><h1 style={{ color: '#38bdf8', margin: 0, fontSize: '24px', textShadow: '0 0 10px rgba(56, 189, 248, 0.4)' }}>C4ISR // TACTICAL AIR DEFENSE SYSTEM</h1></div>
        <div style={{ color: '#4ade80', fontSize: '12px', border: '1px solid #4ade80', padding: '5px 10px', borderRadius: '4px', backgroundColor: 'rgba(74, 222, 128, 0.1)' }}>LINK: SECURE</div>
      </header>

      {/* TOP SECTION: Controls, Radar, Score */}
      <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr 280px', gap: '20px', flex: 1, minHeight: '550px' }}>
        
        {/* LEFT PANEL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ backgroundColor: '#0f172a', padding: '15px', borderRadius: '8px', border: '1px solid #334155', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)' }}>
            <h2 style={{ color: '#94a3b8', fontSize: '12px', marginTop: 0, marginBottom: '10px', borderBottom: '1px solid #1e293b', paddingBottom: '5px' }}>SYS CONTROLS</h2>
            <button onClick={toggleMode} style={{ width: '100%', padding: '10px', marginBottom: '10px', backgroundColor: radarMode === 'NAVY' ? '#082f49' : '#022c11', color: radarMode === 'NAVY' ? '#7dd3fc' : '#86efac', border: '1px solid ' + (radarMode === 'NAVY' ? '#0ea5e9' : '#22c55e'), borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
              {radarMode === 'AIR' ? '✈️ AIR RADAR' : '🌊 NAVAL SONAR'}
            </button>
            <button onClick={() => setIsAIActive(!isAIActive)} style={{ width: '100%', padding: '10px', marginBottom: '10px', backgroundColor: isAIActive ? '#7f1d1d' : '#1e293b', color: isAIActive ? '#fca5a5' : '#cbd5e1', border: '1px solid ' + (isAIActive ? '#ef4444' : '#475569'), borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
              {isAIActive ? 'MASTER ARM: SAFE' : 'MASTER ARM: READY'}
            </button>
            <button onClick={() => handleReset(radarMode)} style={{ width: '100%', padding: '10px', backgroundColor: '#1e293b', color: '#cbd5e1', border: '1px solid #475569', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>CLEAR SCOPE</button>
          </div>

          <div style={{ backgroundColor: 'rgba(34, 211, 238, 0.1)', border: '1px solid #0891b2', padding: '15px', borderRadius: '8px' }}>
            <div style={{ color: '#22d3ee', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>RADAR LEGEND</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: '1.6' }}>
                <span style={{color: '#facc15'}}>🟡 UNKNOWN:</span> Wait for Auth<br/>
                <span style={{color: '#ef4444'}}>🔴 HOSTILE:</span> Enemy Threat<br/>
                <span style={{color: '#22d3ee'}}>🔵 CIVILIAN:</span> No Engage<br/>
                <span style={{color: '#a1a1aa'}}>✖️ JAMMING:</span> Stealth / Storm<br/>
            </div>
          </div>
        </div>

        {/* CENTER WIDESCREEN RADAR */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ flex: 1, position: 'relative', border: '3px solid #334155', borderRadius: '12px', backgroundColor: '#020617', boxShadow: '0 0 30px rgba(0, 0, 0, 0.8)', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 4px, 3px 100%', pointerEvents: 'none', zIndex: 10 }}></div>
            <canvas ref={canvasRef} width={2000} height={1700} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', cursor: priorityTargetId ? 'crosshair' : 'crosshair' }} />
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ backgroundColor: '#0f172a', padding: '15px', border: '1px solid #1e293b', borderRadius: '8px', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)' }}>
            <h2 style={{ color: '#38bdf8', fontSize: '12px', marginTop: 0, borderBottom: '1px solid #1e293b', paddingBottom: '5px' }}>📊 COMMANDER SCORE</h2>
            <div style={{ fontSize: '28px', color: score < 0 ? '#ef4444' : '#4ade80', fontWeight: 'bold', marginTop: '5px', textAlign: 'center' }}>
                {score}
            </div>
          </div>

          <div style={{ backgroundColor: 'rgba(127, 29, 29, 0.1)', padding: '15px', border: '1px solid #7f1d1d', borderRadius: '8px', flex: 1 }}>
            <h2 style={{ color: '#ef4444', fontSize: '12px', marginTop: 0, borderBottom: '1px solid #7f1d1d', paddingBottom: '5px' }}>⚠️ ACTIVE TRACKS</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px', fontSize: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#fca5a5' }}>Contacts:</span> <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{activeThreats.length}</span></div>
              
              <div style={{ backgroundColor: '#451a1a', padding: '10px', borderRadius: '6px', marginTop: '5px', maxHeight: '300px', overflowY: 'auto' }}>
                {activeThreats.map(c => {
                  const isJamming = c.isStealth && !c.authorized;
                  let col = '#facc15';
                  if (isJamming) col = '#a1a1aa';
                  else if (c.displayIff === 'HOSTILE') col = '#ef4444';
                  else if (c.displayIff === 'CIVILIAN') col = '#22d3ee';
                  
                  return (
                    <div key={c.id} style={{ marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px dashed #7f1d1d' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: col, fontWeight: 'bold' }}>
                        <span>{isJamming ? '???' : c.id}</span> <span>{isJamming ? 'SIGNAL LOST' : (c.authorized ? 'ENGAGE AUTH' : 'WARN TX')}</span>
                      </div>
                    </div>
                  );
                })}
                {activeThreats.length === 0 && <div style={{color: '#94a3b8', textAlign:'center'}}>NO ACTIVE CONTACTS</div>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* NEW: DEDICATED AI ADVISORY TERMINAL (BOTTOM FULL WIDTH) */}
      <div style={{ 
          height: '180px', 
          backgroundColor: '#020617', 
          border: '1px solid #3b82f6', 
          borderRadius: '8px', 
          marginTop: '15px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8)'
      }}>
          <div style={{ 
              padding: '6px 15px', 
              backgroundColor: '#1e3a8a', 
              color: '#93c5fd', 
              fontSize: '12px', 
              fontWeight: 'bold', 
              borderTopLeftRadius: '7px', 
              borderTopRightRadius: '7px', 
              borderBottom: '1px solid #3b82f6',
              display: 'flex',
              justifyContent: 'space-between'
          }}>
              <span>🧠 AI TACTICAL ADVISORY & COMMS LINK</span>
              <span style={{ color: '#60a5fa' }}>LIVE ENCRYPTION: ACTIVE</span>
          </div>
          
          <div style={{ 
              flex: 1, 
              padding: '12px 15px', 
              overflowY: 'auto', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '6px', 
              fontSize: '12px' 
          }}>
              {logs.map((log, index) => (
                  <div key={index} style={{ display: 'flex', gap: '12px', lineHeight: '1.4' }}>
                      <span style={{ color: '#475569', minWidth: '65px' }}>[{log.time}]</span>
                      <span style={{ 
                          color: log.sender === 'AI ADVISOR' ? '#c084fc' : (log.sender === 'RADAR TEAM' ? '#38bdf8' : (log.sender === 'COMMANDER' ? '#fcd34d' : '#94a3b8')),
                          fontWeight: 'bold',
                          minWidth: '110px'
                      }}>{log.sender}:</span>
                      <span style={{ 
                          color: log.type === 'alert' ? '#ef4444' : (log.type === 'warn' ? '#facc15' : (log.type === 'suggest' ? '#a78bfa' : (log.type === 'safe' ? '#4ade80' : '#cbd5e1'))),
                          fontWeight: log.type === 'alert' || log.type === 'warn' ? 'bold' : 'normal'
                      }}>{log.text}</span>
                  </div>
              ))}
              {/* Invisible div to scroll to bottom */}
              <div ref={logsEndRef} /> 
          </div>
      </div>

    </div>
  );
}