'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Sparkles, CheckCircle2 } from 'lucide-react';
import { PLANS } from '@/lib/plans';

export default function PayPage() {
  const [plans] = useState<typeof PLANS[string][]>(() => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const isProd = appUrl === 'https://wan.lat' || appUrl === 'https://www.wan.lat';
    return Object.values(PLANS).filter((p) => {
      if (p.id === 'free_trial') return false;
      if (p.id === 'staging_test_10c' && isProd) return false;
      return p.amount_cents > 0;
    });
  });
  const [qrImg, setQrImg] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [price, setPrice] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const createOrder = async (planId: string) => {
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/pay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (data.error) throw new Error(String(data.error));
      setQrImg(String(data.qr_img ?? ''));
      setOrderId(String(data.order_id ?? ''));
      setPrice(String(data.price ?? ''));
      startPolling(String(data.order_id ?? ''));
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建订单失败');
    } finally {
      setCreating(false);
    }
  };

  const startPolling = (oid: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/pay/query?order_id=${oid}`);
      const data = await res.json() as Record<string, unknown>;
      if (data.status === 'paid') {
        setPaid(true);
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        setTimeout(() => { window.location.href = '/dashboard'; }, 2000);
      }
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans">
      <div className="max-w-lg mx-auto px-4 py-10 space-y-8">
        <div className="flex items-center gap-3 mb-6">
          <Sparkles className="w-6 h-6 text-amber-300" />
          <h1 className="text-2xl font-bold text-white">Token 充值</h1>
        </div>

        {!orderId && !error && (
          <div className="space-y-4">
            {plans.map((p) => (
              <div key={p.id} className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-white">{p.name}</h3>
                  <p className="text-xs text-slate-400">{(p.tokens_amount / 1000).toFixed(0)}k tokens</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-extrabold text-amber-300">¥{(p.amount_cents / 100).toFixed(0)}</p>
                  <button
                    onClick={() => createOrder(p.id)}
                    disabled={creating}
                    className="text-xs font-bold text-slate-950 bg-amber-400 px-4 py-1.5 rounded-full hover:bg-amber-500 mt-2 disabled:opacity-50"
                  >
                    {creating ? '创建中...' : '选择'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {creating && (
          <div className="text-center py-8 text-slate-400 text-sm">正在创建支付订单...</div>
        )}

        {qrImg && !paid && (
          <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 text-center space-y-4">
            <div className="bg-white p-3 rounded-xl mx-auto w-48 h-48 flex items-center justify-center">
              {qrImg ? <img src={qrImg} alt="支付二维码" className="w-full h-full object-contain" /> : <span className="text-xs text-slate-500">加载中</span>}
            </div>
            <p className="text-sm text-slate-300">微信扫码支付 ¥{price}</p>
            <p className="text-xs text-slate-500">支付成功后自动跳转仪表盘</p>
          </div>
        )}

        {paid && (
          <div className="text-center space-y-4 py-8">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <p className="text-lg font-bold text-emerald-300">支付成功!</p>
            <p className="text-sm text-slate-400">正在跳转...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-sm text-red-300 text-center">{error}</div>
        )}

        <div className="text-center">
          <Link href="/" className="text-xs text-slate-500 hover:text-amber-400 underline">← 返回首页</Link>
        </div>
      </div>
    </div>
  );
}
