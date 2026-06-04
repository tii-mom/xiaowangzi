'use client';

import React from 'react';
import { Sparkles, ChevronRight } from 'lucide-react';

interface HeaderProps {
  onScrollTo: (id: string) => void;
}

export default function Header({ onScrollTo }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-[#020617]/85 backdrop-blur-md border-b border-white/10 py-4 px-4 sm:px-8">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-xl bg-gradient-to-tr from-[#fcd34d] via-amber-400 to-indigo-500 flex items-center justify-center shadow-lg shadow-[#fcd34d]/20 animate-pulse">
            <Sparkles className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold tracking-tight text-white font-sans">小王子</span>
              <span className="text-[10px] sm:text-xs font-mono px-1.5 py-0.5 rounded bg-[#fcd34d]/10 border border-[#fcd34d]/20 text-[#fcd34d] font-normal">微信机器人</span>
            </div>
            <p className="hidden md:block text-[11px] text-slate-400 tracking-wider">SoulMate 情绪陪伴 Agent</p>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-7">
          <button onClick={() => onScrollTo('section-experience')} className="text-sm text-slate-300 hover:text-[#fcd34d] transition-colors cursor-pointer">
            产品体验
          </button>
          <button onClick={() => onScrollTo('section-30day')} className="text-sm text-slate-300 hover:text-[#fcd34d] transition-colors cursor-pointer">
            30天计划
          </button>
          <button onClick={() => onScrollTo('section-avatar')} className="text-sm text-slate-300 hover:text-[#fcd34d] transition-colors cursor-pointer">
            头像盲盒
          </button>
          <button onClick={() => onScrollTo('section-pricing')} className="text-sm text-slate-300 hover:text-[#fcd34d] transition-colors cursor-pointer">
            订阅定价
          </button>
        </nav>
        <button 
          onClick={() => onScrollTo('section-binding')}
          className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-950 bg-gradient-to-r from-[#fcd34d] to-amber-400 hover:from-amber-400 hover:to-amber-500 rounded-full transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-md shadow-[#fcd34d]/20 flex items-center gap-1 cursor-pointer"
        >
          <span>立即绑定</span>
          <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
      </div>
    </header>
  );
}
