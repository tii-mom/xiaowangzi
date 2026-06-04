'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Toast from '@/components/Toast';
import Modal from '@/components/Modal';
import Header from '@/components/Header';
import HeroSection from '@/components/HeroSection';
import ChatSimulator from '@/components/ChatSimulator';
import MorningCard from '@/components/MorningCard';
import ActionCard from '@/components/ActionCard';
import NightQuestions from '@/components/NightQuestions';
import AvatarBlindBox from '@/components/AvatarBlindBox';
import BindFlowMock from '@/components/BindFlowMock';
import PricingCards from '@/components/PricingCards';
import SafetyNote from '@/components/SafetyNote';
import Footer from '@/components/Footer';
import { PRESET_FORTUNES } from '@/lib/constants';

export default function Home() {
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setHasMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalContent, setModalContent] = useState('');

  const [isShaking, setIsShaking] = useState(false);
  const [currentFortune, setCurrentFortune] = useState<(typeof PRESET_FORTUNES)[0] | null>(null);

  const [actionDone, setActionDone] = useState(false);
  const [actionDoneMsg, setActionDoneMsg] = useState('');

  const triggerToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => prev === msg ? null : prev);
    }, 4000);
  }, []);

  const openAlert = useCallback((title: string, message: string) => {
    setModalTitle(title);
    setModalContent(message);
    setModalOpen(true);
  }, []);

  const scrollToId = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const drawFortune = useCallback(() => {
    setIsShaking(true);
    setActionDone(false);
    setTimeout(() => {
      setIsShaking(false);
      const randomIndex = Math.floor(Math.random() * PRESET_FORTUNES.length);
      setCurrentFortune(PRESET_FORTUNES[randomIndex]);
      triggerToast('⚜️ 行星电波同步成功！小王子为你生成了本日「晨间能量卡」');
    }, 1200);
  }, [triggerToast]);

  const handleActionClick = useCallback(() => {
    if (!currentFortune) {
      triggerToast('请先在上方进行能量卡校准哦！');
      return;
    }
    setActionDone(true);
    setActionDoneMsg(
      '很好。你完成的虽只是一件小事，但足够把你从空想带回扎实的身躯。今天你走在了行动的最前面。小王子为你记下了这一颗成长的星星 +1 ⭐',
    );
    triggerToast('✨ 恭喜完成行动！小王子默默记下了你们的共成长点滴');
  }, [currentFortune, triggerToast]);

  if (!hasMounted) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center font-sans text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#fcd34d]/20 border-t-[#fcd34d] animate-spin" />
          <span className="text-xs tracking-wider animate-pulse font-medium">
            B612 行星轨道连线中...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen bg-[#020617] font-sans text-slate-100 overflow-x-hidden"
      suppressHydrationWarning
    >
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[50%] rounded-full bg-blue-900/10 blur-[130px] z-0" />
        <div className="absolute top-[30%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/10 blur-[140px] z-0" />
        <div className="absolute bottom-[10%] left-[10%] w-[60%] h-[40%] rounded-full bg-emerald-950/20 blur-[120px] z-0" />
        <div className="absolute bottom-[-10%] right-[10%] w-[40%] h-[40%] rounded-full bg-indigo-950/20 blur-[110px] z-0" />
        <div className="absolute inset-0 bg-grid-white/5 opacity-40 z-0" />
        <div className="absolute top-24 left-1/4 w-1.5 h-1.5 bg-yellow-200 rounded-full animate-twinkle opacity-70" />
        <div className="absolute top-44 right-[15%] w-1 h-1 bg-white rounded-full animate-twinkle opacity-60" style={{ animationDelay: '1.2s' }} />
        <div className="absolute top-[48vh] left-[8%] w-1.5 h-1.5 bg-purple-300 rounded-full animate-twinkle opacity-50" style={{ animationDelay: '2.5s' }} />
        <div className="absolute top-[65vh] right-[25%] w-1 h-1 bg-amber-200 rounded-full animate-twinkle opacity-[0.8]" style={{ animationDelay: '0.8s' }} />
        <div className="absolute top-[85vh] left-[20%] w-1.5 h-1.5 bg-sky-200 rounded-full animate-twinkle opacity-[0.4]" style={{ animationDelay: '1.9s' }} />
        <div className="absolute top-[12vh] right-[40%] w-1 h-1 bg-teal-100 rounded-full animate-twinkle opacity-[0.9]" style={{ animationDelay: '3.1s' }} />
        <div className="absolute top-36 left-[70%] w-[2px] h-[80px] bg-gradient-to-b from-yellow-100 to-transparent animate-shooting-star opacity-10" />
        <div className="absolute top-[50vh] left-[15%] w-[2px] h-[100px] bg-gradient-to-b from-indigo-200 to-transparent animate-shooting-star opacity-[0.08]" style={{ animationDelay: '6s' }} />
      </div>

      <Toast message={toastMsg} />

      <Header onScrollTo={scrollToId} />

      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-12 space-y-16 sm:space-y-28">
        <section
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center pt-2 sm:pt-6"
          id="section-hero"
        >
          <HeroSection onScrollTo={scrollToId} />
          <ChatSimulator onToast={triggerToast} />
        </section>

        <section className="space-y-8 py-2.5" id="section-experience">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3.5xl font-extrabold tracking-tight text-white">
              小王子每天怎么陪你做到？
            </h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto">
              不提供厚重的理论，只提供晨间的态度，白天的抓手，与晚间的安宁。
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MorningCard
              onToast={triggerToast}
              currentFortune={currentFortune}
              isShaking={isShaking}
              onDrawFortune={drawFortune}
            />
            <ActionCard
              onToast={triggerToast}
              currentFortune={currentFortune}
              actionDone={actionDone}
              actionDoneMsg={actionDoneMsg}
              onActionClick={handleActionClick}
            />
            <NightQuestions onToast={triggerToast} />
          </div>
        </section>

        <section
          className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-10 relative overflow-hidden"
          id="section-30day"
        >
          <div className="absolute top-0 right-0 w-44 h-44 bg-indigo-500/5 blur-[50px] rounded-full pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-44 h-44 bg-amber-500/5 blur-[50px] rounded-full pointer-events-none" />
          <div className="max-w-3xl mx-auto space-y-10">
            <div className="text-center space-y-4">
              <span className="px-3 py-1 rounded-full bg-[#fcd34d]/10 border border-[#fcd34d]/20 text-xs font-semibold text-[#fcd34d]">
                ⭐ 灵魂重建计划
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight text-white">
                小王子的 30 个夜晚
              </h2>
              <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
                这是一个不勉强的 30 天日常自我重整访谈。小王子的每天晨问、日常小抓手与深夜对话按部就班地编排。
                你不需要回答得完美，只需要回答得真实。
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              <div className="bg-[#020617]/70 p-5 rounded-2xl border border-white/10 hover:border-[#fcd34d]/30 transition-all flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="text-xs font-mono font-bold text-[#fcd34d]">WEEK 1</div>
                  <h4 className="text-base font-semibold text-slate-200">日常与情绪</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    锚定当下，记录琐碎中那些让你心里漏拍的瞬间。学着描述，而非分析。
                  </p>
                </div>
                <div className="border-t border-white/5 pt-2 text-[10px] text-slate-500 italic">
                  探究：最近发生了什么？感觉如何？
                </div>
              </div>
              <div className="bg-[#020617]/70 p-5 rounded-2xl border border-white/10 hover:border-purple-400/30 transition-all flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="text-xs font-mono font-bold text-purple-300">WEEK 2</div>
                  <h4 className="text-base font-semibold text-slate-200">重复性模式</h4>
                  <p className="text-xs text-slate-400 leading-relaxed font-sans">
                    发现自己在人际、情绪、生活中的固有回旋。那些你不停掉入的坑是什么。
                  </p>
                </div>
                <div className="border-t border-white/5 pt-2 text-[10px] text-slate-500 italic">
                  研究：你在重演哪个旧剧本？
                </div>
              </div>
              <div className="bg-[#020617]/70 p-5 rounded-2xl border border-white/10 hover:border-emerald-400/30 transition-all flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="text-xs font-mono font-bold text-emerald-300">WEEK 3</div>
                  <h4 className="text-base font-semibold text-slate-200">深层价值观</h4>
                  <p className="text-xs text-slate-400 leading-relaxed font-sans">
                    撕下社会灌输的理想，探寻你真心愿意守护的人，以及为之付出精力的实物。
                  </p>
                </div>
                <div className="border-t border-white/5 pt-2 text-[10px] text-slate-500 italic">
                  思考：你真正无法舍弃的核心是什么？
                </div>
              </div>
              <div className="bg-[#020617]/70 p-5 rounded-2xl border border-white/10 hover:border-indigo-400/30 transition-all flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="text-xs font-mono font-bold text-indigo-300">WEEK 4</div>
                  <h4 className="text-base font-semibold text-slate-200">恐惧与真实</h4>
                  <p className="text-xs text-slate-400 leading-relaxed font-sans">
                    走到自己最脆弱的内心防线前，撕掉坚硬的伪装。认领并接纳那些不完美的执念后，舒缓才真正开始。
                  </p>
                </div>
                <div className="border-t border-white/5 pt-2 text-[10px] text-slate-500 italic">
                  深耕：如何拥抱并重塑自己？
                </div>
              </div>
            </div>
            <div className="text-center pt-2">
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                完成 30 天灵魂重建计划，可于微信端同步享有所有至臻徽记凭证。
              </p>
              <button
                onClick={() =>
                  openAlert(
                    '🪐 开启30天自我访谈里程',
                    '请先绑定 Clawbot 机器人。绑定成功后，小王子会在每天晚上 21:30 自动把当天的问候与反思清单发送至你的微信中，并记录你每一次的心流回馈，见证你漫长星河间的温暖成长。扫一扫下方模块的二维码，立刻在微信里和小王子碰面吧！',
                  )
                }
                className="mt-4 px-6 py-2.5 text-xs font-semibold rounded-full border border-white/10 hover:border-[#fcd34d]/40 text-slate-350 hover:text-[#fcd34d] transition-all cursor-pointer font-sans"
              >
                唤醒 30 日星轨记忆
              </button>
            </div>
          </div>
        </section>

        <AvatarBlindBox onToast={triggerToast} onAlert={openAlert} />

        <BindFlowMock onToast={triggerToast} onAlert={openAlert} />

        <PricingCards onAlert={openAlert} />

        <SafetyNote />
      </main>

      <Footer onToast={triggerToast} onAlert={openAlert} />

      <Modal
        open={modalOpen}
        title={modalTitle}
        content={modalContent}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
