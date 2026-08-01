import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Shield, Activity } from 'lucide-react';

export default function App() {
  const canvasRef = useRef(null);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState('PEACE'); // 'WAR' or 'PEACE'
  
  // Agent States
  const [agents, setAgents] = useState({
    ownShip: { x: 100, y: 250, vx: 2, vy: 1, type: 'AIR' }, // Blue
    enemyAgent: { x: 400, y: 250, vx: -1, vy: -1, type: 'AIR' }, // Red (AI)
  });

  const [aiScore, setAiScore] = useState(0);
  const [distance, setDistance] = useState(0);

  // Simulation Loop
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setAgents((prev) => {
        let newOwnX = prev.ownShip.x + prev.ownShip.vx;
        let newOwnY = prev.ownShip.y + prev.ownShip.vy;

        // Simple Boundary Check for Own Ship
        if (newOwnX > 580 || newOwnX < 20) prev.ownShip.vx *= -1;
        if (newOwnY > 380 || newOwnY < 20) prev.ownShip.vy *= -1;

        // Simple RL AI Behavior Logic (Enemy tracks or evades Own Ship)
        let dx = newOwnX - prev.enemyAgent.x;
        let dy = newOwnY - prev.enemyAgent.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        
        setDistance(Math.round(dist));

        let enemyVx = prev.enemyAgent.vx;
        let enemyVy = prev.enemyAgent.vy;

        if (mode === 'WAR') {
          // Attack Mode: Move towards Own Ship
          enemyVx = dx > 0 ? 1.5 : -1.5;
          enemyVy = dy > 0 ? 1.5 : -1.5;
          setAiScore((s) => s + (dist < 100 ? 10 : -1));
        } else {
          // Peace Patrol Mode: Maintain Distance & Patrol
          enemyVx = dx > 0 ? -1 : 1;
          enemyVy = dy > 0 ? -1 : 1;
          setAiScore((s) => s + 1);
        }

        let newEnemyX = prev.enemyAgent.x + enemyVx;
        let newEnemyY = prev.enemyAgent.y + enemyVy;

        // Boundary Check for Enemy
        if (newEnemyX > 580 || newEnemyX < 20) enemyVx *= -1;
        if (newEnemyY > 380 || newEnemyY < 20) enemyVy *= -1;

        return {
          ownShip: { ...prev.ownShip, x: newOwnX, y: newOwnY, vx: prev.ownShip.vx, vy: prev.ownShip.vy },
          enemyAgent: { ...prev.enemyAgent, x: newEnemyX, y: newEnemyY, vx: enemyVx, vy: enemyVy },
        };
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isRunning, mode]);

  // Render Agents on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Clear Canvas Grid background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Grid Lines (Radar effect)
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let j = 0; j < canvas.height; j += 40) {
      ctx.beginPath();
      ctx.moveTo(0, j);
      ctx.lineTo(canvas.width, j);
      ctx.stroke();
    }

    // Draw Own Agent (Blue Jet / Ship)
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(agents.ownShip.x, agents.ownShip.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#60a5fa';
    ctx.fillText('Own Jet (Manned)', agents.ownShip.x - 30, agents.ownShip.y - 15);

    // Draw AI Enemy Agent (Red Target)
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(agents.enemyAgent.x, agents.enemyAgent.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f87171';
    ctx.fillText('AI Agent (RL Trained)', agents.enemyAgent.x - 35, agents.enemyAgent.y - 15);

  }, [agents]);

  const resetSimulation = () => {
    setIsRunning(false);
    setAgents({
      ownShip: { x: 100, y: 250, vx: 2, vy: 1, type: 'AIR' },
      enemyAgent: { x: 400, y: 250, vx: -1, vy: -1, type: 'AIR' },
    });
    setAiScore(0);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', backgroundColor: '#020617', color: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '15px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', color: '#38bdf8' }}>DRDO Tactical Scenario Simulator</h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8' }}>Reinforcement Learning Based Agent Simulation</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => setMode(mode === 'PEACE' ? 'WAR' : 'PEACE')}
            style={{ backgroundColor: mode === 'WAR' ? '#b91c1c' : '#15803d', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
            Scenario: {mode} MODE
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
        
        {/* Left Side: 2D Tactical Screen */}
        <div style={{ flex: 2, backgroundColor: '#0f172a', borderRadius: '8px', padding: '15px', border: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Shield size={18} color="#38bdf8" /> 2D Tactical Arena (Air/Sea/Ground)
            </span>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setIsRunning(!isRunning)} style={{ backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                {isRunning ? <Pause size={16} /> : <Play size={16} />} {isRunning ? 'Pause' : 'Start AI'}
              </button>
              <button onClick={resetSimulation} style={{ backgroundColor: '#475569', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <RotateCcw size={16} /> Reset
              </button>
            </div>
          </div>
          <canvas ref={canvasRef} width={600} height={400} style={{ borderRadius: '6px', border: '1px solid #334155', display: 'block', margin: '0 auto' }} />
        </div>

        {/* Right Side: AI Analytics Dashboard */}
        <div style={{ flex: 1, backgroundColor: '#0f172a', borderRadius: '8px', padding: '15px', border: '1px solid #1e293b' }}>
          <h3 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #334155', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity color="#a855f7" /> AI Training Metrics
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ backgroundColor: '#1e293b', padding: '12px', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Cumulative AI Reward Score</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: aiScore >= 0 ? '#4ade80' : '#f87171' }}>{aiScore} pts</div>
            </div>

            <div style={{ backgroundColor: '#1e293b', padding: '12px', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Agent Proximity Distance</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#facc15' }}>{distance} units</div>
            </div>

            <div style={{ backgroundColor: '#1e293b', padding: '12px', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>AI Action Strategy</div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#38bdf8', marginTop: '4px' }}>
                {mode === 'WAR' ? 'Intercept & Target Engagement' : 'Patrol & Border Maintenance'}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}