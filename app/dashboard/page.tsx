'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, Coins, Clock, ArrowRight, MessageSquare } from 'lucide-react';

interface UserInfo { id: number; token_balance: number; status: string; created_at: string; }
interface TokenData { token_balance: number; total_purchased: number; total_used: number; }
interface Order { order_id: string; plan: string; amount_cents: number; tokens_amount: number; status: string; created_at: string; }
interface SubData { plan: string; status: string; started_at: string; expires_at: string | null; }
interface ConvItem { role: string; content: string; total_tokens: number; created_at: string; }
interface BindStatus { status?: string; is_bound?: boolean; masked_external_id?: string | null; }

export default function DashboardPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [tokens, setTokens] = useState<TokenData | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [sub, setSub] = useState<SubData | null>(null);
  const [convs, setConvs] = useState<ConvItem[]>([]);
  const [bindStatus, setBindStatus] = useState<BindStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [needSession, setNeedSession] = useState(false);

  useEffect(() => {
    async function load() {
      const u = await fetch('/api/user/me');
      if (u.status === 401) { setNeedSession(true); setLoading(false); return; }
      const uData = await u.json() as Record<string, unknown>;
      if (uData.error) { setNeedSession(true); setLoading(false); return; }
      setUser(uData as unknown as UserInfo);

      const [t, o, s, c, b] = await Promise.all([
        fetch('/api/user/tokens').then(r=>r.json() as Promise<Record<string, unknown>>),
        fetch('/api/user/orders').then(r=>r.json() as Promise<Record<string, unknown>>),
        fetch('/api/user/subscription').then(r=>r.json() as Promise<Record<string, unknown>>),
        fetch('/api/user/conversations?limit=5').then(r=>r.json() as Promise<Record<string, unknown>>),
        fetch('/api/bind/status').then(r=>r.json() as Promise<Record<string, unknown>>),
      ]);
      setTokens(t.error ? null : t as unknown as TokenData);
      setOrders((o.orders ?? []) as unknown as Order[]);
      setSub((s.subscription ?? null) as unknown as SubData | null);
      setConvs((c.conversations ?? []) as unknown as ConvItem[]);
      setBindStatus(b.error ? null : b as unknown as BindStatus);
      setLoading(false);
    }
    load();
  }, []);

  const startSession = async () => {
    await fetch('/api/auth/web-session', { method: 'POST' });
    window.location.reload();
  };

  if (loading) return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-slate-400 text-sm">加载中...</div>;
  if (needSession) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center text-slate-100 font-sans">
        <div className="text-center space-y-4">
          <Sparkles className="w-10 h-10 text-amber-300 mx-auto" />
          <p className="text-slate-400 text-sm">请先创建会话开始体验</p>
          <button onClick={startSession} className="px-6 py-2.5 text-sm font-bold text-slate-950 bg-amber-400 rounded-full hover:bg-amber-500">开始体验</button>
        </div>
      </div>
    );
  }

  const isBound = bindStatus?.status === 'bound' || bindStatus?.is_bound === true;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        <div className="flex items-center gap-3 mb-6"><Sparkles className="w-6 h-6 text-amber-300" /><h1 className="text-2xl font-bold text-white">我的仪表盘</h1></div>

        <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 space-y-3">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">用户状态</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-slate-500">ID</span><p className="text-white font-mono">{user?.id ?? '--'}</p></div>
            <div><span className="text-slate-500">状态</span><p className="text-emerald-400">{user?.status ?? '--'}</p></div>
            <div>
              <span className="text-slate-500">绑定</span>
              {isBound ? (
                <p className="text-emerald-400">已绑定 <span className="text-xs text-slate-500">{bindStatus?.masked_external_id ?? ''}</span></p>
              ) : (
                <p className="text-amber-400">未绑定 <Link href="/bind" className="text-xs text-amber-300 underline">前往绑定</Link></p>
              )}
            </div>
            <div><span className="text-slate-500">订阅</span><p className="text-slate-400">{sub?.plan ?? '免费体验'} ({sub?.status ?? 'active'})</p></div>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2"><Coins className="w-4 h-4 text-amber-400" />Token 余额</h2>
          <div className="flex items-baseline gap-2"><span className="text-4xl font-extrabold text-amber-300">{tokens ? (tokens.token_balance/1000).toFixed(1) : '0'}k</span><span className="text-xs text-slate-500">tokens</span></div>
          <div className="flex gap-4 text-xs text-slate-400"><span>🟢 {tokens ? (tokens.total_purchased/1000).toFixed(1) : '0'}k 购入</span><span>🔴 {tokens ? (tokens.total_used/1000).toFixed(1) : '0'}k 消耗</span></div>
          <Link href="/pay" className="inline-flex items-center gap-1 text-xs font-bold text-slate-950 bg-amber-400 px-4 py-2 rounded-full hover:bg-amber-500">充值 <ArrowRight className="w-3 h-3" /></Link>
        </div>

        <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 space-y-3">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2"><MessageSquare className="w-4 h-4 text-slate-400" />最近对话</h2>
          {convs.length === 0 ? <p className="text-xs text-slate-500">暂无对话</p> : convs.map((c, i) => (
            <div key={i} className="border-b border-white/5 pb-2 text-xs">
              <span className={`font-bold ${c.role==='user'?'text-amber-400':'text-indigo-300'}`}>{c.role==='user'?'你':'小王子'}:</span>
              <span className="text-slate-400 ml-1 line-clamp-1">{c.content}</span>
              <span className="text-slate-600 float-right">{c.total_tokens}t</span>
            </div>
          ))}
        </div>

        <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 space-y-3">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2"><Clock className="w-4 h-4 text-slate-400" />最近订单</h2>
          {orders.length===0 ? <p className="text-xs text-slate-500">暂无订单</p> : orders.slice(0,5).map(o=>(
            <div key={o.order_id} className="flex justify-between text-xs border-b border-white/5 pb-2">
              <span className="text-slate-400 font-mono">{o.order_id.slice(-12)}</span><span className="text-slate-300">{o.plan}</span>
              <span className="text-amber-400">¥{(o.amount_cents/100).toFixed(0)}</span>
              <span className={o.status==='paid'?'text-emerald-400':'text-slate-500'}>{o.status}</span>
            </div>
          ))}
        </div>
        <div className="text-center"><Link href="/" className="text-xs text-slate-500 hover:text-amber-400 underline">← 返回首页</Link></div>
      </div>
    </div>
  );
}
