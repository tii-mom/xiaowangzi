'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, Coins, Clock, ArrowRight, MessageSquare, Target, CheckCircle2, Share2 } from 'lucide-react';

interface UserInfo { id: number; token_balance: number; status: string; created_at: string; }
interface TokenData { token_balance: number; total_purchased: number; total_used: number; }
interface Order { order_id: string; plan: string; amount_cents: number; tokens_amount: number; status: string; created_at: string; }
interface SubData { plan: string; status: string; started_at: string; expires_at: string | null; }
interface ConvItem { role: string; content: string; total_tokens: number; created_at: string; }
interface BindStatus { status?: string; is_bound?: boolean; masked_external_id?: string | null; }
interface GrowthToday {
  has_goal: boolean;
  goal: {
    title: string;
    change_target: string;
    anti_vision: string;
    minimum_viable_vision: string;
  } | null;
  practice: {
    day_number: number;
    daily_lever: string;
    status: string;
    streak_count: number;
  } | null;
  latest_reflection: {
    completed_text: string;
    tacit_insight: string;
    next_adjustment: string;
    created_at: string;
  } | null;
  streak_count: number;
  completed_days: number;
}

export default function DashboardPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [tokens, setTokens] = useState<TokenData | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [sub, setSub] = useState<SubData | null>(null);
  const [convs, setConvs] = useState<ConvItem[]>([]);
  const [bindStatus, setBindStatus] = useState<BindStatus | null>(null);
  const [growth, setGrowth] = useState<GrowthToday | null>(null);
  const [completedText, setCompletedText] = useState('');
  const [tacitInsight, setTacitInsight] = useState('');
  const [nextAdjustment, setNextAdjustment] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [submittingGrowth, setSubmittingGrowth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [needSession, setNeedSession] = useState(false);

  useEffect(() => {
    async function load() {
      const u = await fetch('/api/user/me');
      if (u.status === 401) { setNeedSession(true); setLoading(false); return; }
      const uData = await u.json() as Record<string, unknown>;
      if (uData.error) { setNeedSession(true); setLoading(false); return; }
      setUser(uData as unknown as UserInfo);

      const [t, o, s, c, b, g] = await Promise.all([
        fetch('/api/user/tokens').then(r=>r.json() as Promise<Record<string, unknown>>),
        fetch('/api/user/orders').then(r=>r.json() as Promise<Record<string, unknown>>),
        fetch('/api/user/subscription').then(r=>r.json() as Promise<Record<string, unknown>>),
        fetch('/api/user/conversations?limit=5').then(r=>r.json() as Promise<Record<string, unknown>>),
        fetch('/api/bind/status').then(r=>r.json() as Promise<Record<string, unknown>>),
        fetch('/api/growth/today').then(r=>r.json() as Promise<Record<string, unknown>>),
      ]);
      setTokens(t.error ? null : t as unknown as TokenData);
      setOrders((o.orders ?? []) as unknown as Order[]);
      setSub((s.subscription ?? null) as unknown as SubData | null);
      setConvs((c.conversations ?? []) as unknown as ConvItem[]);
      setBindStatus(b.error ? null : b as unknown as BindStatus);
      setGrowth(g.error ? null : g as unknown as GrowthToday);
      setLoading(false);
    }
    load();
  }, []);

  const startSession = async () => {
    await fetch('/api/auth/web-session', { method: 'POST' });
    window.location.reload();
  };

  const submitReflection = async () => {
    if (!completedText.trim() || !tacitInsight.trim() || !nextAdjustment.trim()) return;
    setSubmittingGrowth(true);
    try {
      const res = await fetch('/api/growth/reflection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completed_text: completedText,
          tacit_insight: tacitInsight,
          next_adjustment: nextAdjustment,
        }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!data.error) {
        setGrowth(data as unknown as GrowthToday);
        setCompletedText('');
        setTacitInsight('');
        setNextAdjustment('');
      }
    } finally {
      setSubmittingGrowth(false);
    }
  };

  const createShareCard = async () => {
    setSubmittingGrowth(true);
    try {
      const res = await fetch('/api/share/growth-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          progress_note: growth?.latest_reflection?.tacit_insight ?? '',
        }),
      });
      const data = await res.json() as Record<string, unknown>;
      const publicUrl = String(data.public_url ?? '');
      if (publicUrl) {
        setShareUrl(publicUrl);
        await navigator.clipboard?.writeText(publicUrl).catch(() => {});
      }
    } finally {
      setSubmittingGrowth(false);
    }
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

        <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 space-y-5">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Target className="w-4 h-4 text-amber-400" />今日进化
          </h2>
          {!growth?.has_goal ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">还没有 Z-27 进化地图。先完成 3 分钟目标诊断，再开始每日微行动。</p>
              <Link href="/#section-growth-onboarding" className="inline-flex items-center gap-1 text-xs font-bold text-slate-950 bg-amber-400 px-4 py-2 rounded-full hover:bg-amber-500">
                生成进化地图 <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-2xl border border-amber-300/20 bg-[#020617] p-4 space-y-3">
                <div className="flex justify-between gap-4">
                  <div>
                    <span className="text-xs text-slate-500">目标</span>
                    <p className="text-white font-bold mt-1">{growth.goal?.title}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500">连续</span>
                    <p className="text-amber-300 font-black text-2xl">{growth.streak_count}天</p>
                  </div>
                </div>
                <p className="text-sm text-amber-100"><span className="text-slate-500">今日微行动：</span>{growth.practice?.daily_lever}</p>
                {growth.latest_reflection && (
                  <p className="text-xs text-slate-400"><span className="text-slate-500">最近洞察：</span>{growth.latest_reflection.tacit_insight}</p>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-xs text-slate-500">晚间复盘只问 3 句：做了什么、学到什么、下一步怎么调。</p>
                <input value={completedText} onChange={(e)=>setCompletedText(e.target.value)} placeholder="今天完成了什么？" className="w-full bg-[#020617] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:border-amber-300/50" />
                <input value={tacitInsight} onChange={(e)=>setTacitInsight(e.target.value)} placeholder="你从行动中学到了什么？" className="w-full bg-[#020617] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:border-amber-300/50" />
                <input value={nextAdjustment} onChange={(e)=>setNextAdjustment(e.target.value)} placeholder="下一步怎么调整？" className="w-full bg-[#020617] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:border-amber-300/50" />
                <div className="flex flex-col sm:flex-row gap-2">
                  <button onClick={submitReflection} disabled={submittingGrowth} className="inline-flex items-center justify-center gap-1 text-xs font-bold text-slate-950 bg-amber-400 px-4 py-2 rounded-full hover:bg-amber-500 disabled:opacity-60">
                    <CheckCircle2 className="w-3 h-3" />提交复盘
                  </button>
                  <button onClick={createShareCard} disabled={submittingGrowth} className="inline-flex items-center justify-center gap-1 text-xs font-bold text-amber-200 border border-amber-300/30 px-4 py-2 rounded-full hover:bg-amber-300/10 disabled:opacity-60">
                    <Share2 className="w-3 h-3" />生成分享卡
                  </button>
                </div>
                {shareUrl && (
                  <p className="text-xs text-slate-400 break-all">公开分享链接：<a href={shareUrl} target="_blank" rel="noreferrer" className="text-amber-300 underline">{shareUrl}</a></p>
                )}
              </div>
            </div>
          )}
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
