import React, { useEffect, useState, useMemo } from 'react';

export const DataLensVisualizer: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Generate random data ONCE so it doesn't jump/reset on parent re-renders
  const messyItems = useMemo(() => Array.from({ length: 45 }).map(() => {
    const texts = ['NaN', 'Null', '?', 'Missing', 'Outlier', 'err: 0x9A', 'Noise', 'undefined', 'DROP', '0', '-1'];
    return {
      left: Math.random() * 100,
      top: Math.random() * 100,
      delay: Math.random() * 5,
      text: texts[Math.floor(Math.random() * texts.length)],
      size: Math.random() * 0.5 + 0.7,
      duration: Math.random() * 3 + 3,
    };
  }), []);

  const cleanNodes = useMemo(() => Array.from({ length: 30 }).map(() => {
    const isTeal = Math.random() > 0.5;
    return {
      left: Math.random() * 90 + 5,
      top: Math.random() * 90 + 5,
      color: isTeal ? '#22d3ee' : '#4ade80',
      glowColor: isTeal ? 'rgba(34,211,238,0.6)' : 'rgba(74,222,128,0.6)',
      delay: Math.random() * 2,
      lineWidth: Math.random() * 120 + 40,
      rotation: Math.random() * 360,
    };
  }), []);

  const cleanTexts = useMemo(() => Array.from({ length: 20 }).map(() => {
    const texts = ['ACCURACY: 98.4%', 'SMOTE: APPLIED', 'F1: 0.96', 'CLEAN DATA', 'PREDICT: TRUE', 'NORMALIZED', 'RANDOM_FOREST', 'SHAP_VALUE'];
    return {
      left: Math.random() * 90 + 5,
      top: Math.random() * 90 + 5,
      text: texts[Math.floor(Math.random() * texts.length)],
      color: Math.random() > 0.5 ? '#22d3ee' : '#4ade80',
    };
  }), []);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden transition-colors duration-500 bg-transparent">
      <style>
        {`
          @keyframes scanner-clip {
            0%   { clip-path: circle(130px at 20% 20%); }
            25%  { clip-path: circle(130px at 80% 30%); }
            50%  { clip-path: circle(130px at 70% 80%); }
            75%  { clip-path: circle(130px at 30% 70%); }
            100% { clip-path: circle(130px at 20% 20%); }
          }
          
          @keyframes scanner-ring {
            0%   { top: 20%; left: 20%; }
            25%  { top: 30%; left: 80%; }
            50%  { top: 80%; left: 70%; }
            75%  { top: 70%; left: 30%; }
            100% { top: 20%; left: 20%; }
          }

          @keyframes pulse-ring {
            0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
            50% { transform: translate(-50%, -50%) scale(1.03); opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
          }

          @keyframes data-float {
            0% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-15px) rotate(3deg); }
            100% { transform: translateY(0px) rotate(0deg); }
          }

          @keyframes node-pulse {
            0% { transform: scale(0.8); opacity: 0.6; }
            100% { transform: scale(1.2); opacity: 1; }
          }

          .messy-layer {
            position: absolute;
            inset: 0;
            background-color: transparent;
          }

          .clean-layer {
            position: absolute;
            inset: 0;
            background-color: #040b16;
            background-image: radial-gradient(ellipse at center, rgba(16,185,129,0.15) 0%, transparent 80%);
            animation: scanner-clip 20s infinite ease-in-out;
            z-index: 10;
          }

          .lens-ring {
            position: absolute;
            width: 260px;
            height: 260px;
            border-radius: 50%;
            border: 2px solid rgba(34, 211, 238, 0.8);
            box-shadow: 
              inset 0 0 25px rgba(34, 211, 238, 0.4),
              0 0 80px rgba(74, 222, 128, 0.3);
            animation: 
              scanner-ring 20s infinite ease-in-out,
              pulse-ring 3s infinite ease-in-out;
            transform: translate(-50%, -50%);
            z-index: 20;
            pointer-events: none;
            backdrop-filter: blur(1px) brightness(1.2);
          }

          .lens-crosshair {
            position: absolute;
            inset: 8px;
            border-radius: 50%;
            border: 1px dashed rgba(74, 222, 128, 0.4);
            animation: spin-slow 15s linear infinite;
          }

          @keyframes spin-slow {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          .clean-node {
            position: absolute;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            transform: translate(-50%, -50%);
            animation: node-pulse 2s infinite alternate;
          }
          
          .clean-line {
            position: absolute;
            height: 1.5px;
            transform-origin: left center;
            opacity: 0.7;
          }
        `}
      </style>

      {/* 1. MESSY LAYER (Background) */}
      <div className="messy-layer">
        {/* Background Grid - Adaptive to theme */}
        <div 
          className="absolute inset-0 opacity-[0.04] dark:opacity-[0.08]" 
          style={{ 
            backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)', 
            backgroundSize: '30px 30px' 
          }}
        ></div>
        
        {/* Messy floating text/data */}
        {mounted && messyItems.map((item, i) => (
          <div
            key={'messy-' + i}
            className="absolute font-mono font-bold select-none opacity-40"
            style={{
              color: 'var(--text2)',
              left: item.left + '%',
              top: item.top + '%',
              fontSize: item.size + 'rem',
              animation: 'data-float ' + item.duration + 's ease-in-out ' + item.delay + 's infinite alternate',
            }}
          >
            {item.text}
          </div>
        ))}
      </div>

      {/* 2. CLEAN LAYER (Revealed exclusively inside the Lens) */}
      <div className="clean-layer">
        {/* Clean Tech Grid */}
        <div 
          className="absolute inset-0 opacity-[0.1]" 
          style={{ 
            backgroundImage: 'linear-gradient(rgba(34, 211, 238, 1) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 211, 238, 1) 1px, transparent 1px)', 
            backgroundSize: '40px 40px' 
          }}
        ></div>

        {/* Scattered ML Nodes and Network Lines */}
        {mounted && cleanNodes.map((node, i) => (
          <div key={'node-'+i}>
            <div 
              className="clean-node" 
              style={{ 
                left: node.left + '%', 
                top: node.top + '%', 
                background: node.color,
                boxShadow: '0 0 15px 4px ' + node.glowColor,
                animationDelay: node.delay + 's'
              }}
            ></div>
            {/* Line shooting out from the node */}
            <div 
              className="clean-line" 
              style={{ 
                left: node.left + '%', 
                top: node.top + '%', 
                width: node.lineWidth + 'px', 
                transform: 'rotate(' + node.rotation + 'deg)',
                background: 'linear-gradient(90deg, ' + node.color + ', transparent)'
              }}
            ></div>
          </div>
        ))}

        {/* Clean floating text/metrics */}
        {mounted && cleanTexts.map((item, i) => (
          <div
            key={'clean-text-' + i}
            className="absolute font-mono font-bold tracking-widest text-[11px] select-none"
            style={{
              left: item.left + '%',
              top: item.top + '%',
              color: item.color,
              textShadow: '0 0 10px ' + item.color,
            }}
          >
            {item.text}
          </div>
        ))}
      </div>

      {/* 3. LENS RING (Physical glass ring that follows the clip-path scanner) */}
      <div className="lens-ring">
        <div className="lens-crosshair"></div>
        {/* Scanning laser line moving up and down inside the lens */}
        <div 
          className="absolute left-[10%] right-[10%] h-[2px] bg-[#22d3ee] opacity-70"
          style={{
            top: '50%',
            boxShadow: '0 0 12px 2px #22d3ee',
            animation: 'scan-laser 2.5s ease-in-out infinite alternate'
          }}
        ></div>
        <style>
          {`
            @keyframes scan-laser {
              0% { top: 15%; opacity: 0; }
              20% { opacity: 0.8; }
              80% { opacity: 0.8; }
              100% { top: 85%; opacity: 0; }
            }
          `}
        </style>
      </div>

    </div>
  );
};
