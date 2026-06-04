import React from 'react';

export default function MoonlightAvatar() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full drop-shadow-[0_0_15px_rgba(253,224,71,0.25)]">
      <defs>
        <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fef08a" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#ca8a04" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="50%" stopColor="#ca8a04" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#312e81" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="50" fill="#090d22" stroke="rgba(253,224,71,0.1)" strokeWidth="1.5" />
      <circle cx="60" cy="60" r="50" fill="url(#moonGlow)" opacity="0.6" />
      <path d="M 25,60 A 35,35 0 0,1 95,60" stroke="rgba(253,224,71,0.15)" strokeWidth="1" strokeDasharray="3 3" fill="none" />
      <path d="M 60,25 A 35,35 0 0,1 60,95" stroke="rgba(253,224,71,0.15)" strokeWidth="1" strokeDasharray="3 3" fill="none" />
      <ellipse cx="60" cy="60" rx="38" ry="12" fill="none" stroke="url(#ringGrad)" strokeWidth="2.5" transform="rotate(-15 60 60)" />
      <path d="M 52,38 C 66,38 76,46 76,60 C 76,74 66,82 52,82 C 62,80 67,71 67,60 C 67,49 62,40 52,38 Z" fill="#fde047" />
      <polygon points="40,48 42,53 47,54 43,57 44,62 40,59 36,62 37,57 33,54 38,53" fill="#fcd34d" />
      <polygon points="78,72 79,75 82,76 79,77 78,80 77,77 74,76 77,75" fill="#fcd34d" className="animate-pulse" />
      <circle cx="28" cy="74" r="1.5" fill="#ffffff" />
      <circle cx="85" cy="40" r="2" fill="#818cf8" />
    </svg>
  );
}
