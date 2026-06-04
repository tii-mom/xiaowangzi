'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, QrCode, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function BindPage() {
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isBound, setIsBound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hermesId, setHermesId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/bind/status').then((r) => r.json()).then((d) => {
      if (d.is_bound) {
        setIsBound(true);
        setHermesId(d.hermes_user_id ?? d.wechat_external_id);
      }
      setLoading(false);
    });

    if (!isBound) {
      fetch('/api/bind/create-code', { method: 'POST' })
        .then((r) => r.json())
        .then((d) => {
          setCode(d.code);
          setExpiresAt(d.expires_at);
        });
    }
  }, []);

  useEffect(() => {
    if (isBound) return;
    const interval = setInterval(() => {
      fetch('/api/bind/status').then((r) => r.json()).then((d) => {
        if (d.is_bound) {
          setIsBound(true);
          setHermesId(d.hermes_user_id ?? d.wechat_external_id);
          clearInterval(interval);
        }
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [isBound]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center text-slate-400 text-sm">加载中...</div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans">
      <div className="max-w-md mx-auto px-4 py-10 space-y-8 text-center">
        <div className="flex flex-col items-center gap-3 mb-6">
          <Sparkles className="w-8 h-8 text-amber-300" />
          <h1 className="text-2xl font-bold text-white">微信绑定</h1>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-xs text-amber-300">
          <AlertTriangle className="w-4 h-4 inline mr-1" />
          微信绑定通道仍处于 POC 验证阶段，当前 Web 对话可正常使用。
        </div>

        {isBound ? (
          <div className="bg-slate-900/60 border border-emerald-500/20 rounded-2xl p-6 space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h2 className="text-lg font-bold text-emerald-300">绑定成功!</h2>
            <p className="text-sm text-slate-400">用户标识: <span className="font-mono text-white">{hermesId}</span></p>
            <a href="/dashboard" className="inline-block text-xs text-amber-400 underline">前往仪表盘</a>
          </div>
        ) : (
          <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="bg-[#020617] border border-amber-500/20 rounded-xl p-6">
              <QrCode className="w-24 h-24 mx-auto text-slate-600" />
              <p className="text-xs text-slate-500 mt-3">微信扫码添加小王子</p>
            </div>

            {code && (
              <div className="space-y-2">
                <p className="text-xs text-slate-400">你的绑定码</p>
                <p className="text-3xl font-mono font-bold tracking-widest text-amber-300">{code}</p>
                <p className="text-xs text-slate-500">
                  添加微信后发送此码完成绑定
                  {expiresAt && ` · ${new Date(expiresAt).toLocaleTimeString()} 前有效`}
                </p>
              </div>
            )}

            <p className="text-xs text-slate-500 leading-relaxed">
              1. 微信扫码添加固定小王子账号<br />
              2. 发送上方 8 位绑定码<br />
              3. 自动完成绑定
            </p>
          </div>
        )}

        <a href="/" className="text-xs text-slate-500 hover:text-amber-400 underline">← 返回首页</a>
      </div>
    </div>
  );
}
