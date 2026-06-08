'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Orbit, Share2, Target } from 'lucide-react';

interface GrowthOnboardingProps {
  onToast: (msg: string) => void;
}

interface GrowthMap {
  goal?: {
    title: string;
    change_target: string;
    anti_vision: string;
    minimum_viable_vision: string;
  } | null;
  practice?: {
    day_number: number;
    daily_lever: string;
    status: string;
  } | null;
  streak_count?: number;
}

export default function GrowthOnboarding({ onToast }: GrowthOnboardingProps) {
  const [changeTarget, setChangeTarget] = useState('');
  const [antiVision, setAntiVision] = useState('');
  const [dailyLever, setDailyLever] = useState('');
  const [growthMap, setGrowthMap] = useState<GrowthMap | null>(null);
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!changeTarget.trim() || !antiVision.trim() || !dailyLever.trim()) {
      onToast('请先完成 3 个问题，答案很短也可以。');
      return;
    }

    setLoading(true);
    setShareUrl('');
    try {
      const sourceSlug = new URLSearchParams(window.location.search).get('share_artifact_id');
      const res = await fetch('/api/growth/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          change_target: changeTarget,
          anti_vision: antiVision,
          daily_lever: dailyLever,
          share_artifact_id: sourceSlug,
        }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (data.error) throw new Error(String(data.error));
      setGrowthMap(data.evolution_map as GrowthMap);
      onToast('Z-27 进化地图已生成。');
    } catch (err) {
      onToast(err instanceof Error ? err.message : '生成进化地图失败');
    } finally {
      setLoading(false);
    }
  };

  const createShareCard = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/share/growth-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          progress_note: growthMap?.practice
            ? `我从今天开始练习：${growthMap.practice.daily_lever}`
            : undefined,
        }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (data.error) throw new Error(String(data.error));
      const publicUrl = String(data.public_url ?? '');
      setShareUrl(publicUrl);
      if (navigator.clipboard && publicUrl) {
        await navigator.clipboard.writeText(publicUrl).catch(() => {});
      }
      onToast('公开分享卡已生成，链接已准备好。');
    } catch (err) {
      onToast(err instanceof Error ? err.message : '生成分享卡失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="section-growth-onboarding" className="py-2">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
        <div className="lg:col-span-5 space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-200">
            <Orbit className="w-3.5 h-3.5" />
            默会知识成长入口
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              3 分钟生成你的 Z-27 进化地图
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed max-w-lg">
              不先讲理论。先把你想改变的生活、最不想抵达的反愿景、今天能做的小行动写出来，小王子再陪你每天校准。
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs text-slate-400">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-amber-200 font-bold">示范</p>
              <p className="mt-1">给出可执行动作</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-amber-200 font-bold">反馈</p>
              <p className="mt-1">每天复盘调整</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-amber-200 font-bold">内化</p>
              <p className="mt-1">沉淀为长期能力</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 rounded-3xl border border-white/10 bg-slate-900/60 p-5 sm:p-6">
          {!growthMap ? (
            <form className="space-y-4" onSubmit={submit}>
              <Field
                label="1. 现在你最想改变什么？"
                placeholder="例如：我想停止拖延，把作品持续做出来"
                value={changeTarget}
                onChange={setChangeTarget}
              />
              <Field
                label="2. 如果继续不变，1 年后你最不想看到什么？"
                placeholder="例如：我还是只收藏方法，没有真正完成任何项目"
                value={antiVision}
                onChange={setAntiVision}
              />
              <Field
                label="3. 今天可以做的最小行动是什么？"
                placeholder="例如：打开文档写 200 字，不求完美"
                value={dailyLever}
                onChange={setDailyLever}
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-amber-300 px-5 py-3 text-sm font-black text-slate-950 hover:bg-amber-400 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
              >
                {loading ? '生成中...' : '生成我的进化地图'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-emerald-300 text-sm font-bold">
                <CheckCircle2 className="w-4 h-4" />
                Z-27 进化地图已启动
              </div>
              <div className="rounded-2xl border border-amber-300/20 bg-[#020617] p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-slate-500">目标主题</p>
                    <h3 className="text-xl font-black text-white mt-1">{growthMap.goal?.title}</h3>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">DAY</p>
                    <p className="text-3xl font-black text-amber-300">{growthMap.practice?.day_number ?? 1}</p>
                  </div>
                </div>
                <div className="space-y-3 text-sm">
                  <p className="text-slate-300">
                    <span className="text-slate-500">反愿景：</span>{growthMap.goal?.anti_vision}
                  </p>
                  <p className="text-slate-300">
                    <span className="text-slate-500">最小愿景：</span>{growthMap.goal?.minimum_viable_vision}
                  </p>
                  <p className="text-amber-100">
                    <span className="text-slate-500">今日微行动：</span>{growthMap.practice?.daily_lever}
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/dashboard" className="flex-1 rounded-full bg-white text-slate-950 px-5 py-2.5 text-center text-xs font-bold hover:bg-slate-200">
                  去 Dashboard 复盘
                </Link>
                <Link href="/bind" className="flex-1 rounded-full border border-white/15 px-5 py-2.5 text-center text-xs font-bold text-slate-200 hover:border-amber-300/40">
                  绑定微信继续
                </Link>
                <button
                  onClick={createShareCard}
                  disabled={loading}
                  className="flex-1 rounded-full border border-amber-300/30 px-5 py-2.5 text-xs font-bold text-amber-200 hover:bg-amber-300/10 disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  生成分享卡
                </button>
              </div>
              {shareUrl && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300 break-all">
                  <span className="text-slate-500">公开链接：</span>
                  <a href={shareUrl} target="_blank" rel="noreferrer" className="text-amber-200 underline">{shareUrl}</a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Field(props: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="flex items-center gap-2 text-xs font-bold text-slate-300">
        <Target className="w-3.5 h-3.5 text-amber-300" />
        {props.label}
      </span>
      <textarea
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        rows={2}
        className="w-full resize-none rounded-2xl border border-white/10 bg-[#020617] px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-amber-300/50 focus:outline-none"
      />
    </label>
  );
}
