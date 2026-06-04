'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, QrCode, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function BindPage() {
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isBound, setIsBound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hermesId, setHermesId] = useState<string | null>(null);
  const [needSession, setNeedSession] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const sRes = await fetch('/api/bind/status');
      const sData = await sRes.json();
      if (cancelled) return;
      if (sData.is_bound) { setIsBound(true); setHermesId(sData.hermes_user_id ?? sData.wechat_external_id); setLoading(false); return; }
      if (sData.error && sRes.status === 401) { setNeedSession(true); setLoading(false); return; }

      const cRes = await fetch('/api/bind/create-code', { method: 'POST' });
      const cData = await cRes.json();
      if (cancelled) return;
      if (cData.error && cRes.status === 401) { setNeedSession(true); setLoading(false); return; }
      setCode(cData.code); setExpiresAt(cData.expires_at); setLoading(false);
    }
    init();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (isBound || needSession) return;
    const interval = setInterval(async () => {
      const r = await fetch('/api/bind/status');
      const d = await r.json();
      if (d.is_bound) { setIsBound(true); setHermesId(d.hermes_user_id ?? d.wechat_external_id); }
    }, 3000);
    return () => clearInterval(interval);
  }, [isBound, needSession]);

  const startSession = async () => {
    await fetch('/api/auth/web-session', { method: 'POST' });
    window.location.reload();
  };

  if (loading) {
    return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-slate-400 text-sm">加载中...</div>;
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans">
      <div className="max-w-md mx-auto px-4 py-10 space-y-8 text-center">
        <div className="flex flex-col items-center gap-3 mb-6">
          <Sparkles className="w-8 h-8 text-amber-300" /><h1 className="text-2xl font-bold text-white">微信绑定</h1>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-xs text-amber-300">
          <AlertTriangle className="w-4 h-4 inline mr-1" />微信绑定通道仍处于 POC 验证阶段，当前 Web 对话可正常使用。
        </div>

        {needSession ? (
          <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 space-y-4">
            <p className="text-sm text-slate-400">请先创建会话开始体验</p>
            <button onClick={startSession} className="px-6 py-2.5 text-xs font-bold text-slate-950 bg-amber-400 rounded-full hover:bg-amber-500">开始体验</button>
          </div>
        ) : isBound ? (
          <div className="bg-slate-900/60 border border-emerald-500/20 rounded-2xl p-6 space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h2 className="text-lg font-bold text-emerald-300">绑定成功!</h2>
            <p className="text-sm text-slate-400">用户标识: <span className="font-mono text-white">{hermesId}</span></p>
            <a href="/dashboard" className="inline-block text-xs text-amber-400 underline">前往仪表盘</a>
          </div>
        ) : (
          <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="bg-[#020617] border border-amber-500/20 rounded-xl p-6">
              <QrCode className="w-24 h-24 mx-auto text-slate-600" /><p className="text-xs text-slate-500 mt-3">微信扫码添加小王子</p>
            </div>
            {code && (
              <div className="space-y-2">
                <p className="text-xs text-slate-400">你的绑定码</p>
                <p className="text-3xl font-mono font-bold tracking-widest text-amber-300">{code}</p>
                <p className="text-xs text-slate-500">添加微信后发送此码完成绑定{expiresAt ? ` · ${new Date(expiresAt).toLocaleTimeString()}前有效` : ''}</p>
              </div>
            )}
            <p className="text-xs text-slate-500 leading-relaxed">1. 微信扫码添加固定小王子账号<br />2. 发送上方 8 位绑定码<br />3. 自动完成绑定</p>
          </div>
        )}
        <a href="/" className="text-xs text-slate-500 hover:text-amber-400 underline">← 返回首页</a>
      </div>
    </div>
  );
}
