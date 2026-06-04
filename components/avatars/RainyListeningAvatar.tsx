import React from 'react';

export default function RainyListeningAvatar() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full drop-shadow-[0_0_15px_rgba(96,165,250,0.3)]">
      <defs>
        <radialGradient id="blueGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.7" />
          <stop offset="60%" stopColor="#1e3a8a" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#030712" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cloudGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="50" fill="#060b18" stroke="rgba(96,165,250,0.15)" strokeWidth="1.5" />
      <circle cx="60" cy="60" r="50" fill="url(#blueGlow)" />
      <circle cx="60" cy="68" r="35" fill="none" stroke="rgba(96, 165, 250, 0.15)" strokeWidth="1.5" />
      <circle cx="60" cy="68" r="22" fill="none" stroke="rgba(52, 211, 153, 0.2)" strokeWidth="1" />
      <path d="M 46,40 Q 36,40 38,50 Q 32,54 38,62 L 82,62 Q 88,54 82,48 Q 80,40 70,42 Q 62,34 46,40 Z" fill="url(#cloudGrad)" />
      <g stroke="#60a5fa" strokeWidth="2" strokeLinecap="round">
        <line x1="42" y1="68" x2="40" y2="76" opacity="0.6" />
        <line x1="52" y1="70" x2="50" y2="78" />
        <line x1="62" y1="68" x2="60" y2="76" opacity="0.6" />
        <line x1="72" y1="70" x2="70" y2="78" />
      </g>
      <path d="M 60,86 C 58,82 54,80 54,80 C 54,80 50,82 52,86 L 60,92 L 68,86 C 70,82 66,80 66,80 C 66,80 62,82 60,86 Z" fill="#34d399" />
    </svg>
  );
}
