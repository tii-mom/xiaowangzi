'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Moon, BookOpen } from 'lucide-react';

interface NightQuestionsProps {
  onToast: (msg: string) => void;
}

export default function NightQuestions({ onToast }: NightQuestionsProps) {
  const [nightPhase, setNightPhase] = useState<'intro' | 'q1' | 'q2' | 'q3' | 'result'>('intro');
  const [nightAnswers, setNightAnswers] = useState({ q1: '', q2: '', q3: '' });
  const [currentInputText, setCurrentInputText] = useState('');

  const handleNightNext = () => {
    if (nightPhase === 'q1') {
      if (!currentInputText.trim()) {
        onToast("写一句真实的触动就可以，哪怕只有几个字。");
        return;
      }
      setNightAnswers(prev => ({ ...prev, q1: currentInputText }));
      setCurrentInputText('');
      setNightPhase('q2');
    } else if (nightPhase === 'q2') {
      if (!currentInputText.trim()) {
        onToast("在生活的镜子里，总有些事情在循环。写下来吧。");
        return;
      }
      setNightAnswers(prev => ({ ...prev, q2: currentInputText }));
      setCurrentInputText('');
      setNightPhase('q3');
    } else if (nightPhase === 'q3') {
      if (!currentInputText.trim()) {
        onToast("诚实是照向黑夜的第一束光，写下来，我就在你身旁。");
        return;
      }
      setNightAnswers(prev => ({ ...prev, q3: currentInputText }));
      setCurrentInputText('');
      setNightPhase('result');
      onToast("🌌 三问完成。小王子把你的回答揉成了一颗遥远星光的燃料。");
    }
  };

  const resetNightSim = () => {
    setNightPhase('intro');
    setNightAnswers({ q1: '', q2: '', q3: '' });
    setCurrentInputText('');
  };

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 sm:p-6 transition-all shadow-md relative group flex flex-col justify-between">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="px-3 py-1 text-xs font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/20 rounded-full flex items-center gap-1">
            <Moon className="w-3.5 h-3.5 text-purple-450 shrink-0" />
            <span>晚上：3 个内心问题</span>
          </div>
          <span className="text-xs font-mono text-slate-500">09:30 PM</span>
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-slate-100">复盘自我，剥开日常假面</h3>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            小王子每天晚上精选3个触及本质的提问。从情绪、模式、到不敢面对的真相，引领你在深夜进行温柔对话。
          </p>
        </div>
        <div className="mt-4 p-4 rounded-xl bg-[#020617]/90 border border-purple-500/20 space-y-3 relative">
          <div className="absolute top-1 right-2 text-[9px] font-mono text-purple-400/40 uppercase">
            Diary Sync
          </div>
          {nightPhase === 'intro' && (
            <div className="space-y-3.5 text-center py-2">
              <p className="text-xs text-slate-400 leading-relaxed">
                小王子已在微信里向你道来 3 个晚间问题：
              </p>
              <button 
                onClick={() => setNightPhase('q1')}
                className="w-full py-3 text-xs sm:text-sm font-bold bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl cursor-pointer shadow-md shadow-indigo-500/10 flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                <Moon className="w-3.5 h-3.5 shrink-0" />
                <span>开始倾听并作答</span>
              </button>
            </div>
          )}
          {(nightPhase === 'q1' || nightPhase === 'q2' || nightPhase === 'q3') && (
            <div className="space-y-3 text-left">
              <div className="flex items-center justify-between text-[11px] text-purple-300 font-mono">
                <span>深夜问题 {nightPhase === 'q1' ? '1/3' : nightPhase === 'q2' ? '2/3' : '3/3'}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
              </div>
              <p className="text-xs text-purple-100 font-bold leading-relaxed">
                {nightPhase === 'q1' && "Q1. 今天发生让心里起伏的一件小事是什么？"}
                {nightPhase === 'q2' && "Q2. 从这件事中，你看见了自己怎样的重复模式？"}
                {nightPhase === 'q3' && "Q3. 如果不要讲道理，你此时此刻最想承认的情绪是什么？"}
              </p>
              <input 
                type="text"
                value={currentInputText}
                onChange={(e) => setCurrentInputText(e.target.value)}
                placeholder="打字简短回答（仅交互原型本地存储）"
                className="w-full bg-[#020617] border border-white/10 focus:border-[#fcd34d] px-2.5 py-1.5 rounded text-xs text-slate-200 outline-none transition-all"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNightNext();
                }}
              />
              <div className="flex gap-2 justify-end">
                <button 
                  onClick={resetNightSim}
                  className="px-2 py-1 text-[10px] text-slate-500 hover:text-slate-350 transition-colors cursor-pointer"
                >
                  返回
                </button>
                <button 
                  onClick={handleNightNext}
                  className="px-4 py-1 text-[11px] font-bold bg-indigo-500 hover:bg-indigo-600 text-white rounded cursor-pointer shadow-md shadow-indigo-500/10"
                >
                  下一问
                </button>
              </div>
            </div>
          )}
          {nightPhase === 'result' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 text-left"
            >
              <div className="text-center pb-1">
                <div className="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-mono tracking-wide">
                  ✨ 获得 B612 灵魂收档日记
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[#020617] border border-indigo-500/35 space-y-3.5 shadow-inner relative overflow-hidden">
                <div className="absolute right-[-10px] top-[-10px] text-indigo-500/10 rotate-12 select-none pointer-events-none">
                  <Moon className="w-16 h-16" />
                </div>
                <div className="space-y-3 text-[11px]">
                  <div>
                    <span className="text-slate-500 text-[10px] block font-medium">今日印记 (Q1)：</span>
                    <p className="text-slate-200 pl-2.5 border-l border-indigo-550 font-medium font-sans italic leading-relaxed">
                      “ {nightAnswers.q1} ”
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block font-medium">循环觉察 (Q2)：</span>
                    <p className="text-slate-200 pl-2.5 border-l border-indigo-550 font-medium font-sans italic leading-relaxed">
                      “ {nightAnswers.q2} ”
                    </p>
                  </div>
                  <div>
                    <span className="text-indigo-350 text-[10px] block font-semibold">内心真身 (Q3)：</span>
                    <p className="text-indigo-200 pl-2.5 border-l border-indigo-500 font-semibold font-sans italic leading-relaxed">
                      “ {nightAnswers.q3} ”
                    </p>
                  </div>
                </div>
                <div className="border-t border-indigo-500/10 pt-2 mt-2">
                  <p className="text-[10px] text-amber-200/90 leading-relaxed font-sans">
                    “你在黑夜吐露的真诚，终会化作浇灌我们星球红玫瑰的露水。晚安，勇敢的灵魂。” —— 守护者小王子
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-center pt-1">
                <button 
                  onClick={() => onToast("📲 模拟夜卡下载：今晚的心尘物语日记已成功保存至您的本地相册缓存！")}
                  className="px-3.5 py-1.5 text-[10px] font-bold text-slate-950 bg-gradient-to-r from-[#fcd34d] to-amber-400 hover:from-amber-400 hover:to-amber-500 rounded-lg cursor-pointer transform active:scale-95 transition-all shadow-md shadow-[#fcd34d]/10"
                >
                  保存星尘日记
                </button>
                <button 
                  onClick={resetNightSim}
                  className="px-3.5 py-1.5 text-[10px] text-slate-400 hover:text-white border border-white/10 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
                >
                  重新反思
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
      <div className="pt-4 border-t border-white/5 text-[11px] text-slate-500 flex items-center justify-between">
        <span>灵魂自我访谈 · 沉淀日记</span>
        <BookOpen className="w-3.5 h-3.5 text-purple-400" />
      </div>
    </div>
  );
}
