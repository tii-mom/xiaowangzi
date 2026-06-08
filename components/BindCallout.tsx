'use client';

import React from 'react';
import Link from 'next/link';
import { MessageCircle, QrCode, ShieldCheck } from 'lucide-react';

export default function BindCallout() {
  return (
    <section className="bg-gradient-to-b from-indigo-950/20 to-slate-950 border border-indigo-500/15 rounded-3xl p-6 sm:p-10" id="section-binding">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        <div className="lg:col-span-7 space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-300/10 px-3 py-1 text-xs font-semibold text-indigo-200">
            <MessageCircle className="w-3.5 h-3.5" />
            微信继续成长
          </div>
          <div className="space-y-3">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              把你的 Z-27 进化地图带到微信里
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">
              完成网页进化地图后，再打开真实 Clawbot 绑定页。绑定成功后，小王子会用同一个子 Agent、同一份核心文档和同一份成长记忆继续陪你聊天。
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-400">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-indigo-200 font-bold">同一子 Agent</p>
              <p className="mt-1">Web 和微信不分裂</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-indigo-200 font-bold">同一成长目标</p>
              <p className="mt-1">行动和复盘会进入上下文</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-indigo-200 font-bold">同一账本</p>
              <p className="mt-1">聊天扣费可追溯</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-3xl border border-white/10 bg-slate-900/70 p-6 space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-white text-slate-950 flex items-center justify-center">
            <QrCode className="w-7 h-7" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-white">打开真实绑定页</h4>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              页面会生成 Clawbot 授权 ticket，并跳转到正式扫码授权流程。
            </p>
          </div>
          <Link
            href="/bind"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-indigo-300 px-5 py-3 text-sm font-black text-slate-950 hover:bg-indigo-200 transition-colors"
          >
            <ShieldCheck className="w-4 h-4" />
            前往微信绑定
          </Link>
          <p className="text-xs text-slate-500 leading-relaxed">
            这里不再展示演示二维码。所有绑定状态以 `/bind` 与 Dashboard 的真实接口为准。
          </p>
        </div>
      </div>
    </section>
  );
}
