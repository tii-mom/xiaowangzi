import React from 'react';

export default function DiaryAvatar() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full drop-shadow-[0_0_15px_rgba(168,85,247,0.3)]">
      <defs>
        <radialGradient id="purpleGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#c084fc" stopOpacity="0.7" />
          <stop offset="60%" stopColor="#6366f1" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#090514" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="bookCoverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="60%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#312e81" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="50" fill="#090514" stroke="rgba(168,85,247,0.15)" strokeWidth="1.5" />
      <circle cx="60" cy="60" r="50" fill="url(#purpleGlow)" />
      <circle cx="60" cy="60" r="38" fill="none" stroke="rgba(168, 85, 247, 0.2)" strokeWidth="1.5" strokeDasharray="4 2" />
      <circle cx="60" cy="60" r="26" fill="none" stroke="rgba(99, 102, 241, 0.25)" strokeWidth="1" />
      <g transform="translate(15, 15)">
        <rect x="25" y="25" width="40" height="40" rx="6" fill="url(#bookCoverGrad)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <path d="M 45,28 L 30,30 L 30,60 L 45,58 Z" fill="#ffffff" opacity="0.9" />
        <path d="M 45,28 L 60,30 L 60,60 L 45,58 Z" fill="#f3f4f6" opacity="0.9" />
        <path d="M 52,20 Q 56,36 38,55" stroke="#f472b6" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M 52,20 C 56,18 58,12 55,8 T 46,14 Z" fill="#f472b6" />
      </g>
      <circle cx="34" cy="38" r="1.5" fill="#f472b6" />
      <polyline points="85,32 86,35 89,36 86,37 85,40 84,37 81,36 84,35" fill="#ffffff" />
      <polyline points="30,80 31,82 33,83 31,84 30,86 29,84 27,83 29,84 27,83" fill="#c084fc" />
    </svg>
  );
}
