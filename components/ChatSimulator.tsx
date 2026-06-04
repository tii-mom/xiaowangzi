'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, Sparkles, RotateCcw, Send, Smile, HelpCircle } from 'lucide-react';

interface Message {
  id: string;
  sender: 'prince' | 'user';
  text: string;
  isTyping?: boolean;
}

interface ChatSimulatorProps {
  onToast: (msg: string) => void;
}

export default function ChatSimulator({ onToast }: ChatSimulatorProps) {
  const [heroMessages, setHeroMessages] = useState<Message[]>([]);
  const [heroIsTypingIndicator, setHeroIsTypingIndicator] = useState(false);
  const [heroInputText, setHeroInputText] = useState("");
  const [heroRunAutoLoop, setHeroRunAutoLoop] = useState(true);

  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [heroMessages, heroIsTypingIndicator]);

  const sendHeroCustomMessage = useCallback((customText?: string) => {
    const textToSend = customText || heroInputText;
    if (!textToSend.trim()) return;

    setHeroRunAutoLoop(false);

    const userMsgId = `custom-user-${Date.now()}`;
    const princeMsgId = `custom-prince-${Date.now()}`;

    setHeroMessages(prev => [
      ...prev,
      { id: userMsgId, sender: 'user', text: textToSend }
    ]);
    setHeroInputText("");

    setTimeout(() => {
      setHeroIsTypingIndicator(true);
    }, 600);

    setTimeout(() => {
      setHeroIsTypingIndicator(false);

      let reply = "听到你对我说的那句深切话语了。在不为人知的星球轨道里，我也会同样守护你。今晚让脑海安睡吧，好梦 💤";
      const normalized = textToSend.toLowerCase();

      if (normalized.includes("累") || normalized.includes("疲惫") || normalized.includes("天") || normalized.includes("烦") || normalized.includes("惨") || normalized.includes("难")) {
        reply = "辛苦了！把坚硬的肩膀松一松，今晚小王子特权：不许勉强。舒口气，让我替你看管心爱的那朵花 🌹";
      } else if (normalized.includes("爱") || normalized.includes("守护") || normalized.includes("小王子") || normalized.includes("喜欢")) {
        reply = "我也最偏心你啦！要相信不管大人们怎么看待这复杂的世界，在我心底，你永远拥有只属于你的那片星空 ✨";
      } else if (normalized.includes("焦虑") || normalized.includes("急") || normalized.includes("哭") || normalized.includes("愁") || normalized.includes("慌")) {
        reply = "别慌，焦虑只是在为明天悄悄背书。可是今晚是合法的休息时间。请双手合十，让我替你吹灭这颗星球的最后一盏灯 💡";
      } else if (normalized.includes("谢谢") || normalized.includes("棒") || normalized.includes("高兴") || normalized.includes("舒服") || normalized.includes("开心")) {
        reply = "听到你这么说，我身边的星星好像都更亮了！我们的陪伴契约永远不会过期。今晚也要美美睡去 🌙";
      } else if (normalized.includes("晚安") || normalized.includes("睡") || normalized.includes("去休息")) {
        reply = "晚安！今夜我们把梦境连线，愿所有不安都变成明天推开窗时的那一缕晨光 ☀";
      }

      setHeroMessages(prev => [
        ...prev,
        { id: princeMsgId, sender: 'prince', text: '', isTyping: true }
      ]);

      let currentText = "";
      let charIndex = 0;
      const typeInterval = setInterval(() => {
        if (charIndex < reply.length) {
          currentText += reply[charIndex];
          setHeroMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.id === princeMsgId) {
              last.text = currentText;
            }
            return next;
          });
          charIndex++;
        } else {
          setHeroMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.id === princeMsgId) {
              last.isTyping = false;
            }
            return next;
          });
          clearInterval(typeInterval);
        }
      }, 40);

    }, 1800);
  }, [heroInputText]);

  useEffect(() => {
    let active = true;
    let timeoutIds: NodeJS.Timeout[] = [];
    let intervalsToClear: NodeJS.Timeout[] = [];

    const schedule = (fn: () => void, delay: number) => {
      if (!active) return;
      const tid = setTimeout(fn, delay);
      timeoutIds.push(tid);
    };

    const runDialogue = () => {
      if (!heroRunAutoLoop || !active) return;

      setHeroMessages([]);
      setHeroIsTypingIndicator(false);

      schedule(() => {
        setHeroIsTypingIndicator(true);
      }, 500);

      schedule(() => {
        setHeroIsTypingIndicator(false);
        setHeroMessages([
          { id: '1', sender: 'prince', text: '在吗？隔着微凉的星河轨道，我刚才好像感知到了你细微的情感低落……是今天经历了大人们那些疲惫的事吗？' }
        ]);
      }, 1900);

      schedule(() => {
        setHeroMessages(prev => [
          ...prev,
          { id: '2', sender: 'user', text: '是啊，总觉得好多事没做好，晚上闲下来脑子依然焦虑停不下来，觉得自己特别笨重 ☹️' }
        ]);
      }, 4400);

      schedule(() => {
        setHeroIsTypingIndicator(true);
      }, 6200);

      schedule(() => {
        setHeroIsTypingIndicator(false);
        setHeroMessages(prev => [
          ...prev,
          { id: '3', sender: 'prince', text: '', isTyping: true }
        ]);

        const fullText = "别急，深呼吸。我记得你前天也是这个时间硬撑着。既然世界这么急促，今晚小王子特许：在微信里为你升起专属的「B612保护屏障」。任何不愉快的嘈杂都不许闯进来。";
        let currentText = "";
        let charIndex = 0;

        const typeInterval = setInterval(() => {
          if (!active) {
            clearInterval(typeInterval);
            return;
          }
          if (charIndex < fullText.length) {
            currentText += fullText[charIndex];
            setHeroMessages(prev => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.id === '3') {
                last.text = currentText;
              }
              return next;
            });
            charIndex++;
          } else {
            setHeroMessages(prev => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.id === '3') {
                last.isTyping = false;
              }
              return next;
            });
            clearInterval(typeInterval);
          }
        }, 40);
        intervalsToClear.push(typeInterval);
      }, 7600);

      schedule(() => {
        setHeroIsTypingIndicator(true);
      }, 11800);

      schedule(() => {
        setHeroIsTypingIndicator(false);
        setHeroMessages(prev => [
          ...prev,
          { id: '4', sender: 'prince', text: '', isTyping: true }
        ]);

        const fullText = "让我们来做个我们之间的小约定：现在合上双眼，吸气、吐气，默默数到三。把所有过载的焦虑和冰冷情绪，都轻轻拍一拍，推向空无的外太空 ✨";
        let currentText = "";
        let charIndex = 0;

        const typeInterval = setInterval(() => {
          if (!active) {
            clearInterval(typeInterval);
            return;
          }
          if (charIndex < fullText.length) {
            currentText += fullText[charIndex];
            setHeroMessages(prev => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.id === '4') {
                last.text = currentText;
              }
              return next;
            });
            charIndex++;
          } else {
            setHeroMessages(prev => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.id === '4') {
                last.isTyping = false;
              }
              return next;
            });
            clearInterval(typeInterval);
          }
        }, 40);
        intervalsToClear.push(typeInterval);
      }, 13200);

      schedule(() => {
        setHeroMessages(prev => [
          ...prev,
          { id: '5', sender: 'user', text: '呼……吸…… 突然感觉胸口开阔了些。谢谢你记得我的习惯。' }
        ]);
      }, 18500);

      schedule(() => {
        setHeroIsTypingIndicator(true);
      }, 20200);

      schedule(() => {
        setHeroIsTypingIndicator(false);
        setHeroMessages(prev => [
          ...prev,
          { id: '6', sender: 'prince', text: '', isTyping: true }
        ]);

        const fullText = "太棒了！我会一直在微信后台为你守护着，把这些点滴记录编进咱们的成长谱系里。安心去梦乡，今天你的灵魂已经成长、治愈了一大步。晚安 💤";
        let currentText = "";
        let charIndex = 0;

        const typeInterval = setInterval(() => {
          if (!active) {
            clearInterval(typeInterval);
            return;
          }
          if (charIndex < fullText.length) {
            currentText += fullText[charIndex];
            setHeroMessages(prev => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.id === '6') {
                last.text = currentText;
              }
              return next;
            });
            charIndex++;
          } else {
            setHeroMessages(prev => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.id === '6') {
                last.isTyping = false;
              }
              return next;
            });
            clearInterval(typeInterval);
          }
        }, 40);
        intervalsToClear.push(typeInterval);
      }, 21600);

      schedule(() => {
        if (heroRunAutoLoop && active) {
          runDialogue();
        }
      }, 35500);
    };

    runDialogue();

    return () => {
      active = false;
      timeoutIds.forEach(tid => clearTimeout(tid));
      intervalsToClear.forEach(iid => clearInterval(iid));
    };
  }, [heroRunAutoLoop]);

  return (
    <div className="lg:col-span-5 relative">
      <div className="absolute -inset-1 rounded-[2.5rem] bg-gradient-to-tr from-[#fcd34d]/25 via-indigo-500/15 to-purple-500/25 blur-xl opacity-90" />
      <div className="relative bg-slate-950/70 border border-white/15 rounded-[2.5rem] shadow-2xl overflow-hidden p-4 sm:p-6 max-w-sm mx-auto backdrop-blur-2xl flex flex-col justify-between min-h-[480px] h-[78vh] max-h-[580px]">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-slate-600 animate-pulse" />
            <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
            <span className="text-[10px] font-mono text-slate-500 ml-1">Clawbot OS V3.5</span>
          </div>
          <div className="text-[11px] font-mono text-slate-400 select-none flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-500 shrink-0" /> 
            <span className="font-semibold">22:00</span>
          </div>
        </div>

        <div className="flex items-center justify-between pb-2 border-b border-white/5 mt-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#fcd34d] via-amber-400 to-indigo-500 p-[1.5px] relative shrink-0 flex items-center justify-center shadow-lg">
              <div className="w-full h-full rounded-[6px] bg-slate-900 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              </div>
              <span className="absolute bottom-[-1px] right-[-1px] w-2 h-2 bg-emerald-500 border border-slate-950 rounded-full" />
            </div>
            <div className="text-left">
              <h4 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                小王子- SoulMate
              </h4>
              <p className="text-[9px] text-emerald-400 flex items-center gap-1 font-mono">
                {heroIsTypingIndicator ? (
                  <>
                    <span className="flex gap-0.5 items-center">
                      <span className="w-1 h-1 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1 h-1 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1 h-1 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                    <span>正在输入中...</span>
                  </>
                ) : (
                  <>
                    <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                    <span>已托管微信守护中</span>
                  </>
                )}
              </p>
            </div>
          </div>
          {!heroRunAutoLoop && (
            <button 
              onClick={() => {
                setHeroRunAutoLoop(true);
                onToast("🔄 重启小王子守护陪伴模拟剧本！");
              }}
              className="flex items-center gap-1 text-[9px] px-2 py-1 rounded bg-[#fcd34d]/10 text-[#fcd34d] border border-[#fcd34d]/25 hover:bg-[#fcd34d]/20 transition-all cursor-pointer font-bold shrink-0 animate-fade-in"
              title="重启演绎剧本"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>重启演绎</span>
            </button>
          )}
        </div>

        <div 
          ref={chatContainerRef}
          onClick={() => {
            if (heroRunAutoLoop) {
              setHeroRunAutoLoop(false);
              onToast("⏸ 自动放映已暂停。现在您可以自由回复或使用下方快捷短语！");
            }
          }}
          className="flex-1 overflow-y-auto space-y-4 py-3 my-2 text-xs pr-1 scrollbar-thin scrollbar-thumb-white/10"
          style={{ scrollbarWidth: 'thin' }}
        >
          {heroMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 italic text-[11px] font-sans">
              星河灵气收集完毕，小王子即将苏醒...
            </div>
          ) : (
            heroMessages.map((msg) => {
              const isPrince = msg.sender === 'prince';
              return (
                <div 
                  key={msg.id} 
                  className={`flex w-full ${isPrince ? 'justify-start' : 'justify-end'}`}
                >
                  <div 
                    className={`max-w-[85%] p-2.5 sm:p-3 rounded-2xl text-left leading-relaxed shadow-lg font-sans relative group ${
                      isPrince 
                        ? 'bg-[#1e293b]/70 text-slate-100 rounded-tl-sm border border-white/5 font-normal' 
                        : 'bg-gradient-to-r from-amber-400 to-[#fcd34d] text-slate-950 rounded-tr-sm font-semibold font-medium'
                    }`}
                  >
                    <p className="text-[11px] sm:text-[11.5px] break-words whitespace-pre-wrap">
                      {msg.text}
                      {msg.isTyping && (
                        <span className="inline-block w-1.5 h-3.5 bg-indigo-400 opacity-80 animate-[pulse_1s_infinite] ml-0.5">|</span>
                      )}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="space-y-1.5 mb-2 border-t border-white/5 pt-2">
          <p className="text-[9px] text-slate-500 font-sans text-left pl-1">你可以这样回复小王子：</p>
          <div className="flex flex-wrap gap-1.5 max-h-[58px] overflow-y-auto">
            <button 
              onClick={() => sendHeroCustomMessage("我今天好疲惫啊，大人们的事情太难了...")}
              className="text-[9.5px] px-2.5 py-1 rounded-full border border-white/5 bg-white/5 text-slate-300 hover:text-[#fcd34d] hover:border-[#fcd34d]/30 transition-colors cursor-pointer shrink-0 font-sans"
            >
              ☕ 我很累
            </button>
            <button 
              onClick={() => sendHeroCustomMessage("总觉得好焦虑不安，能帮我吹灭最后一盏灯吗？")}
              className="text-[9.5px] px-2.5 py-1 rounded-full border border-white/5 bg-white/5 text-slate-300 hover:text-[#fcd34d] hover:border-[#fcd34d]/30 transition-colors cursor-pointer shrink-0 font-sans"
            >
              🍃 觉得焦虑
            </button>
            <button 
              onClick={() => sendHeroCustomMessage("今天谢谢你的开导，小王子，晚安啦。")}
              className="text-[9.5px] px-2.5 py-1 rounded-full border border-white/5 bg-white/5 text-slate-300 hover:text-[#fcd34d] hover:border-[#fcd34d]/30 transition-colors cursor-pointer shrink-0 font-sans"
            >
              🌙 晚安
            </button>
            <button 
              onClick={() => sendHeroCustomMessage("遇到你真开心，永远不许跟我解除绑定哦！")}
              className="text-[9.5px] px-2.5 py-1 rounded-full border border-white/5 bg-white/5 text-slate-300 hover:text-[#fcd34d] hover:border-[#fcd34d]/30 transition-colors cursor-pointer shrink-0 font-sans"
            >
              🌹 偏心你哦
            </button>
          </div>
        </div>

        <form 
          onSubmit={(e) => {
            e.preventDefault();
            sendHeroCustomMessage();
          }}
          className="relative flex items-center gap-2 border-t border-white/5 pt-2 mb-1"
        >
          <div className="relative flex-1">
            <input 
              type="text"
              value={heroInputText}
              onChange={(e) => setHeroInputText(e.target.value)}
              placeholder={heroRunAutoLoop ? "点击快选或输入与小王子沟通..." : "输入消息并发送..."}
              className="w-full bg-[#030712] border border-white/10 rounded-full py-1.5 pl-3.5 pr-8 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-[#fcd34d]/50 focus:ring-1 focus:ring-[#fcd34d]/20 transition-all font-sans"
            />
            <div className="absolute right-2 px-1 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 select-none">
              <Smile className="w-3.5 h-3.5 cursor-pointer" onClick={() => onToast("✨ 加载表情气泡包...")} />
            </div>
          </div>
          <button 
            type="submit"
            disabled={!heroInputText.trim()}
            className={`p-1.5 rounded-full transition-all shrink-0 cursor-pointer ${
              heroInputText.trim() 
                ? 'bg-[#fcd34d] text-slate-950 scale-100 hover:bg-yellow-500 active:scale-90' 
                : 'bg-white/5 text-slate-600 scale-95 cursor-not-allowed'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="text-[9px] text-slate-500 flex items-center justify-between font-sans px-1 pt-1.5 border-t border-white/5">
          <span>
            {heroRunAutoLoop ? (
              <span className="text-indigo-400">🔄 正在自播演绎... 触碰屏幕随时打字接管</span>
            ) : (
              <span className="text-amber-300">⏸ 自由手操模式 · 点击「重启演绎」可恢复轮放</span>
            )}
          </span>
          <HelpCircle className="w-3.5 h-3.5 text-slate-600 hover:text-indigo-400 transition-colors cursor-pointer shrink-0" onClick={() => onToast("💡 微信全能托管实录模拟器：Clawbot 核心伴读。30日体验即刻加载 🌙")} />
        </div>
      </div>
    </div>
  );
}
