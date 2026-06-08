'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowRight, Sparkles } from 'lucide-react';

interface PublicArtifact {
  slug: string;
  title: string;
  goal_theme: string;
  day_number: number;
  today_action: string;
  progress_note: string;
  public_summary: string;
}

export default function SharePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [artifact, setArtifact] = useState<PublicArtifact | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/share/growth-card?slug=${encodeURIComponent(slug)}`)
      .then((res) => {
        if (res.status === 404) setNotFound(true);
        return res.json() as Promise<Record<string, unknown>>;
      })
      .then((data) => {
        if (cancelled) return;
        if (data.artifact) setArtifact(data.artifact as PublicArtifact);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });
    return () => { cancelled = true; };
  }, [slug]);

  const startHref = artifact
    ? `/?share_artifact_id=${encodeURIComponent(artifact.slug)}#section-growth-onboarding`
    : '/#section-growth-onboarding';

  return (
    <main className="min-h-[100dvh] bg-[#020617] text-slate-100 font-sans px-4 py-10">
      <div className="max-w-xl mx-auto space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-300 text-slate-950 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-amber-300 font-mono tracking-widest uppercase">Z-27 Growth Card</p>
            <h1 className="text-xl font-bold text-white">一张公开的进化地图</h1>
          </div>
        </div>

        {notFound ? (
          <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 text-center space-y-4">
            <h2 className="text-lg font-bold text-white">分享卡不存在或已失效</h2>
            <Link href="/#section-growth-onboarding" className="inline-flex items-center justify-center rounded-full bg-amber-300 px-5 py-2.5 text-sm font-bold text-slate-950">
              生成我的进化地图
            </Link>
          </section>
        ) : !artifact ? (
          <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 text-center text-sm text-slate-400">
            正在读取分享卡...
          </section>
        ) : (
          <>
            <section className="rounded-3xl border border-amber-300/20 bg-slate-900/70 p-6 sm:p-8 shadow-2xl shadow-amber-950/20 space-y-6">
              <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <p className="text-xs text-slate-500">目标主题</p>
                  <h2 className="text-2xl font-black text-white mt-1">{artifact.goal_theme}</h2>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">DAY</p>
                  <p className="text-4xl font-black text-amber-300">{artifact.day_number}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">今日微行动</p>
                  <p className="text-base text-slate-100 leading-relaxed">{artifact.today_action}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">公开进步</p>
                  <p className="text-base text-amber-100 leading-relaxed">{artifact.progress_note}</p>
                </div>
              </div>

              <div className="rounded-2xl bg-[#020617] border border-white/10 p-4">
                <p className="text-sm text-slate-300 leading-relaxed">{artifact.public_summary}</p>
              </div>
            </section>

            <div className="space-y-3 text-center">
              <Link
                href={startHref}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-300 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-amber-400 transition-colors"
              >
                我也生成进化地图
                <ArrowRight className="w-4 h-4" />
              </Link>
              <p className="text-xs text-slate-500">
                分享卡不会公开聊天原文、微信标识、订单或余额。
              </p>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
