'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Lock } from 'lucide-react';
import MoonlightAvatar from './avatars/MoonlightAvatar';
import DiaryAvatar from './avatars/DiaryAvatar';
import RainyListeningAvatar from './avatars/RainyListeningAvatar';
import MorningSunshineAvatar from './avatars/MorningSunshineAvatar';

interface AvatarBlindBoxProps {
  onToast: (msg: string) => void;
  onAlert: (title: string, message: string) => void;
}

export default function AvatarBlindBox({ onToast, onAlert }: AvatarBlindBoxProps) {
  const [blindBoxStatus, setBlindBoxStatus] = useState<'closed' | 'shaking' | 'opened'>('closed');
  const [openedAvatarId, setOpenedAvatarId] = useState<number | null>(null);
  const [ownedAvatars, setOwnedAvatars] = useState<Record<number, boolean>>({
    1: true,
    2: false,
    3: false,
    4: false,
  });

  const openBlindBox = () => {
    if (blindBoxStatus === 'shaking') return;
    setBlindBoxStatus('shaking');
    onToast("⏳ 正在轻轻摇晃盲盒，注入星河微光...");

    setTimeout(() => {
      const lockedIds = [2, 3, 4].filter(id => !ownedAvatars[id]);
      let chosenId: number;

      if (lockedIds.length > 0) {
        chosenId = lockedIds[Math.floor(Math.random() * lockedIds.length)];
      } else {
        chosenId = Math.floor(Math.random() * 4) + 1;
      }

      setOpenedAvatarId(chosenId);
      setOwnedAvatars(prev => ({ ...prev, [chosenId]: true }));
      setBlindBoxStatus('opened');

      const avatarName = chosenId === 1 ? "月光陪伴小王子" : chosenId === 2 ? "深夜日记小王子" : chosenId === 3 ? "雨夜倾听小王子" : "晨光能量小王子";
      onToast(`🎉 恭喜开箱成功！你解封了纪念款头像：【${avatarName}】`);
    }, 1500);
  };

  const getAvatarName = (id: number) => {
    switch (id) {
      case 1: return "月光陪伴小王子";
      case 2: return "深夜日记小王子";
      case 3: return "雨夜倾听小王子";
      case 4: return "晨光能量小王子";
      default: return "";
    }
  };

  const getAvatarTagline = (id: number) => {
    switch (id) {
      case 1: return "在黑夜最深时刻做一盏床头烛";
      case 2: return "诚实笔耕出不曾对外说的心声";
      case 3: return "用澄澈心思安稳过滤窗外暴雨";
      case 4: return "在清晨带给你温柔的调频活力";
      default: return "";
    }
  };

  const getRarity = (id: number) => {
    switch (id) {
      case 4: return { label: "限定 LMT", className: "text-[8px] sm:text-[9px] font-bold bg-[#fcd34d]/10 text-[#fcd34d] border border-[#fcd34d]/20 uppercase tracking-widest animate-pulse font-sans" };
      case 2: return { label: "稀有 RARE", className: "text-[8px] sm:text-[9px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20 uppercase tracking-widest font-sans" };
      default: return { label: "普通 COM", className: "text-[8px] sm:text-[9px] font-bold bg-[#020617] text-slate-400 uppercase tracking-widest font-sans border border-white/5" };
    }
  };

  const getAvatarComponent = (id: number) => {
    switch (id) {
      case 1: return <MoonlightAvatar />;
      case 2: return <DiaryAvatar />;
      case 3: return <RainyListeningAvatar />;
      case 4: return <MorningSunshineAvatar />;
      default: return null;
    }
  };

  const getBorderColor = (id: number) => {
    switch (id) {
      case 1: return "hover:border-yellow-400/40 hover:shadow-[0_20px_40px_-15px_rgba(252,211,77,0.18)]";
      case 2: return "hover:border-purple-400/50 hover:shadow-[0_20px_40px_-15px_rgba(168,85,247,0.2)]";
      case 3: return "hover:border-blue-400/50 hover:shadow-[0_20px_40px_-15px_rgba(59,130,246,0.2)]";
      case 4: return "hover:border-amber-400/55 hover:shadow-[0_20px_40px_-15px_rgba(251,191,36,0.2)]";
      default: return "";
    }
  };

  const getHoverTextColor = (id: number) => {
    switch (id) {
      case 1: return "group-hover:text-amber-300";
      case 2: return "group-hover:text-purple-300";
      case 3: return "group-hover:text-blue-300";
      case 4: return "group-hover:text-amber-300";
      default: return "";
    }
  };

  const ownedCount = Object.values(ownedAvatars).filter(Boolean).length;
  const unlockPercent = Math.round((ownedCount / 4) * 100);

  return (
    <section className="space-y-8" id="section-avatar">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/15 pb-5">
        <div className="space-y-1.5 text-left">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-widest uppercase">
              星空共振头像盲盒
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            完成微信机器人绑定，即可随机开启一个专属于你的星球小王子头像。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] sm:text-xs px-2.5 py-1 rounded bg-[#fcd34d]/10 text-[#fcd34d] border border-[#fcd34d]/20 font-bold shrink-0">
            ⭐ MVP 测试无门槛免费开启
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-900/60 via-[#0a0f2d]/80 to-indigo-950/60 border border-white/10 rounded-[2rem] p-6 sm:p-8 flex flex-col justify-between space-y-6 relative overflow-hidden backdrop-blur-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/5 blur-3xl pointer-events-none" />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 uppercase tracking-widest leading-none">
                Starry Capsule
              </span>
              <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-300 animate-pulse" />
                <span>MVP Sandbox</span>
              </span>
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight font-sans">星空盲盒抽取</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              小王子将他在各个奇遇星球中留下的治愈身影化成了 4 种纪念徽记。点击下方注入星河灵气，摇一摇解锁所有的卡片收藏柜！
            </p>
          </div>

          <div className="py-6 flex items-center justify-center relative min-h-[160px]">
            {blindBoxStatus === 'closed' && (
              <motion.div 
                whileHover={{ scale: 1.05 }}
                onClick={openBlindBox}
                className="cursor-pointer relative group flex flex-col items-center"
              >
                <div className="absolute -inset-4 rounded-full bg-indigo-500/10 blur-xl group-hover:bg-indigo-500/20 transition-all animate-[pulse_2.5s_infinite]" />
                <svg viewBox="0 0 100 100" className="w-32 h-32 text-amber-300 drop-shadow-2xl">
                  <g transform="translate(10, 10)">
                    <defs>
                      <radialGradient id="boxGlow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#fcd34d" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#312e81" stopOpacity="0" />
                      </radialGradient>
                    </defs>
                    <circle cx="40" cy="40" r="35" fill="url(#boxGlow)" />
                    <polygon points="40,2 75,20 75,60 40,78 5,60 5,20" fill="#1e1e38" stroke="#ca8a04" strokeWidth="2.5" />
                    <path d="M 40,2 L 40,78" stroke="#fcd34d" strokeWidth="2" strokeDasharray="3 3" />
                    <path d="M 5,20 L 75,60" stroke="#fcd34d" strokeWidth="1.5" opacity="0.5" />
                    <path d="M 5,60 L 75,20" stroke="#fcd34d" strokeWidth="1.5" opacity="0.5" />
                    <ellipse cx="40" cy="28" rx="8" ry="4" fill="none" stroke="#fcd34d" strokeWidth="2.5" />
                    <polygon points="40,28 35,42 45,42" fill="#ca8a04" />
                    <circle cx="40" cy="40" r="10" fill="#fcd34d" />
                    <circle cx="40" cy="40" r="6" fill="#0f172a" stroke="#ca8a04" strokeWidth="1" />
                    <polygon points="40,36 43,43 37,43" fill="#fcd34d" />
                    <circle cx="15" cy="15" r="1.5" fill="#ffffff" />
                    <circle cx="68" cy="15" r="2" fill="#fcd34d" className="animate-pulse" />
                    <circle cx="65" cy="65" r="1.5" fill="#ffffff" />
                    <circle cx="15" cy="55" r="2.5" fill="#818cf8" />
                  </g>
                </svg>
                <span className="text-[11px] text-amber-300 font-bold tracking-wide mt-3 animate-pulse font-sans">点击注入星尘，开启陪伴盲盒</span>
              </motion.div>
            )}

            {blindBoxStatus === 'shaking' && (
              <motion.div 
                animate={{ 
                  x: [0, -8, 8, -6, 6, -4, 4, 0],
                  y: [0, -4, 4, -3, 3, -2, 2, 0],
                  rotate: [0, -5, 5, -3, 3, -1, 1, 0]
                }}
                transition={{ 
                  duration: 0.6, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="flex flex-col items-center"
              >
                <svg viewBox="0 0 100 100" className="w-32 h-32 text-amber-300 filter drop-shadow-2xl">
                  <g transform="translate(10, 10)">
                    <polygon points="40,2 75,20 75,60 40,78 5,60 5,20" fill="#312e81" stroke="#fbbf24" strokeWidth="3" />
                    <circle cx="40" cy="40" r="12" fill="#fbbf24" />
                    <circle cx="40" cy="40" r="8" fill="#1e1e2f" />
                    <line x1="40" y1="20" x2="40" y2="10" stroke="#fbbf24" strokeWidth="2" />
                    <line x1="40" y1="60" x2="40" y2="70" stroke="#fbbf24" strokeWidth="2" />
                    <line x1="20" y1="40" x2="10" y2="40" stroke="#fbbf24" strokeWidth="2" />
                    <line x1="60" y1="40" x2="70" y2="40" stroke="#fbbf24" strokeWidth="2" />
                  </g>
                </svg>
                <span className="text-[11px] text-amber-400 font-bold tracking-wide mt-3 font-sans">感知心流，正在摇晃星盒...</span>
              </motion.div>
            )}

            {blindBoxStatus === 'opened' && openedAvatarId !== null && (
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center text-center space-y-3"
              >
                <div className="relative p-1.5 rounded-3xl bg-gradient-to-tr from-[#fcd34d] via-purple-500 to-indigo-500 shadow-2xl shadow-indigo-500/20">
                  <div className="rounded-[20px] bg-slate-950 p-1 w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center overflow-hidden">
                    {getAvatarComponent(openedAvatarId)}
                  </div>
                  <span className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-[8px] font-bold bg-[#fcd34d] text-slate-950 uppercase tracking-widest shadow-md font-sans">
                    {openedAvatarId === 4 ? "限定 LMT" : openedAvatarId === 2 ? "稀有 RARE" : "普通 COM"}
                  </span>
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs sm:text-sm font-bold text-white">恭喜契约指引【{getAvatarName(openedAvatarId)}】</h4>
                  <p className="text-[10px] text-slate-400 leading-normal italic px-2 font-sans">
                    “{getAvatarTagline(openedAvatarId)}”
                  </p>
                </div>
                <div className="flex gap-2 pt-1.5">
                  <button 
                    onClick={() => onToast("📲 该头像已模拟打包生成！已长传至微信绑定微相册 🌸")}
                    className="px-3.5 py-1.5 text-[10px] font-bold text-slate-950 bg-[#fcd34d] hover:bg-[#fbbf24] rounded-lg transition-all cursor-pointer transform active:scale-95 shadow font-sans"
                  >
                    保存至微头像
                  </button>
                  <button 
                    onClick={() => setBlindBoxStatus('closed')}
                    className="px-3 py-1.5 text-[10px] text-slate-300 hover:text-white border border-white/10 hover:bg-white/5 rounded-lg transition-colors cursor-pointer font-sans"
                  >
                    再开一次
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          <div className="border-t border-white/5 pt-3.5 flex items-center justify-between text-[11px] text-slate-500 font-sans">
            <span>我的收集进度：</span>
            <span className="font-mono text-amber-300 font-bold text-xs">
              {unlockPercent}%
            </span>
            <span className="text-[10px] text-slate-600">({ownedCount}/4 已解封)</span>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-4 flex flex-col justify-between">
          <div className="text-left space-y-1">
            <h4 className="text-sm font-bold text-slate-200 tracking-wide font-sans">我的专属徽章柜</h4>
            <p className="text-[10px] sm:text-xs text-slate-500 leading-relaxed font-sans">
              已解锁的徽章头像呈现绚丽极光色彩，未解锁的处于加密状态。<strong>点击已解锁的卡片，听一听小王子的悄悄话吧！</strong>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((id) => {
              const rarity = getRarity(id);
              const owned = ownedAvatars[id];
              return (
                <div 
                  key={id}
                  onClick={() => {
                    if (!owned) {
                      onToast("🔒 锁定中，可通过左边「星空盲盒」完成抽取，或进行全流程体验即可解锁。");
                      return;
                    }
                    const messages: Record<number, [string, string]> = {
                      1: ["🌙 【月光陪伴小王子 - 星空奇遇寄语】", "“你知道吗？在深夜如果你觉得全世界都睡去了，你可以来敲敲我的门。我从来不会怪你打扰，因为星星，本就是为了衬托黑夜的深度而亮起的呀。晚安，我亲爱的朋友。”"],
                      2: ["✒️ 【深夜日记小王子 - 星空奇遇寄语】", "“别把叹气的真心话给抹去了。写在纸面上的哪怕是泪痕，也是灵魂活过一整天的结晶。诚使地面对自己的脆弱，是我们走回行动的最宽护网。我今晚继续陪你写日记。”"],
                      3: ["🌧️ 【雨夜倾听小王子 - 星空奇遇寄语】", "“外面又落起大雨了呢。别害怕狂风雨水，我们的玻璃罩子很脆弱，但因为我们懂得彼此呵护，这雨水只会用来滋养你坚固的根。尽情倾吐一切不快吧，我就隔着大雨静静倾听。”"],
                      4: ["☀️ 【晨光能量小王子 - 晨星元气调频】", "“清晨醒来，这是独家送你的晨间能量调频。新的一天，不必焦虑去追赶谁，安稳地在这个微信里呼吸，感受被星空温柔偏爱的力量。今天，整个世界都在默默替你加油。”"],
                    };
                    const [title, msg] = messages[id];
                    onAlert(title, msg);
                  }}
                  className={`relative p-4 sm:p-5 text-center space-y-3 rounded-2xl border transition-all duration-505 ease-out select-none overflow-visible group ${owned ? `bg-gradient-to-b from-slate-900/60 via-slate-950/70 to-slate-950/95 shadow-md hover:-translate-y-1.5 cursor-pointer ${getBorderColor(id)}` : 'bg-white/5 border-white/5 opacity-40'}`}
                >
                  {owned && (
                    <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-yellow-400/15 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-lg pointer-events-none -z-10" />
                  )}
                  <div className={`absolute top-2 right-2 px-1 rounded ${rarity.className}`}>
                    {rarity.label}
                  </div>
                  <div className={`mx-auto rounded-2xl bg-[#020617]/85 p-2 border border-white/10 w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center transition-all duration-300 relative ${!owned ? 'grayscale' : 'group-hover:scale-105'}`}>
                    {!owned ? (
                      <Lock className="w-5 h-5 text-slate-600 animate-pulse" />
                    ) : (
                      <>
                        <div className="absolute inset-0 rounded-2xl bg-yellow-400/5 animate-pulse" />
                        {getAvatarComponent(id)}
                      </>
                    )}
                  </div>
                  <div>
                    <h5 className={`text-xs sm:text-sm font-bold text-white tracking-wide font-sans transition-colors ${owned ? getHoverTextColor(id) : ''}`}>{getAvatarName(id)}</h5>
                    <p className="text-[10px] text-slate-400 mt-1 font-sans">{getAvatarTagline(id)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="text-center pt-2">
        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed font-sans">
          连续 7 天在客户端与机器人会合或达成日常小行动，即可激活藏品成就。完成 30 天灵魂重建计划，可于微信端同步享有所有至臻徽记凭证。
        </p>
        <button 
          onClick={() => {
            const el = document.getElementById('section-avatar');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          className="mt-4 px-5 py-2 text-xs font-semibold rounded-full border border-white/10 hover:border-[#fcd34d]/40 text-slate-400 hover:text-[#fcd34d] transition-all cursor-pointer font-sans"
        >
          已停留在专属头像展示馆 • 探索奇遇
        </button>
      </div>
    </section>
  );
}
