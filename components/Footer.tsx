'use client';

import React from 'react';

interface FooterProps {
  onToast: (msg: string) => void;
  onAlert: (title: string, message: string) => void;
}

export default function Footer({ onToast, onAlert }: FooterProps) {
  return (
    <footer className="z-10 border-t border-white/5 bg-slate-950 mt-12 py-10 px-4 text-center text-slate-500 space-y-4">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1.5 text-center md:text-left">
          <h4 className="text-sm font-bold text-slate-300">小王子- SoulMate</h4>
          <p className="text-[11px] text-slate-500 leading-relaxed max-w-sm">
            疗愈、陪伴、成长；小王子是具有记忆、情绪和成长能力的Bot。陪你在现实的生活泥土里找到温暖的小确幸。
          </p>
        </div>
        <div className="flex flex-wrap gap-4 sm:gap-6 text-xs text-slate-400">
          <button onClick={() => onToast("《用户服务协议》暂为原型占位协议")} className="hover:text-amber-300 underline cursor-pointer">用户协议</button>
          <button onClick={() => onToast("《隐私数据保护守则》暂为原型占位隐私法")} className="hover:text-amber-300 underline cursor-pointer">隐私政策</button>
          <button onClick={() => onToast("本品内容纯属人工智能生成角色演绎，请合理看待")} className="hover:text-amber-300 underline cursor-pointer">AI 内容说明</button>
          <button onClick={() => onAlert("📫 寻求联合共赢", "如有产品公测合作意向或技术探讨，请邮件联系作者：yudeyou0118@gmail.com。随时相候！")} className="hover:text-amber-300 underline cursor-pointer">联系我们</button>
        </div>
      </div>
      <div className="h-px bg-white/5 w-full my-4" />
      <p className="text-[10px] font-mono tracking-widest text-slate-600 uppercase select-none">
        © {new Date().getFullYear()} THE LITTLE PRINCE HEAL companion. ALL RIGHTS RESERVED.
      </p>
    </footer>
  );
}
