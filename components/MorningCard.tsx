'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Sun, Sparkles } from 'lucide-react';

interface Fortune {
  title: string;
  description: string;
  command: string;
}

interface MorningCardProps {
  onToast: (msg: string) => void;
  currentFortune: Fortune | null;
  isShaking: boolean;
  onDrawFortune: () => void;
}

export default function MorningCard({ onToast, currentFortune, isShaking, onDrawFortune }: MorningCardProps) {
  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 sm:p-6 transition-all shadow-md relative group flex flex-col justify-between">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="px-3 py-1 text-xs font-semibold text-[#fcd34d] bg-[#fcd34d]/10 border border-[#fcd34d]/20 rounded-full flex items-center gap-1">
            <Sun className="w-3.5 h-3.5 text-[#fcd34d] shrink-0" />
            <span>早上：晨间能量共振</span>
          </div>
          <span className="text-xs font-mono text-slate-500">08:00 AM</span>
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-slate-100">专属电波，开启朝气与调频</h3>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            每天清晨，小王子为你进行今日专属能量调频。不是空洞的标号，而是根据宇宙电波，为你注入一天的奇妙温暖与活力。
          </p>
        </div>
        <div className="mt-4 p-4 rounded-xl bg-[#020617]/90 border border-[#fcd34d]/20 space-y-3 relative overflow-hidden">
          <div className="absolute top-1 right-2 text-[9px] font-mono text-[#fcd34d]/40 uppercase">
            Interactive
          </div>
          {!currentFortune ? (
            <div className="text-center py-4 space-y-3">
              <div className={`mx-auto w-10 h-10 ${isShaking ? 'animate-bounce' : ''}`}>
                <svg viewBox="0 0 64 64" className="w-full h-full text-[#fcd34d]">
                  <path d="M16 8 L48 8 L44 48 Q32 54 20 48 Z" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="2" />
                  <line x1="28" y1="2" x2="28" y2="16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  <line x1="36" y1="2" x2="36" y2="20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  <line x1="42" y1="4" x2="40" y2="14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
              <p className="text-xs text-yellow-100/70">
                {isShaking ? "正在同步宇宙电波，校准元气中..." : "点击下方，摇晃获取小王子晨间能量卡"}
              </p>
              <button 
                onClick={onDrawFortune}
                disabled={isShaking}
                className="w-full py-3 text-xs sm:text-sm font-bold bg-[#fcd34d] hover:bg-[#fbbf24] text-slate-950 rounded-xl transition-all active:scale-95 cursor-pointer shadow-md shadow-[#fcd34d]/10 flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                <span>{isShaking ? "同步宇宙星尘中..." : "校准今天的晨间能量卡"}</span>
              </button>
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-3 text-center"
            >
              <div className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold bg-[#fcd34d]/10 text-[#fcd34d] border border-[#fcd34d]/30">
                🍃 晨间能量卡
              </div>
              <h4 className="text-sm font-bold text-white">状态：{currentFortune.title}</h4>
              <p className="text-xs text-yellow-100/90 italic leading-relaxed font-sans">
                “{currentFortune.description}”
              </p>
              <div className="pt-2 text-[11px] text-slate-400 font-sans border-t border-white/5 text-left">
                <strong className="text-[#fcd34d]">共振心流指引：</strong>
                {currentFortune.command}
              </div>
              <button 
                onClick={onDrawFortune}
                className="mt-2 text-[10px] text-slate-400 hover:text-[#fcd34d] underline cursor-pointer"
              >
                重新调试我的频率
              </button>
            </motion.div>
          )}
        </div>
      </div>
      <div className="pt-4 border-t border-white/5 text-[11px] text-slate-500 flex items-center justify-between">
        <span>体验仪式感 · 微信端独创</span>
        <Sparkles className="w-3 h-3 text-[#fcd34d]" />
      </div>
    </div>
  );
}
