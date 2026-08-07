import React, { useState, useEffect, useRef } from 'react';

// HELPER: Spawn contacts with hidden true identity
const spawnContact = (isNavy) => {
  const angle = Math.random() * Math.PI * 2;
  const dist = 600; 
  const startX = 500 + Math.cos(angle) * dist;
  const startY = 425 + Math.sin(angle) * dist;
  
  const targetAngle = angle + Math.PI + (Math.random() * 0.8 - 0.4); 
  const speed = (Math.random() * 1.5) + (isNavy ? 0.4 : 0.8);

  const isCiv = Math.random() > 0.65; // 35% chance it's a Civilian
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

  return {
    id: `TRK-${Math.floor(Math.random()*9000)+1000}`,
    type: type,
    trueIff: trueIff,
    displayIff: 'UNKNOWN', // Starts as unknown to the radar operator
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
  const basePos = { x: 500, y: 425 }; 
  const radarRadius = 380; 

  const [contacts, setContacts] = useState([spawnContact(false), spawnContact(false), spawnContact(false), spawnContact(false)]);
  const [priorityTargetId, setPriorityTargetId] = useState(null);
  const [interceptors, setInterceptors] = useState([]);
  const [score, setScore] = useState(0);
  const [baseHealth, setBaseHealth] = useState(100);
  
  const lastAutoFire = useRef(0);
  const lastDefFire = useRef({ 'DEF-1': 0, 'DEF-2': 0 });
  const casualtyTimer = useRef(0); // For civilian penalty UI
  
  const units = [ { id: 'DEF-1', x: 440, y: 475 }, { id: 'DEF-2', x: 560, y: 475 } ];
  const [explosions, setExplosions] = useState([]);

  const [advisorText, setAdvisorText] = useState('SYSTEM READY. AWAITING COMMANDER DIRECTIVE.');

  // Mouse Interaction (IFF Interrogation & Lock)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleCanvasClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
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
          // Identify IFF on click
          setContacts(prev => prev.map(c => c.id === clickedTargetId ? { ...c, displayIff: c.trueIff } : c));
          setPriorityTargetId(clickedTargetId);
          setAdvisorText(`⚠️ IFF INTERROGATION: ${clickedTargetId} IDENTIFIED.`);
      } else {
          setPriorityTargetId(null);
          setAdvisorText(`TARGET MARKER CLEARED. NORMAL SWEEP ACTIVE.`);
      }
    };

    canvas.addEventListener('click', handleCanvasClick);
    return () => canvas.removeEventListener('click', handleCanvasClick);
  }, [contacts]);

  const handleReset = (newMode = radarMode) => {
    setPriorityTargetId(null);
    setInterceptors([]);
    setExplosions([]);
    setScore(0);
    setBaseHealth(100);
    casualtyTimer.current = 0;
    setContacts([spawnContact(newMode === 'NAVY'), spawnContact(newMode === 'NAVY'), spawnContact(newMode === 'NAVY'), spawnContact(newMode === 'NAVY')]);
    setAdvisorText(`${newMode === 'AIR' ? 'AIRSPACE RADAR' : 'NAVAL SONAR'} INITIALIZED.`);
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

          // AUTO INTERCEPT LOGIC
          setInterceptors(prevInterceptors => {
            let newInterceptors = [...prevInterceptors];
            
            // Only engage Hostile or Unknown targets (never verified Civilians)
            const activeContacts = updatedContacts.filter(c => 
              c.status === 'ACTIVE' && 
              c.displayIff !== 'CIVILIAN' &&
              Math.hypot(c.x - basePos.x, c.y - basePos.y) <= radarRadius
            );
            
            if (isAIActive && activeContacts.length > 0) {
              let targetContact = activeContacts.find(c => c.id === priorityTargetId);
              if (!targetContact) {
                  targetContact = activeContacts.reduce((min, c) => {
                    let d = Math.hypot(c.x - basePos.x, c.y - basePos.y);
                    return d < min.dist ? { contact: c, dist: d } : min;
                  }, { contact: activeContacts[0], dist: 9999 }).contact;
              }

              let targetDist = Math.hypot(targetContact.x - basePos.x, targetContact.y - basePos.y);
              
              // Rule of Engagement: Shoot HOSTILE at 220 NM. Shoot UNKNOWN only if it gets too close (panic range 120 NM)
              let engageRange = targetContact.displayIff === 'HOSTILE' ? 220 : 120;

              if (targetDist < engageRange && Date.now() - lastAutoFire.current > 1500) {
                newInterceptors.push({ x: basePos.x, y: basePos.y, speed: 18, targetId: targetContact.id });
                lastAutoFire.current = Date.now();
                if (targetContact.displayIff === 'UNKNOWN') setAdvisorText(`🚨 CRITICAL: UNKNOWN TARGET BREACH. ENGAGING!`);
                else setAdvisorText(`💥 AUTO-DEFENSE ENGAGED HOSTILE ${targetContact.id}`);
              }
            }

            // Move interceptors and check hits
            return newInterceptors.map(inter => {
              let tEnemy = updatedContacts.find(c => c.id === inter.targetId && c.status === 'ACTIVE');
              if (!tEnemy) return null; 

              const mdist = Math.hypot(tEnemy.x - inter.x, tEnemy.y - inter.y);
              if (mdist < 15) {
                // CIVILIAN CASUALTY CHECK
                if (tEnemy.trueIff === 'CIVILIAN') {
                    casualtyTimer.current = 150; // Triggers UI warning
                    setScore(s => s - 1000);
                } else {
                    setScore(s => s + 150);
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

        ctx.beginPath(); ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10); ctx.stroke();
        drawTacticalText(`C4ISR-LINK`, cx + 15, cy + 5, isNavy ? '#0ea5e9' : '#38bdf8', true);

        // CONTACTS DRAWING WITH IFF COLORS
        contacts.forEach(contact => {
          const distToCenter = Math.hypot(contact.x - cx, contact.y - cy);
          if (distToCenter > radarRadius) return;

          const isActive = contact.status === 'ACTIVE';
          const isMarked = contact.id === priorityTargetId;
          
          // IFF COLORS: Unknown (Yellow), Hostile (Red), Civilian (Cyan)
          let color = '#475569';
          if (isActive) {
              if (contact.displayIff === 'UNKNOWN') color = '#facc15';
              else if (contact.displayIff === 'HOSTILE') color = '#ef4444';
              else if (contact.displayIff === 'CIVILIAN') color = '#22d3ee';
          }
          
          ctx.save();
          ctx.translate(contact.x, contact.y);
          
          if (isActive) {
            ctx.beginPath();
            if (isMarked) {
                ctx.rotate(Date.now()/500);
                ctx.moveTo(-15, 0); ctx.lineTo(15, 0); ctx.moveTo(0, -15); ctx.lineTo(0, 15);
                ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
                ctx.rotate(-Date.now()/500); 
            } else {
                ctx.arc(0, 0, 8, 0, Math.PI * 2);
                ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
            }
          }

          if (isActive) {
             ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(contact.vx * 15, contact.vy * 15);
             ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
          }

          ctx.restore();

          if (isActive) {
            ctx.beginPath(); ctx.moveTo(contact.x + 10, contact.y - 10); ctx.lineTo(contact.x + 20, contact.y - 20); ctx.lineTo(contact.x + 40, contact.y - 20); 
            ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
            
            drawTacticalText(`${contact.id}`, contact.x + 45, contact.y - 25, color, true);
            drawTacticalText(`HDG: ${Math.floor(contact.hdg)}°`, contact.x + 45, contact.y - 13, '#94a3b8');
            drawTacticalText(`SPD: ${Math.floor(contact.speed * 200)}`, contact.x + 45, contact.y - 3, '#94a3b8');
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

        // PROTOCOL BREACH WARNING OVERLAY
        if (casualtyTimer.current > 0) {
            ctx.fillStyle = `rgba(220, 38, 38, ${Math.abs(Math.sin(Date.now() / 150)) * 0.4})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 24px "Courier New", monospace';
            ctx.textAlign = 'center';
            ctx.shadowBlur = 10; ctx.shadowColor = 'red';
            ctx.fillText("CRITICAL ERROR: CIVILIAN CASUALTY DETECTED", canvas.width/2, canvas.height/2 - 20);
            ctx.fillText("PROTOCOL BREACH", canvas.width/2, canvas.height/2 + 20);
            ctx.textAlign = 'left';
            ctx.shadowBlur = 0;
            casualtyTimer.current--;
        }
      }
      animationFrameId = requestAnimationFrame(loop);
    };
    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isAIActive, contacts, radarMode, interceptors, priorityTargetId]); 

  const activeThreats = contacts.filter(c => c.status === 'ACTIVE' && Math.hypot(c.x - basePos.x, c.y - basePos.y) <= radarRadius);

  return (
    <div style={{ backgroundColor: '#000000', color: 'white', minHeight: '100vh', padding: '20px', fontFamily: '"Courier New", monospace', backgroundImage: 'radial-gradient(circle, #0f172a 0%, #000000 90%)', display: 'flex', flexDirection: 'column' }}>
      
      <header style={{ borderBottom: '1px solid #38bdf8', paddingBottom: '10px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexShrink: 0 }}>
        <div><h1 style={{ color: '#38bdf8', margin: 0, fontSize: '26px', textShadow: '0 0 10px rgba(56, 189, 248, 0.4)' }}>C4ISR // TACTICAL RADAR SIMULATION</h1></div>
        <div style={{ color: '#4ade80', fontSize: '13px', border: '1px solid #4ade80', padding: '5px 10px', borderRadius: '4px', backgroundColor: 'rgba(74, 222, 128, 0.1)' }}>LINK: SECURE</div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr 280px', gap: '25px', flex: 1, alignItems: 'stretch' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px solid #334155', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)' }}>
            <h2 style={{ color: '#94a3b8', fontSize: '13px', marginTop: 0, marginBottom: '15px', borderBottom: '1px solid #1e293b', paddingBottom: '8px' }}>SYS CONTROLS</h2>
            <button onClick={toggleMode} style={{ width: '100%', padding: '12px', marginBottom: '15px', backgroundColor: radarMode === 'NAVY' ? '#082f49' : '#022c11', color: radarMode === 'NAVY' ? '#7dd3fc' : '#86efac', border: '1px solid ' + (radarMode === 'NAVY' ? '#0ea5e9' : '#22c55e'), borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
              {radarMode === 'AIR' ? '✈️ AIR RADAR' : '🌊 NAVAL SONAR'}
            </button>
            <button onClick={() => setIsAIActive(!isAIActive)} style={{ width: '100%', padding: '12px', marginBottom: '10px', backgroundColor: isAIActive ? '#7f1d1d' : '#1e293b', color: isAIActive ? '#fca5a5' : '#cbd5e1', border: '1px solid ' + (isAIActive ? '#ef4444' : '#475569'), borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
              {isAIActive ? 'HALT DEFENSE' : 'AUTO ENGAGE'}
            </button>
            <button onClick={() => handleReset(radarMode)} style={{ width: '100%', padding: '12px', backgroundColor: '#1e293b', color: '#cbd5e1', border: '1px solid #475569', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>CLEAR SCOPE</button>
          </div>

          <div style={{ backgroundColor: '#1e1b4b', border: '1px solid #6366f1', padding: '15px', borderRadius: '8px' }}>
            <div style={{ color: '#818cf8', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>AI ADVISORY</div>
            <div style={{ color: '#e0e7ff', fontSize: '13px', lineHeight: '1.5' }}>{advisorText}</div>
          </div>
          
          <div style={{ backgroundColor: 'rgba(34, 211, 238, 0.1)', border: '1px solid #0891b2', padding: '15px', borderRadius: '8px' }}>
            <div style={{ color: '#22d3ee', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>LEGEND (IFF)</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: '1.6' }}>
                <span style={{color: '#facc15'}}>🟡 UNKNOWN:</span> Needs Verification<br/>
                <span style={{color: '#ef4444'}}>🔴 HOSTILE:</span> Enemy Threat<br/>
                <span style={{color: '#22d3ee'}}>🔵 CIVILIAN:</span> No Engage Zone
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ flex: 1, minHeight: '600px', position: 'relative', border: '3px solid #334155', borderRadius: '12px', backgroundColor: '#020617', boxShadow: '0 0 40px rgba(0, 0, 0, 0.9)', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 4px, 3px 100%', pointerEvents: 'none', zIndex: 10 }}></div>
            <canvas ref={canvasRef} width={1000} height={850} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', cursor: priorityTargetId ? 'crosshair' : 'crosshair' }} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ backgroundColor: '#0f172a', padding: '15px', border: '1px solid #1e293b', borderRadius: '8px', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)' }}>
            <h2 style={{ color: '#38bdf8', fontSize: '13px', marginTop: 0, borderBottom: '1px solid #1e293b', paddingBottom: '8px' }}>📊 COMMANDER SCORE</h2>
            <div style={{ fontSize: '32px', color: score < 0 ? '#ef4444' : '#4ade80', fontWeight: 'bold', marginTop: '10px', textAlign: 'center' }}>
                {score}
            </div>
          </div>

          <div style={{ backgroundColor: 'rgba(127, 29, 29, 0.1)', padding: '15px', border: '1px solid #7f1d1d', borderRadius: '8px', flex: 1 }}>
            <h2 style={{ color: '#ef4444', fontSize: '13px', marginTop: 0, borderBottom: '1px solid #7f1d1d', paddingBottom: '8px' }}>⚠️ ACTIVE TRACKS</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#fca5a5' }}>Contacts:</span> <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{activeThreats.length}</span></div>
              
              <div style={{ backgroundColor: '#451a1a', padding: '12px', borderRadius: '6px', marginTop: '8px' }}>
                <div style={{ color: '#fca5a5', fontSize: '11px', fontWeight: 'bold', marginBottom: '10px' }}>TARGET IFF TELEMETRY</div>
                {activeThreats.map(c => {
                  let col = '#facc15';
                  if (c.displayIff === 'HOSTILE') col = '#ef4444';
                  else if (c.displayIff === 'CIVILIAN') col = '#22d3ee';
                  
                  const displayName = c.displayIff === 'UNKNOWN' ? 'UNKNOWN BOGEY' : c.type;

                  return (
                    <div key={c.id} style={{ marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px dashed #7f1d1d' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: col, fontWeight: 'bold' }}>
                        <span>{c.id}</span> <span>{c.displayIff}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#fca5a5', marginTop: '5px' }}>
                        <span>TYPE: {displayName}</span>
                      </div>
                    </div>
                  );
                })}
                {activeThreats.length === 0 && <div style={{color: '#94a3b8', fontSize: '10px', textAlign:'center'}}>NO ACTIVE CONTACTS</div>}
                
                <div style={{ color: '#94a3b8', fontSize: '10px', marginTop: '10px', textAlign: 'center', borderTop: '1px dashed #7f1d1d', paddingTop: '5px' }}>
                    Click target on radar to Interrogate IFF.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}