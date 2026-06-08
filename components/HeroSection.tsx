'use client';

import React from 'react';
import { QrCode, ArrowRight } from 'lucide-react';

interface HeroSectionProps {
  onScrollTo: (id: string) => void;
}

export default function HeroSection({ onScrollTo }: HeroSectionProps) {
  return (
    <div className="lg:col-span-7 space-y-6 sm:space-y-8 text-center lg:text-left">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md" suppressHydrationWarning>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[11px] sm:text-xs font-mono text-slate-300 tracking-wider uppercase" suppressHydrationWarning>
          WeChat Heal Companion Agent
        </span>
      </div>
      <div className="space-y-4">
        <h1 className="text-4xl sm:text-5xl lg:text-5xl font-black tracking-tight text-white leading-tight">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#fcd34d] via-amber-300 to-indigo-300">
            小王子- SoulMate
          </span>
        </h1>
        <div className="h-1 w-20 bg-gradient-to-r from-[#fcd34d] to-purple-500 mx-auto lg:mx-0 rounded-full" />
        <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto lg:mx-0 leading-relaxed font-sans">
          先行动，再理解；先反馈，再成长。
          <span className="block mt-2 font-medium text-amber-200">
            小王子会陪你把隐性的经验，变成每天可练习的能力。
          </span>
        </p>
      </div>
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md max-w-lg mx-auto lg:mx-0 text-left relative overflow-hidden">
        <div className="absolute right-2 bottom-0 text-white/5 font-bold text-5xl pointer-events-none select-none font-mono">
          SOUL
        </div>
        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
          “小王子不是只会安慰你的 AI，而是一个会陪你设定目标、完成微行动、复盘反馈并持续进化的成长型子 Agent。”
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
        <button 
          onClick={() => onScrollTo('section-growth-onboarding')}
          className="px-8 py-3.5 text-sm sm:text-base font-bold text-slate-950 bg-gradient-to-r from-[#fcd34d] via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-600 rounded-full transition-all active:scale-95 shadow-lg shadow-[#fcd34d]/20 flex items-center justify-center gap-2 cursor-pointer"
        >
          <QrCode className="w-5 h-5 shrink-0" />
          <span>3 分钟生成进化地图</span>
        </button>
        <button 
          onClick={() => onScrollTo('section-30day')}
          className="px-6 py-3.5 text-sm sm:text-base font-medium text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#fcd34d]/30 rounded-full transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
        >
          <span>查看 30 天计划</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
