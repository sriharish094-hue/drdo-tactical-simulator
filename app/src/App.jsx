import React, { useState, useEffect, useRef } from 'react';

export default function App() {
  const canvasRef = useRef(null);
  const [isAIActive, setIsAIActive] = useState(false);
  const [mode, setMode] = useState('PEACE');
  const [score, setScore] = useState(0);
  const [distance, setDistance] = useState(0);

  // Initial positions
  const [agents, setAgents] = useState({
    ownShip: { x: 150, y: 350 },
    enemyAgent: { x: 650, y: 150 }
  });

  // Canvas drawing logic
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Clear canvas (black radar background)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Grid (Radar lines)
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 50) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }

    // Draw Own Agent (Blue Jet Emoji)
    ctx.font = '24px Arial';
    ctx.fillText('✈️', agents.ownShip.x - 12, agents.ownShip.y + 8);
    ctx.fillStyle = '#60a5fa';
    ctx.font = '12px sans-serif';
    ctx.fillText('Own Jet (Manned)', agents.ownShip.x - 45, agents.ownShip.y - 15);

    // Draw AI Enemy Agent (Red Drone Emoji)
    ctx.font = '24px Arial';
    ctx.fillText('🛸', agents.enemyAgent.x - 12, agents.enemyAgent.y + 8);
    ctx.fillStyle = '#f87171';
    ctx.font = '12px sans-serif';
    ctx.fillText('AI Agent (RL Trained)', agents.enemyAgent.x - 50, agents.enemyAgent.y - 15);

  }, [agents]);

  // AI Movement Logic (Target pursuit math)
  useEffect(() => {
    let animationFrameId;
    
    const updatePositions = () => {
      if (isAIActive) {
        setAgents(prev => {
          const dx = prev.ownShip.x - prev.enemyAgent.x;
          const dy = prev.ownShip.y - prev.enemyAgent.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          setDistance(Math.floor(dist));
          
          // AI speed changes based on WAR or PEACE mode
          const speed = mode === 'WAR' ? 2 : 0.5;

          if (dist > 10) {
            return {
              ...prev,
              enemyAgent: {
                x: prev.enemyAgent.x + (dx / dist) * speed,
                y: prev.enemyAgent.y + (dy / dist) * speed
              }
            };
          }
          return prev;
        });
        setScore(prev => prev + 1);
      }
      animationFrameId = requestAnimationFrame(updatePositions);
    };

    if (isAIActive) {
      animationFrameId = requestAnimationFrame(updatePositions);
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [isAIActive, mode]);

  // User click to move Own Jet
  const handleCanvasClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setAgents(prev => ({ ...prev, ownShip: { x, y } }));
  };

  return (
    <div style={{ backgroundColor: '#020617', color: 'white', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ borderBottom: '1px solid #334155', paddingBottom: '10px', marginBottom: '20px' }}>
        <h1 style={{ color: '#38bdf8', margin: 0 }}>DRDO Tactical Simulator</h1>
        <p style={{ color: '#94a3b8', margin: '5px 0 0 0' }}>Phase 2: Visual Upgrade & AI Tracking Active</p>
      </header>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 auto' }}>
          <div style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => setIsAIActive(!isAIActive)}
              style={{ padding: '10px 20px', backgroundColor: isAIActive ? '#ef4444' : '#22c55e', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              {isAIActive ? '🛑 Stop AI' : '▶️ Start AI'}
            </button>
            <button 
              onClick={() => setMode(mode === 'PEACE' ? 'WAR' : 'PEACE')}
              style={{ padding: '10px 20px', backgroundColor: '#eab308', color: 'black', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Scenario MODE: {mode}
            </button>
          </div>

          <div style={{ border: '2px solid #334155', borderRadius: '8px', overflow: 'hidden', display: 'inline-block', backgroundColor: 'black' }}>
            <canvas 
              ref={canvasRef} 
              width={800} 
              height={500} 
              onClick={handleCanvasClick}
              style={{ cursor: 'crosshair', display: 'block', maxWidth: '100%' }}
            />
          </div>
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>* Click anywhere on the radar grid to move your Jet (✈️).</p>
        </div>

        <div style={{ width: '300px', backgroundColor: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px solid #334155', height: 'fit-content' }}>
          <h2 style={{ color: '#38bdf8', fontSize: '18px', marginTop: 0 }}>📊 AI Training Metrics</h2>
          <hr style={{ borderColor: '#334155', marginBottom: '15px' }} />
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ color: '#94a3b8', display: 'block', marginBottom: '5px' }}>Distance to Target:</label>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: distance < 50 ? '#ef4444' : '#22c55e' }}>
              {distance} meters
            </div>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ color: '#94a3b8', display: 'block', marginBottom: '5px' }}>Tracking Score (Frames):</label>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#eab308' }}>
              {score}
            </div>
          </div>

          <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#1e293b', borderRadius: '5px' }}>
            <h3 style={{ color: 'white', fontSize: '14px', marginTop: 0 }}>System Status:</h3>
            <ul style={{ color: '#94a3b8', fontSize: '14px', paddingLeft: '20px', margin: 0 }}>
              <li>Visuals: Emojis Active</li>
              <li>AI Logic: Pursuit Mode</li>
              <li>Status: Online</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}