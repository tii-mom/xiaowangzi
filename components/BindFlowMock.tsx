'use client';

import React from 'react';

interface BindFlowMockProps {
  onToast: (msg: string) => void;
  onAlert: (title: string, message: string) => void;
}

export default function BindFlowMock({ onToast, onAlert }: BindFlowMockProps) {
  const handleQrCodeClick = () => {
    onToast("📲 模拟扫码提示：Clawbot 契约加载完毕 ⚡");
    onAlert("⚜️ 守护契约已开启同步...", "已模拟微信二维码瞬间扫码。由于当前运行在沙盒体验环境，您的微信终端已预定'小王子陪伴激活码：B612-FREE'。现在，您可以在本体验页面的所有模块中完整与小王子畅聊并开启您的30日感知重塑！");
  };

  return (
    <section className="bg-gradient-to-b from-indigo-950/20 to-slate-950 border border-indigo-500/15 rounded-3xl p-6 sm:p-10" id="section-binding">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        <div className="lg:col-span-6 space-y-6">
          <div className="space-y-2">
            <span className="text-xs font-mono font-bold text-amber-300 tracking-widest uppercase">
              START NOW
            </span>
            <h3 className="text-2.5xl sm:text-3xl font-extrabold text-white tracking-tight">
              3 步召唤我的小王子
            </h3>
            <p className="text-xs sm:text-sm text-slate-400">
              扫一扫下方微信专属机器人二维码，即可在微信环境内完成永久陪伴绑定。
              <span className="block mt-1 text-amber-500/70 text-[11px]">(POC 绑定演示 — 微信通道处于验证阶段)</span>
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-mono font-bold text-xs text-indigo-300 shrink-0">
                1
              </div>
              <div>
                <h5 className="text-xs sm:text-sm font-semibold text-slate-200">
                  微信扫码绑定 Clawbot 服务助手
                </h5>
                <p className="text-[11px] text-slate-500">自动同步并验证小王子心理陪伴Agent</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-mono font-bold text-xs text-indigo-300 shrink-0">
                2
              </div>
              <div>
                <h5 className="text-xs sm:text-sm font-semibold text-slate-200">
                  随机开启首只小王子「头像盲盒」
                </h5>
                <p className="text-[11px] text-slate-500">直接通过微信对话框提取并下载至个人相册</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-mono font-bold text-xs text-indigo-300 shrink-0">
                3
              </div>
              <div>
                <h5 className="text-xs sm:text-sm font-semibold text-slate-200">
                  开启今日「晨间能量调频」
                </h5>
                <p className="text-[11px] text-slate-500">同步小王子的日常治愈行动与晚间三联反思</p>
              </div>
            </div>
          </div>

          <div 
            onClick={handleQrCodeClick}
            className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 flex items-center gap-5 max-w-sm mr-auto cursor-pointer transition-all hover:scale-[1.02] transform active:scale-98"
          >
            <div className="bg-white p-2 rounded-xl shrink-0 w-24 h-24 flex items-center justify-center relative overflow-hidden select-none group" title="微信小王子占位码">
              <svg viewBox="0 0 100 100" className="w-full h-full text-slate-900">
                <rect x="0" y="0" width="30" height="30" fill="currentColor" />
                <rect x="5" y="5" width="20" height="20" fill="#ffffff" />
                <rect x="10" y="10" width="10" height="10" fill="currentColor" />
                <rect x="70" y="0" width="30" height="30" fill="currentColor" />
                <rect x="75" y="5" width="20" height="20" fill="#ffffff" />
                <rect x="80" y="10" width="10" height="10" fill="currentColor" />
                <rect x="0" y="70" width="30" height="30" fill="currentColor" />
                <rect x="5" y="75" width="20" height="20" fill="#ffffff" />
                <rect x="10" y="80" width="10" height="10" fill="currentColor" />
                <rect x="40" y="10" width="15" height="10" fill="currentColor" />
                <rect x="40" y="25" width="20" height="15" fill="currentColor" />
                <rect x="15" y="45" width="15" height="15" fill="currentColor" />
                <rect x="70" y="40" width="20" height="15" fill="currentColor" />
                <rect x="45" y="50" width="15" height="10" fill="currentColor" />
                <rect x="40" y="70" width="10" height="20" fill="currentColor" />
                <rect x="60" y="75" width="25" height="15" fill="currentColor" />
                <rect x="90" y="90" width="10" height="10" fill="currentColor" />
                <rect x="10" y="60" width="10" height="5" fill="currentColor" />
              </svg>
              <div className="absolute left-0 right-0 h-0.5 bg-indigo-500 opacity-60 animate-[pulse_1.5s_infinite]" />
            </div>
            <div>
              <div className="text-xs font-mono font-bold text-indigo-400">CLAWBOT INTEGRATION</div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-100 mt-0.5">扫码建立守护契约</h4>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                扫码绑定后，小王子会通过对话系统主动和你说第一句话。
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 relative">
          <div className="p-6 sm:p-8 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 relative space-y-4">
            <div className="absolute -top-3 left-6 px-3 py-1 bg-indigo-500 rounded-full text-[10px] font-bold text-slate-950 tracking-wide">
              PRINCE FIRST WORD
            </div>
            <p className="text-sm font-sans text-slate-100 leading-relaxed font-medium">
              “ 你好。我是你微信里的 SoulMate 小王子。
              <br className="hidden sm:block" />
              在这里我们会共同疗愈、陪伴和成长。早上我陪你进行能量共振，白天我交给你一个治愈行动，晚上倾听你的 3 个答案。
              <br className="hidden sm:block" />
              当你有压力或者焦虑时，你可以随时和我说说话，我会一直记着属于我们的过往点滴。”
            </p>
            <div className="border-t border-indigo-500/10 pt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-900 border border-amber-500/20 p-0.5">
                  <svg viewBox="0 0 120 120" className="w-full h-full">
                    <circle cx="60" cy="55" r="30" fill="#fed7aa" />
                    <path d="M 33,52 C 28,34 38,25 54,25 C 64,25 70,18 80,26 C 88,32 86,48 83,56" fill="#fde047" />
                  </svg>
                </div>
                <div>
                  <h5 className="text-[11px] font-bold text-slate-200">陪伴星系 B612 精灵</h5>
                  <p className="text-[9px] text-indigo-400">2026 觉察守护者激活中</p>
                </div>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">B612 #01</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
