'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, QrCode, CheckCircle2, AlertTriangle } from 'lucide-react';

interface BindStatusResponse {
  status?: string;
  is_bound?: boolean;
  masked_external_id?: string | null;
  error?: string;
}

function isBoundStatus(data: BindStatusResponse): boolean {
  return data.status === 'bound' || data.is_bound === true;
}

export default function BindPage() {
  const [bindUrl, setBindUrl] = useState<string | null>(null);
  const [ticket, setTicket] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isBound, setIsBound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [hermesId, setHermesId] = useState<string | null>(null);
  const [needSession, setNeedSession] = useState(false);

  const createTicket = useCallback(async (cancelled = false) => {
    setCreatingTicket(true);
    try {
      const cRes = await fetch('/api/bot/clawbot/bind-ticket', { method: 'POST' });
      const cData = await cRes.json() as Record<string, unknown>;
      if (cancelled) return;
      if (cData.error && cRes.status === 401) { setNeedSession(true); return; }
      setBindUrl(String(cData.bind_url ?? ''));
      setTicket(String(cData.ticket ?? ''));
      setExpiresAt(String(cData.expires_at ?? ''));
    } finally {
      if (!cancelled) setCreatingTicket(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const sRes = await fetch('/api/bind/status');
      const sData = await sRes.json() as BindStatusResponse;
      if (cancelled) return;
      if (isBoundStatus(sData)) { setIsBound(true); setHermesId(sData.masked_external_id ?? null); setLoading(false); return; }
      if (sData.error && sRes.status === 401) { setNeedSession(true); setLoading(false); return; }

      await createTicket(cancelled);
      setLoading(false);
    }
    init();
    return () => { cancelled = true; };
  }, [createTicket]);

  useEffect(() => {
    if (isBound || needSession) return;
    const interval = setInterval(async () => {
      const r = await fetch('/api/bind/status');
      const d = await r.json() as BindStatusResponse;
      if (isBoundStatus(d)) { setIsBound(true); setHermesId(d.masked_external_id ?? null); }
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
          <AlertTriangle className="w-4 h-4 inline mr-1" />绑定后可在微信直接聊天；当前处于灰度联调阶段，Web 对话仍可正常使用。
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
            <p className="text-sm text-slate-400">用户标识: <span className="font-mono text-white">{hermesId ?? '已绑定'}</span></p>
            <p className="text-xs text-slate-500 leading-relaxed">如果微信顶部显示“暂无法连接”，请重新连接微信通道刷新 Clawbot 授权。</p>
            <button
              onClick={() => createTicket()}
              disabled={creatingTicket}
              className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-400 rounded-full hover:bg-amber-500 disabled:opacity-60"
            >
              {creatingTicket ? '生成中...' : '重新连接微信通道'}
            </button>
            {bindUrl && (
              <div className="space-y-3 pt-2 border-t border-white/10">
                <p className="text-xs text-slate-400">刷新连接 ticket</p>
                <p className="text-[11px] font-mono text-amber-300 break-all">{ticket}</p>
                <a href={bindUrl} target="_blank" rel="noreferrer" className="inline-block px-5 py-2 text-xs font-bold text-slate-950 bg-amber-400 rounded-full hover:bg-amber-500">
                  打开绑定页
                </a>
                <p className="text-xs text-slate-500 break-all">{bindUrl}</p>
                <p className="text-xs text-slate-500">扫码确认后会刷新连接{expiresAt ? ` · ${new Date(expiresAt).toLocaleTimeString()}前有效` : ''}</p>
              </div>
            )}
            <Link href="/dashboard" className="inline-block text-xs text-amber-400 underline">前往仪表盘</Link>
          </div>
        ) : (
          <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="bg-[#020617] border border-amber-500/20 rounded-xl p-6">
              <QrCode className="w-24 h-24 mx-auto text-slate-600" /><p className="text-xs text-slate-500 mt-3">打开 Clawbot 绑定页扫码确认</p>
            </div>
            {bindUrl && (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">绑定 ticket</p>
                <p className="text-[11px] font-mono text-amber-300 break-all">{ticket}</p>
                <a href={bindUrl} target="_blank" rel="noreferrer" className="inline-block px-5 py-2 text-xs font-bold text-slate-950 bg-amber-400 rounded-full hover:bg-amber-500">
                  打开绑定页
                </a>
                <p className="text-xs text-slate-500 break-all">{bindUrl}</p>
                <p className="text-xs text-slate-500">扫码确认后会自动完成绑定{expiresAt ? ` · ${new Date(expiresAt).toLocaleTimeString()}前有效` : ''}</p>
              </div>
            )}
            <p className="text-xs text-slate-500 leading-relaxed">1. 打开 Clawbot 绑定页<br />2. 按页面提示用微信扫码确认<br />3. 绑定成功后可直接发送消息聊天</p>
          </div>
        )}
        <Link href="/" className="text-xs text-slate-500 hover:text-amber-400 underline">← 返回首页</Link>
      </div>
    </div>
  );
}
