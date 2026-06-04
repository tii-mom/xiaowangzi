'use client';

import React from 'react';
import { Moon, CheckCircle2 } from 'lucide-react';

export interface PlanSelection {
  id: string;
  name: string;
  amount_cents: number;
}

interface PricingCardsProps {
  onSelectPlan: (plan: PlanSelection) => void;
}

export default function PricingCards({ onSelectPlan }: PricingCardsProps) {
  return (
    <section className="space-y-8" id="section-pricing">
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-extrabold tracking-tight text-white">
          开始你与小王子的旅程
        </h2>
        <p className="text-sm text-slate-400 max-w-xl mx-auto">
          选择适合你的陪伴方案。无任何强制续费，极简温情。
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900/60 border border-white/5 rounded-2.5xl p-6 hover:border-slate-800 transition-all flex flex-col justify-between space-y-8 relative">
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-400 uppercase tracking-widest">免费体验</h3>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-4xl font-extrabold text-white">0</span>
                <span className="text-xs text-slate-400">元 / 独享体验</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">给探索者一个安心踏出第一步的契机</p>
            </div>
            <div className="h-px bg-white/5" />
            <ul className="space-y-3 text-xs text-slate-300">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>首次绑定微信机器人陪伴权</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>送 1 只指定小王子头像盲盒</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>3 天专属晨间能量调频推送</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>3 天晚间三联式复盘日记</span>
              </li>
            </ul>
          </div>
          <div className="space-y-3 pt-4">
            <button
              onClick={() => onSelectPlan({ id: 'free_trial', name: '免费体验', amount_cents: 0 })}
              className="w-full py-2.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all text-slate-100 rounded-lg cursor-pointer"
            >
              免费开始体验
            </button>
            <p className="text-[9px] text-slate-500 text-center">绑定即同步，0捆绑扣款</p>
          </div>
        </div>

        <div className="bg-gradient-to-b from-slate-900/80 to-slate-900/45 border-2 border-amber-500/30 rounded-2.5xl p-6 hover:border-amber-500/50 transition-all flex flex-col justify-between space-y-8 relative shadow-2xl">
          <div className="absolute top-0 right-6 -translate-y-1/2 px-3 py-1 bg-gradient-to-r from-amber-300 to-amber-500 rounded-full text-[9px] font-bold text-slate-950 uppercase tracking-widest">
            至臻极力推荐
          </div>
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-1.5 text-amber-300">
                <Moon className="w-4 h-4 shrink-0" />
                <h3 className="text-base font-bold uppercase tracking-widest">月光陪伴版</h3>
              </div>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase">RMB</span>
                <span className="text-4xl font-extrabold text-white">29</span>
                <span className="text-xs text-slate-400">元 / 阶段月资</span>
              </div>
              <p className="text-xs text-amber-200/85 mt-2">用一支冰咖啡的价格，同步锁定30夜晚安抚</p>
            </div>
            <div className="h-px bg-white/5" />
            <ul className="space-y-3 text-xs text-slate-300">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>每日清晨专属晨间能量调频推送</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>每日晚间 3 问深度复盘</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>基础云端日记记录存储（防丢失）</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>每周情绪心境微观小结报告</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>每月兑换发售 1 个头像盲盒</span>
              </li>
            </ul>
          </div>
          <div className="space-y-3 pt-4">
            <button
              onClick={() => onSelectPlan({ id: 'monthly', name: '月光陪伴版', amount_cents: 2900 })}
              className="w-full py-2.5 text-xs font-bold bg-gradient-to-r from-amber-300 to-amber-500 hover:from-amber-400 hover:to-amber-600 active:scale-95 transition-all text-slate-950 rounded-lg cursor-pointer"
            >
              选择月光陪伴
            </button>
            <p className="text-[9px] text-amber-200/70 text-center">绑定 Clawbot 后极速自动启用</p>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-white/5 rounded-2.5xl p-6 hover:border-slate-800 transition-all flex flex-col justify-between space-y-8 relative">
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-indigo-300 uppercase tracking-widest">星球成长版</h3>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase">RMB</span>
                <span className="text-4xl font-extrabold text-white">99</span>
                <span className="text-xs text-slate-400">元 / 季度成长包</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">专为渴望在30天计划中取得质变蜕变的用户打造</p>
            </div>
            <div className="h-px bg-white/5" />
            <ul className="space-y-3 text-xs text-slate-300">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>精微 30 天日常自我访谈（深度解答版）</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>微信超长多轮成长语篇记忆（守护灵魂）</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>复杂社会关系复盘辅助工具模式</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>长期成长周报生成 + 解锁隐藏头像</span>
              </li>
            </ul>
          </div>
          <div className="space-y-3 pt-4">
            <button
              onClick={() => onSelectPlan({ id: 'quarterly', name: '星球成长版', amount_cents: 9900 })}
              className="w-full py-2.5 text-xs font-bold bg-indigo-900/50 hover:bg-slate-800 text-indigo-200 active:scale-95 transition-all rounded-lg cursor-pointer"
            >
              选择星球成长
            </button>
            <p className="text-[9px] text-slate-500 text-center">适合有深刻改变和复盘诉求的您</p>
          </div>
        </div>
      </div>
    </section>
  );
}
