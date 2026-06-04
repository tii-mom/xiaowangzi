'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Activity, CheckCircle2, Check } from 'lucide-react';

interface Fortune {
  title: string;
  description: string;
  command: string;
}

interface ActionCardProps {
  onToast: (msg: string) => void;
  currentFortune: Fortune | null;
  actionDone: boolean;
  actionDoneMsg: string;
  onActionClick: () => void;
}

export default function ActionCard({ onToast, currentFortune, actionDone, actionDoneMsg, onActionClick }: ActionCardProps) {
  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 sm:p-6 transition-all shadow-md relative group flex flex-col justify-between">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="px-3 py-1 text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>白天：一个小行动</span>
          </div>
          <span className="text-xs font-mono text-slate-500">02:00 PM</span>
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-slate-100">拒绝空想，做个极小的行动</h3>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            当你陷入焦虑与自我怀疑，小王子从不说那些没用的废话。他会递来一个微小到绝对不会失败的物理行动。
          </p>
        </div>
        <div className="mt-4 p-4 rounded-xl bg-[#020617]/90 border border-emerald-500/20 space-y-3.5 relative">
          <div className="absolute top-1 right-2 text-[9px] font-mono text-emerald-500/40 uppercase">
            Execution
          </div>
          <div className="space-y-1.5 text-left">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold font-mono">
              当前行动卡片
            </div>
            <p className="text-xs text-emerald-100 font-medium font-sans">
              {currentFortune ? (
                <span>✨ 指令：请根据您的晨间能量卡指引完成：<strong className="text-[#fcd34d] font-semibold">{currentFortune.command}</strong></span>
              ) : (
                <span>暂无行动接单，请先在左侧生成本日「晨间能量卡」以获取心流指引。</span>
              )}
            </p>
          </div>
          {!actionDone ? (
            <button 
              onClick={onActionClick}
              className="w-full py-3 text-xs sm:text-sm font-bold bg-emerald-400 hover:bg-emerald-500 text-slate-950 rounded-xl transition-all active:scale-95 cursor-pointer shadow-md shadow-emerald-400/10 flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>我已完成！向小王子汇报</span>
            </button>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-2.5 rounded bg-emerald-900/20 border border-emerald-400/20 text-xs text-emerald-200 leading-relaxed space-y-2"
            >
              <div className="flex items-center gap-1 font-bold text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>已向小王子汇报：</span>
              </div>
              <p>{actionDoneMsg}</p>
            </motion.div>
          )}
        </div>
      </div>
      <div className="pt-4 border-t border-white/5 text-[11px] text-slate-500 flex items-center justify-between">
        <span>拒绝精神内耗 · 陪伴共生成长</span>
        <Check className="w-3.5 h-3.5 text-emerald-400" />
      </div>
    </div>
  );
}
