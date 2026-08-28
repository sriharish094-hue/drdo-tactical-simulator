import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client'; // NEW: Network Client

// Web Speech API Setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
if (recognition) {
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
}

const spawnContact = (isNavy) => {
  const angle = Math.random() * Math.PI * 2;
  const dist = 700; 
  const startX = 550 + Math.cos(angle) * dist;
  const startY = 475 + Math.sin(angle) * dist;
  
  const targetAngle = angle + Math.PI + (Math.random() * 0.8 - 0.4); 
  const speed = (Math.random() * 1.5) + (isNavy ? 0.4 : 0.8);
  const isCiv = Math.random() > 0.65; 
  let type, trueIff;
  
  if (isNavy) {
    trueIff = isCiv ? 'CIVILIAN' : 'HOSTILE';
    type = isCiv ? ['FISHING VESSEL', 'CARGO SHIP'][Math.floor(Math.random()*2)] : ['ATTACK SUB', 'FRIGATE'][Math.floor(Math.random()*2)];
  } else {
    trueIff = isCiv ? 'CIVILIAN' : 'HOSTILE';
    type = isCiv ? ['B737 COMMERCIAL', 'CARGO HEAVY'][Math.floor(Math.random()*2)] : ['FIGHTER JET', 'HEAVY BOMBER'][Math.floor(Math.random()*2)];
  }

  const isStealth = trueIff === 'HOSTILE' && Math.random() > 0.6;

  return {
    id: `TRK-${Math.floor(Math.random()*9000)+1000}`,
    type: isStealth ? 'UNKNOWN CLASSIFIED' : type,
    trueIff: trueIff,
    displayIff: 'UNKNOWN',
    isStealth: isStealth,
    autoIdentified: false,
    state: 'APPROACHING', 
    warnTime: null,
    x: startX, y: startY,
    vx: Math.cos(targetAngle) * speed, vy: Math.sin(targetAngle) * speed,
    hdg: (targetAngle * 180 / Math.PI + 90 + 360) % 360,
    speed: speed,
    alt: isNavy ? -(Math.floor(Math.random() * 50) * 10) : Math.floor(Math.random() * 300 + 100) * 100,
    status: 'ACTIVE', deathTimer: 0
  };
};

export default function App() {
  const canvasRef = useRef(null);
  const socketRef = useRef(null); // NEW: Socket Reference
  
  const [radarMode, setRadarMode] = useState('AIR'); 
  const [isMicActive, setIsMicActive] = useState(false);
  const [cliInput, setCliInput] = useState(''); 
  
  const logicalWidth = 1100;
  const logicalHeight = 950;
  const basePos = { x: logicalWidth/2, y: logicalHeight/2 }; 
  const radarRadius = 420; 

  const samBatteries = [
    { id: 'SAM-A', x: basePos.x - 80, y: basePos.y - 70 },
    { id: 'SAM-B', x: basePos.x + 80, y: basePos.y - 70 },
    { id: 'SAM-C', x: basePos.x, y: basePos.y + 90 }
  ];

  const [contacts, setContacts] = useState([spawnContact(false), spawnContact(false), spawnContact(false)]);
  const [priorityTargetId, setPriorityTargetId] = useState(null);
  const [interceptors, setInterceptors] = useState([]);
  const [score, setScore] = useState(0);
  
  const [arsenal, setArsenal] = useState({ aircraft: 4, drones: 3, sams: 12 });
  const stormRef = useRef({ x: basePos.x - 150, y: basePos.y - 200, radius: 140 });
  const [explosions, setExplosions] = useState([]);
  
  const [logs, setLogs] = useState([
    { id: 1, time: new Date().toLocaleTimeString('en-US', { hour12: false }), sender: 'SYSTEM', text: 'C4ISR UI INITIALIZED. CONNECTING TO SERVER...', type: 'info' }
  ]);
  const logsEndRef = useRef(null);

  const addLog = (sender, text, type = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [...prev.slice(-40), { id: Math.random(), time, sender, text, type }]);
  };

  useEffect(() => { if (logsEndRef.current) logsEndRef.current.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  // NEW: NETWORK CONNECTION LOGIC
  useEffect(() => {
      // Connect to our local server
      socketRef.current = io('http://localhost:3001');

      socketRef.current.on('connect', () => {
          addLog('SYSTEM', 'SERVER LINK ESTABLISHED. SECURE HANDSHAKE COMPLETED.', 'safe');
          // Join default role
          socketRef.current.emit('join_role', 'AIR COMMANDER');
      });

      socketRef.current.on('role_confirmed', (data) => {
          addLog('HQ', data.message, 'info');
      });

      socketRef.current.on('disconnect', () => {
          addLog('SYSTEM', 'CRITICAL ERROR: SERVER LINK LOST.', 'alert');
      });

      return () => socketRef.current.disconnect();
  }, []);

  // VOICE RECOGNITION SETUP
  useEffect(() => {
    if (!recognition) return;
    recognition.onresult = (event) => {
        const command = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
        addLog('CMD-VOICE', `"${command}"`, 'cmd');
        processCommand(command);
    };
    recognition.onerror = (event) => { setIsMicActive(false); addLog('SYSTEM', `Mic Error: ${event.error}`, 'alert'); };
    recognition.onend = () => { if (isMicActive) recognition.start(); };
    if (isMicActive) {
        try { recognition.start(); addLog('SYSTEM', 'MIC ACTIVATED. LISTENING...', 'safe'); } catch(e){}
    } else {
        recognition.stop(); addLog('SYSTEM', 'MIC DEACTIVATED.', 'warn');
    }
    return () => recognition.stop();
  }, [isMicActive]);

  const handleCliSubmit = (e) => {
      if (e.key === 'Enter' && cliInput.trim() !== '') {
          const cmd = cliInput.toLowerCase().trim();
          addLog('CMD-TEXT', `> ${cmd}`, 'cmd');
          processCommand(cmd);
          setCliInput('');
      }
  };

  const processCommand = (cmd) => {
      if (!priorityTargetId) {
          addLog('AI ADVISOR', 'No target locked! Click a target on the radar to designate first.', 'warn');
          return;
      }
      
      setContacts(prev => {
          let updated = [...prev];
          let targetIndex = updated.findIndex(c => c.id === priorityTargetId);
          if (targetIndex === -1) return prev;
          let target = updated[targetIndex];

          const distToStorm = Math.hypot(target.x - stormRef.current.x, target.y - stormRef.current.y);
          const inStorm = distToStorm < stormRef.current.radius;

          if (cmd.includes('warn')) {
              if (target.state === 'APPROACHING') {
                  updated[targetIndex] = { ...target, state: 'WARNED', warnTime: Date.now() };
                  addLog('RADAR TEAM', `Transmitting final warning to ${target.id}...`, 'warn');
              } else {
                  addLog('AI ADVISOR', `Target ${target.id} is already warned.`, 'info');
              }
          } 
          else if (cmd.includes('attack') || cmd.includes('send') || cmd.includes('fire')) {
              if (target.state === 'FLEEING') {
                  addLog('AI ADVISOR', 'ROE VIOLATION: Target retreating. DO NOT ENGAGE.', 'alert');
                  return updated;
              }
              if (target.displayIff === 'CIVILIAN') {
                  addLog('AI ADVISOR', 'ROE VIOLATION: Cannot attack civilian flights!', 'alert');
                  return updated;
              }

              let weaponType = null;
              if (cmd.includes('aircraft') || cmd.includes('jet')) weaponType = 'aircraft';
              else if (cmd.includes('drone')) weaponType = 'drones';
              else if (cmd.includes('tank') || cmd.includes('sam') || cmd.includes('missile')) weaponType = 'sams';

              if (!weaponType) {
                  addLog('AI ADVISOR', 'Weapon unknown. Type/Say: "attack by aircraft", "attack by drones", or "fire sam".', 'warn');
                  return updated;
              }

              setArsenal(prevArs => {
                  if (prevArs[weaponType] <= 0) {
                      addLog('AI ADVISOR', `Insufficient ${weaponType.toUpperCase()} in arsenal!`, 'alert');
                      return prevArs;
                  }
                  if (weaponType === 'drones' && inStorm) {
                      addLog('AI ADVISOR', 'WEATHER ALERT: Drones cannot operate in STORM CELL. Use Aircraft or SAMs.', 'alert');
                      return prevArs;
                  }
                  addLog('FIRE CONTROL', `${weaponType.toUpperCase()} deployed to intercept ${target.id}!`, 'safe');
                  launchWeapon(target, weaponType);
                  return { ...prevArs, [weaponType]: prevArs[weaponType] - 1 };
              });
              
              updated[targetIndex] = { ...target, state: 'ENGAGED' };
          }
          return updated;
      });
  };

  const launchWeapon = (target, type) => {
      let srcX = basePos.x, srcY = basePos.y;
      if (type === 'sams') {
          const bat = samBatteries[Math.floor(Math.random()*samBatteries.length)];
          srcX = bat.x; srcY = bat.y;
      }
      setInterceptors(prev => [...prev, {
          x: srcX, y: srcY, speed: type === 'aircraft' ? 25 : (type === 'drones' ? 12 : 20), 
          targetId: target.id, type: type
      }]);

      // NEW: NETWORK LOG WEAPON FIRE
      if(socketRef.current) socketRef.current.emit('fire_weapon', { targetId: target.id, weaponType: type });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleCanvasClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = logicalWidth / rect.width;
      const scaleY = logicalHeight / rect.height;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;

      let clickedId = null;
      contacts.forEach(c => {
        if (c.status === 'ACTIVE' && Math.hypot(c.x - mouseX, c.y - mouseY) < 30) clickedId = c.id;
      });

      if (clickedId) {
          setContacts(prev => prev.map(c => c.id === clickedId ? { ...c, displayIff: c.trueIff } : c));
          setPriorityTargetId(clickedId);
          addLog('SYSTEM', `Designated Priority Target: ${clickedId}. Awaiting Command.`, 'info');
      } else {
          setPriorityTargetId(null);
      }
    };
    canvas.addEventListener('click', handleCanvasClick);
    return () => canvas.removeEventListener('click', handleCanvasClick);
  }, [contacts]);

  // MAIN GAME LOOP 
  useEffect(() => {
    let animationFrameId;
    let lastTime = performance.now();

    const loop = (time) => {
      if (time - lastTime > 30) {
        lastTime = time;
        const sweepAngle = (Date.now() / 1500) % (Math.PI * 2);

        stormRef.current.x = basePos.x - 150 + Math.sin(Date.now() / 12000) * 250;
        stormRef.current.y = basePos.y - 100 + Math.cos(Date.now() / 18000) * 200;

        setContacts(prevContacts => {
          let updated = prevContacts.map(c => {
            if (c.status === 'DESTROYED') {
              if (c.deathTimer++ > 60) return spawnContact(radarMode === 'NAVY');
              return { ...c };
            }

            const dist = Math.hypot(c.x - basePos.x, c.y - basePos.y);
            if (dist < radarRadius && !c.autoIdentified) {
                if (!c.isStealth) {
                    setTimeout(() => {
                        if (c.trueIff === 'HOSTILE') addLog('AI ADVISOR', `HOSTILE DETECTED: ${c.type} approaching at ${Math.floor(c.speed*200)} KTS (Hdg ${Math.floor(c.hdg)}°).`, 'alert');
                        else addLog('SYSTEM', `CIVILIAN TRAFFIC LOGGED: ${c.type}. Safe.`, 'safe');
                    }, 0);
                    return { ...c, autoIdentified: true, displayIff: c.trueIff };
                } else {
                    setTimeout(() => addLog('AI ADVISOR', `WARNING: Unknown Radar Anomaly detected. Stealth suspected. Manual lock required!`, 'warn'), 0);
                    return { ...c, autoIdentified: true }; 
                }
            }

            if (c.state === 'WARNED' && Date.now() - c.warnTime > 3000) {
                const willFlee = c.trueIff === 'CIVILIAN' || Math.random() > 0.7;
                if (willFlee) {
                    addLog('RADAR TEAM', `${c.id} is complying and retreating.`, 'safe');
                    const fleeAngle = Math.atan2(c.y - basePos.y, c.x - basePos.x); 
                    return { ...c, state: 'FLEEING', vx: Math.cos(fleeAngle) * (c.speed+0.5), vy: Math.sin(fleeAngle) * (c.speed+0.5), hdg: (fleeAngle * 180/Math.PI + 90)%360 };
                } else {
                    addLog('RADAR TEAM', `${c.id} ignoring warnings! Target is HOSTILE.`, 'alert');
                    return { ...c, state: 'APPROACHING', displayIff: 'HOSTILE' }; 
                }
            }

            let newX = c.x + c.vx, newY = c.y + c.vy;
            if (Math.hypot(newX - basePos.x, newY - basePos.y) > 900) {
                if (c.state === 'FLEEING') setTimeout(() => addLog('SYSTEM', `ENEMY CLEAR. ${c.id} has left the airspace.`, 'safe'), 0);
                return spawnContact(radarMode === 'NAVY');
            }
            return { ...c, x: newX, y: newY };
          });

          setInterceptors(prevInt => prevInt.map(inter => {
              let t = updated.find(c => c.id === inter.targetId && c.status === 'ACTIVE');
              if (!t) return null;
              const dist = Math.hypot(t.x - inter.x, t.y - inter.y);
              if (dist < 20) {
                  updated = updated.map(c => c.id === t.id ? { ...c, status: 'DESTROYED', vx: 0, vy: 0 } : c);
                  setExplosions(ex => [...ex, { x: t.x, y: t.y, life: 20 }]);
                  setScore(s => s + (t.trueIff === 'CIVILIAN' ? -1000 : 200));
                  setTimeout(() => addLog('RADAR TEAM', `TARGET DESTROYED. Good kill on ${t.id}.`, 'safe'), 0);
                  
                  // NEW: SEND KILL LOG TO DATABASE!
                  if(socketRef.current) {
                      socketRef.current.emit('target_destroyed', { targetId: t.id, weaponType: inter.type });
                  }
                  
                  return null;
              }
              return { ...inter, x: inter.x + ((t.x - inter.x)/dist)*inter.speed, y: inter.y + ((t.y - inter.y)/dist)*inter.speed };
          }).filter(Boolean));

          return updated;
        });
        setExplosions(prev => prev.map(e => ({ ...e, life: e.life - 1 })).filter(e => e.life > 0));
      }

      // --- DRAW RADAR ---
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const cx = basePos.x, cy = basePos.y; 
        const sweepAngle = (Date.now() / 1500) % (Math.PI * 2);

        ctx.save(); ctx.scale(1, 1); 
        ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, logicalWidth, logicalHeight);

        ctx.beginPath();
        ctx.moveTo(cx - 400, cy - 500); ctx.bezierCurveTo(cx-200, cy-100, cx+100, cy+200, cx+500, cy-100);
        ctx.lineTo(cx+500, cy+500); ctx.lineTo(cx-500, cy+500); ctx.closePath();
        ctx.fillStyle = 'rgba(20, 83, 45, 0.1)'; ctx.fill(); ctx.strokeStyle = 'rgba(34, 197, 94, 0.15)'; ctx.stroke();

        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, radarRadius, 0, Math.PI*2); ctx.clip();
        ctx.fillStyle = 'rgba(1, 28, 9, 0.4)'; ctx.fill();
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.3)';
        for (let r=80; r<=radarRadius; r+=80) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke(); }
        for (let i=0; i<360; i+=30) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx+Math.cos(i*Math.PI/180)*radarRadius, cy+Math.sin(i*Math.PI/180)*radarRadius); ctx.stroke(); }
        
        ctx.beginPath(); ctx.arc(stormRef.current.x, stormRef.current.y, stormRef.current.radius, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(148, 163, 184, 0.1)'; ctx.fill(); ctx.setLineDash([10,10]); ctx.stroke(); ctx.setLineDash([]);

        const grad = ctx.createConicGradient(sweepAngle - Math.PI/2, cx, cy);
        grad.addColorStop(0, 'rgba(74, 222, 128, 0.6)'); grad.addColorStop(0.1, 'rgba(34, 197, 94, 0.1)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(cx, cy, radarRadius, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx+Math.cos(sweepAngle)*radarRadius, cy+Math.sin(sweepAngle)*radarRadius); ctx.strokeStyle = '#ffffff'; ctx.stroke();
        ctx.restore();

        ctx.fillStyle='#38bdf8'; ctx.font='bold 12px monospace'; ctx.fillText('HQ', cx-10, cy+20);
        samBatteries.forEach(b => { ctx.fillStyle='rgba(74,222,128,0.3)'; ctx.fillRect(b.x-6, b.y-6, 12, 12); ctx.strokeStyle='#4ade80'; ctx.strokeRect(b.x-6, b.y-6, 12, 12); });

        contacts.forEach(c => {
            if (Math.hypot(c.x-cx, c.y-cy) > radarRadius) return;
            const isActive = c.status === 'ACTIVE';
            const inStorm = Math.hypot(c.x-stormRef.current.x, c.y-stormRef.current.y) < stormRef.current.radius;
            const isJamming = (c.isStealth && c.displayIff === 'UNKNOWN') || inStorm;
            const isLocked = priorityTargetId === c.id;

            let col = c.displayIff==='HOSTILE' ? '#ef4444' : (c.displayIff==='CIVILIAN' ? '#22d3ee' : '#facc15');
            if (isJamming && !isLocked) col = '#a1a1aa';

            ctx.save();
            ctx.translate(isJamming && !isLocked ? c.x+(Math.random()*6-3) : c.x, isJamming && !isLocked ? c.y+(Math.random()*6-3) : c.y);
            
            if (isActive) {
                if (isLocked) { ctx.rotate(Date.now()/500); ctx.strokeStyle='#fff'; ctx.strokeRect(-12,-12,24,24); ctx.rotate(-Date.now()/500); }
                ctx.beginPath(); ctx.arc(0,0,6,0,Math.PI*2); ctx.strokeStyle=col; ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(c.vx*10, c.vy*10); ctx.stroke(); 
                
                let label = c.id;
                if (c.state === 'WARNED') label = '[WARNED]';
                if (c.state === 'FLEEING') label = '<< FLEEING';
                if (c.state === 'ENGAGED') label = '!! ENGAGED !!';
                
                ctx.fillStyle=col; ctx.fillText(label, 15, -15);
                ctx.fillStyle='#94a3b8'; ctx.fillText(`HDG:${Math.floor(c.hdg)} SPD:${Math.floor(c.speed*200)}`, 15, 0);
            } else {
                ctx.fillStyle='#475569'; ctx.fillText('SPLASH', 10, 0);
            }
            ctx.restore();
        });

        interceptors.forEach(i => { ctx.beginPath(); ctx.arc(i.x, i.y, 3, 0, Math.PI*2); ctx.fillStyle= i.type==='aircraft'?'#38bdf8':'#f97316'; ctx.fill(); });
        explosions.forEach(e => { ctx.beginPath(); ctx.arc(e.x, e.y, (20-e.life)*4, 0, Math.PI*2); ctx.fillStyle=`rgba(239,68,68,${e.life/20})`; ctx.fill(); });
        
        ctx.fillStyle='#94a3b8'; ctx.fillText(`WX: STORM CELL`, stormRef.current.x-40, stormRef.current.y);
        ctx.restore();
      }
      animationFrameId = requestAnimationFrame(loop);
    };
    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [contacts, priorityTargetId, interceptors, arsenal]); 

  const activeTarget = contacts.find(c => c.id === priorityTargetId);

  return (
    <div style={{ backgroundColor: '#020617', color: 'white', height: '100vh', width: '100vw', padding: '10px', boxSizing: 'border-box', overflow: 'hidden', fontFamily: '"Courier New", monospace', display: 'flex', flexDirection: 'column' }}>
      
      {/* HEADER */}
      <header style={{ height: '40px', borderBottom: '1px solid #38bdf8', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <h1 style={{ color: '#38bdf8', margin: 0, fontSize: '20px' }}>C4ISR // COMMAND TERMINAL</h1>
        <div style={{ color: '#4ade80', fontSize: '12px', border: '1px solid #4ade80', padding: '4px 8px', borderRadius: '4px' }}>LINK: SECURE</div>
      </header>

      {/* MAIN RADAR ROW */}
      <div style={{ display: 'flex', gap: '10px', flex: 1, minHeight: 0 }}>
        
        <div style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ backgroundColor: '#0f172a', padding: '10px', borderRadius: '8px', border: '1px solid #334155' }}>
            <button onClick={() => {
                const newMode = radarMode==='AIR'?'NAVY':'AIR';
                setRadarMode(newMode);
                if(socketRef.current) socketRef.current.emit('join_role', newMode + ' COMMANDER');
            }} style={{ width: '100%', padding: '8px', marginBottom: '8px', backgroundColor: radarMode === 'NAVY' ? '#082f49' : '#022c11', color: radarMode === 'NAVY' ? '#7dd3fc' : '#86efac', border: `1px solid ${radarMode === 'NAVY' ? '#0ea5e9' : '#22c55e'}`, cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
              {radarMode === 'AIR' ? '✈️ AIR RADAR' : '🌊 NAVAL SONAR'}
            </button>
            <button onClick={() => window.location.reload()} style={{ width: '100%', padding: '8px', backgroundColor: '#1e293b', color: '#cbd5e1', border: '1px solid #475569', cursor: 'pointer', fontSize: '11px' }}>REBOOT SYSTEM</button>
          </div>
          <div style={{ flex: 1, backgroundColor: 'rgba(34, 211, 238, 0.1)', border: '1px solid #0891b2', padding: '10px', borderRadius: '8px', fontSize: '11px', color: '#94a3b8', lineHeight: '1.5' }}>
             <strong style={{color:'#22d3ee'}}>COMMANDS INFO:</strong><br/><br/>
             1. Click target to Lock.<br/>
             2. Use Mic or Text Box to issue commands:<br/>
             <span style={{color:'#fff'}}>- "Warn target"</span><br/>
             <span style={{color:'#fff'}}>- "Attack by aircraft"</span><br/>
             <span style={{color:'#fff'}}>- "Attack by drones"</span><br/>
             <span style={{color:'#fff'}}>- "Fire sam / tanks"</span>
          </div>
        </div>

        <div style={{ flex: 1, position: 'relative', border: '3px solid #334155', borderRadius: '8px', backgroundColor: '#000', overflow: 'hidden' }}>
          <canvas ref={canvasRef} width={logicalWidth} height={logicalHeight} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', cursor: priorityTargetId ? 'crosshair' : 'crosshair' }} />
        </div>

        <div style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ backgroundColor: '#0f172a', padding: '10px', border: '1px solid #1e293b', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ color: '#38bdf8', fontSize: '11px', fontWeight: 'bold' }}>SCORE</div>
            <div style={{ fontSize: '24px', color: '#4ade80', fontWeight: 'bold' }}>{score}</div>
          </div>

          <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '10px' }}>
              <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 'bold', marginBottom: '8px' }}>🛡️ ARSENAL</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', textAlign: 'center', fontSize: '11px' }}>
                  <div style={{ backgroundColor: '#1e293b', padding: '5px', borderRadius: '4px', flex: 1, marginRight: '5px' }}>
                      <div style={{ color: '#38bdf8' }}>JETS</div><div style={{ fontWeight: 'bold', fontSize:'14px' }}>{arsenal.aircraft}</div>
                  </div>
                  <div style={{ backgroundColor: '#1e293b', padding: '5px', borderRadius: '4px', flex: 1, marginRight: '5px' }}>
                      <div style={{ color: '#facc15' }}>DRONE</div><div style={{ fontWeight: 'bold', fontSize:'14px' }}>{arsenal.drones}</div>
                  </div>
                  <div style={{ backgroundColor: '#1e293b', padding: '5px', borderRadius: '4px', flex: 1 }}>
                      <div style={{ color: '#ef4444' }}>SAM</div><div style={{ fontWeight: 'bold', fontSize:'14px' }}>{arsenal.sams}</div>
                  </div>
              </div>
          </div>

          <div style={{ flex: 1, backgroundColor: '#1e1b4b', border: '1px solid #6366f1', borderRadius: '8px', padding: '10px', overflowY: 'auto' }}>
              <div style={{ color: '#818cf8', fontSize: '11px', fontWeight: 'bold', borderBottom: '1px solid #4338ca', paddingBottom: '5px', marginBottom: '8px' }}>🎯 TARGET DOSSIER</div>
              {activeTarget ? (
                  <div style={{ fontSize: '11px', lineHeight: '1.8' }}>
                      <div style={{ color: '#c7d2fe' }}>ID: <span style={{ color: '#fff', fontWeight:'bold' }}>{activeTarget.id}</span></div>
                      <div style={{ color: '#c7d2fe' }}>TYPE: <span style={{ color: '#fff', fontWeight:'bold' }}>{activeTarget.type}</span></div>
                      <div style={{ color: '#c7d2fe' }}>STATUS: <span style={{ color: activeTarget.state==='WARNED'?'#facc15':'#fff', fontWeight:'bold' }}>{activeTarget.state}</span></div>
                      <div style={{ color: '#c7d2fe' }}>SPEED: <span style={{ color: '#fff', fontWeight:'bold' }}>{Math.floor(activeTarget.speed*200)} KTS</span></div>
                      <div style={{ color: '#c7d2fe' }}>WX: <span style={{ color: '#fff', fontWeight:'bold' }}>{Math.hypot(activeTarget.x-stormRef.current.x, activeTarget.y-stormRef.current.y) < stormRef.current.radius ? 'IN STORM' : 'CLEAR'}</span></div>
                  </div>
              ) : (
                  <div style={{ color: '#6366f1', textAlign: 'center', marginTop: '20px', fontStyle: 'italic', fontSize: '11px' }}>CLICK RADAR CONTACT</div>
              )}
          </div>
        </div>
      </div>

      {/* BOTTOM LOG & COMMAND LINE */}
      <div style={{ height: '200px', backgroundColor: '#081229', border: '1px solid #3b82f6', borderRadius: '8px', marginTop: '10px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ flex: 1, padding: '10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
              {logs.map((log, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', lineHeight: '1.4' }}>
                      <span style={{ color: '#475569', minWidth: '60px' }}>[{log.time}]</span>
                      <span style={{ color: log.sender.includes('AI') ? '#c084fc' : (log.sender.includes('CMD') ? '#fcd34d' : '#38bdf8'), fontWeight: 'bold', minWidth: '100px' }}>{log.sender}:</span>
                      <span style={{ color: log.type === 'alert' ? '#ef4444' : (log.type === 'warn' ? '#facc15' : (log.type === 'cmd' ? '#fff' : (log.type === 'safe' ? '#4ade80' : '#cbd5e1'))) }}>{log.text}</span>
                  </div>
              ))}
              <div ref={logsEndRef} /> 
          </div>

          <div style={{ borderTop: '1px solid #3b82f6', display: 'flex', padding: '8px', backgroundColor: '#020617' }}>
              <button onClick={() => setIsMicActive(!isMicActive)} style={{ backgroundColor: isMicActive ? '#ef4444' : '#1e3a8a', color: '#fff', padding: '6px 12px', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', marginRight: '10px' }}>
                  {isMicActive ? '🔴 MIC LIVE' : '🎙️ MIC OFF'}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', flex: 1, backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '4px', padding: '0 10px' }}>
                  <span style={{ color: '#22d3ee', fontWeight: 'bold', marginRight: '8px' }}>&gt;</span>
                  <input 
                      type="text" 
                      value={cliInput}
                      onChange={(e) => setCliInput(e.target.value)}
                      onKeyDown={handleCliSubmit}
                      placeholder="Type tactical command here and press Enter..."
                      style={{ flex: 1, backgroundColor: 'transparent', border: 'none', color: '#fff', fontSize: '12px', outline: 'none', fontFamily: '"Courier New", monospace' }}
                  />
              </div>
          </div>
      </div>

    </div>
  );
}