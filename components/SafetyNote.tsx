'use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';

export default function SafetyNote() {
  return (
    <section className="max-w-3xl mx-auto py-4" id="section-safety">
      <div className="bg-slate-900/30 border border-red-500/10 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row gap-5 items-start relative overflow-hidden backdrop-blur">
        <div className="absolute right-0 bottom-0 text-red-500/5 select-none text-7xl font-sans font-black pointer-events-none pr-2">
          SAFE
        </div>
        <div className="p-2 ml-1 rounded-xl bg-red-500/10 text-red-400 shrink-0 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-red-200/90 flex items-center gap-1.5">
            安全边界：小王子陪你，但不替代现实的危机干预
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed font-sans">
            小王子是一款基于微信客户端的暖心 AI 陪伴角色，不是专业精神科医生，也不提供临床心理咨询治疗方案。
            当你处于强烈的焦虑、极端痛苦或者伤害自己的生命危机时刻，请务必向你身处的现实生活、可信赖亲友寻求支援，或者立刻致电当地急救热线及正规危机转介机构。
          </p>
          <div className="pt-1.5 grid grid-cols-1 sm:grid-cols-3 gap-2.5 gap-y-1.5 text-[10px] text-red-300">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span>不做临床医学诊断</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span>不遮掩现实逃避救助</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span>危机引导专业介入</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
