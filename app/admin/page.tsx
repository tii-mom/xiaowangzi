'use client';

import React, { useEffect, useState } from 'react';
import { Shield, Users, ShoppingCart, Coins, Activity } from 'lucide-react';

interface Overview {
  users_count: number; orders_count: number; paid_orders_count: number;
  revenue_cents: number; token_purchased_sum: number; token_used_sum: number;
  recent_orders: Array<Record<string, unknown>>; recent_events: Array<Record<string, unknown>>;
  recent_users: Array<Record<string, unknown>>;
}

export default function AdminPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');

  useEffect(() => {
    const saved = sessionStorage.getItem('admin_token');
    if (saved) setToken(saved);
    setLoading(false);
  }, []);

  const fetchData = (adminToken: string) => {
    setLoading(true);
    fetch('/api/admin/overview', {
      headers: { 'x-admin-token': adminToken },
    }).then((r) => r.json()).then((d) => {
      if (d.error) { setError(d.error); setData(null); }
      else { setData(d); setError(''); sessionStorage.setItem('admin_token', adminToken); }
    }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim()) fetchData(token.trim());
  };

  if (loading && !data && !error) {
    return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-slate-400 text-sm">加载中...</div>;
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-6 h-6 text-amber-300" />
          <h1 className="text-2xl font-bold text-white">管理后台</h1>
          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">只读</span>
        </div>

        {!data && (
          <form onSubmit={handleSubmit} className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 space-y-4">
            <p className="text-sm text-slate-400">请输入管理 Token</p>
            <input
              type="password" value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full bg-[#020617] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-amber-500/50 outline-none"
              placeholder="ADMIN_TOKEN"
            />
            <button type="submit" className="px-6 py-2 text-xs font-bold text-slate-950 bg-amber-400 rounded-full hover:bg-amber-500">确认</button>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </form>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 text-center">
                <Users className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                <p className="text-2xl font-bold text-white">{data.users_count ?? 0}</p><p className="text-xs text-slate-500">用户总数</p>
              </div>
              <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 text-center">
                <ShoppingCart className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                <p className="text-2xl font-bold text-white">{data.paid_orders_count ?? 0}</p><p className="text-xs text-slate-500">已支付订单</p>
              </div>
              <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 text-center">
                <Coins className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                <p className="text-2xl font-bold text-amber-300">¥{((data.revenue_cents as number)/100).toFixed(0)}</p><p className="text-xs text-slate-500">总收入</p>
              </div>
              <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 text-center">
                <Activity className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                <p className="text-2xl font-bold text-emerald-300">{(data.token_purchased_sum as number/1000).toFixed(1)}k</p><p className="text-xs text-slate-500">Token购入</p>
              </div>
              <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 text-center">
                <Activity className="w-5 h-5 text-red-400 mx-auto mb-1" />
                <p className="text-2xl font-bold text-red-300">{(data.token_used_sum as number/1000).toFixed(1)}k</p><p className="text-xs text-slate-500">Token消耗</p>
              </div>
              <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 text-center">
                <ShoppingCart className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                <p className="text-2xl font-bold text-white">{data.orders_count ?? 0}</p><p className="text-xs text-slate-500">订单总数</p>
              </div>
            </div>
            <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 space-y-2">
              <h2 className="text-xs font-bold text-slate-400 uppercase">最近系统事件</h2>
              {(data.recent_events as Array<Record<string,unknown>>).slice(0,10).map((e,i)=>(
                <div key={i} className="text-xs text-slate-500 font-mono flex gap-3">
                  <span className="text-amber-500 shrink-0">{e.type as string}</span>
                  <span className="text-slate-400 truncate">{JSON.stringify(e.payload).slice(0,80)}</span>
                </div>
              ))}
            </div>
            <button onClick={() => { setData(null); setError(''); sessionStorage.removeItem('admin_token'); }} className="text-xs text-slate-500 hover:text-amber-400 underline">切换Token</button>
          </>
        )}
        <div className="text-center"><a href="/" className="text-xs text-slate-500 hover:text-amber-400 underline">← 返回首页</a></div>
      </div>
    </div>
  );
}
