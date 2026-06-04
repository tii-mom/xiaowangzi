import React from 'react';

export default function MorningSunshineAvatar() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full drop-shadow-[0_0_20px_rgba(252,211,77,0.35)]">
      <defs>
        <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fcd34d" stopOpacity="0.8" />
          <stop offset="40%" stopColor="#f59e0b" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#0c0a09" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sunRayGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#fbbf24" opacity="0.1" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="50" fill="#0c0a09" stroke="rgba(252,211,77,0.2)" strokeWidth="1.5" />
      <circle cx="60" cy="60" r="50" fill="url(#sunGlow)" />
      <line x1="60" y1="20" x2="60" y2="100" stroke="url(#sunRayGrad)" strokeWidth="1.5" />
      <line x1="20" y1="60" x2="100" y2="60" stroke="url(#sunRayGrad)" strokeWidth="1.5" />
      <line x1="32" y1="32" x2="88" y2="88" stroke="url(#sunRayGrad)" strokeWidth="1" opacity="0.6" />
      <line x1="32" y1="88" x2="88" y2="32" stroke="url(#sunRayGrad)" strokeWidth="1" opacity="0.6" />
      <circle cx="60" cy="60" r="25" fill="none" stroke="#fcd34d" strokeWidth="1.5" />
      <circle cx="60" cy="60" r="14" fill="#fcd34d" />
      <polygon points="60,32 62,37 67,38 62,39 60,44 58,39 53,38 58,37" fill="#ffffff" />
      <polygon points="88,60 90,65 95,66 90,67 88,72 86,67 81,66 86,65" fill="#ffffff" />
      <polygon points="60,88 62,93 67,94 62,95 60,100 58,95 53,94 58,93" fill="#ffffff" />
      <polygon points="32,60 34,65 39,66 34,67 32,72 30,67 25,66 30,65" fill="#ffffff" />
    </svg>
  );
}
