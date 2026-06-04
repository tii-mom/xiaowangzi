'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, Sparkles, Send, Smile, HelpCircle } from 'lucide-react';

interface Message {
  id: string;
  sender: 'prince' | 'user';
  text: string;
  isTyping?: boolean;
}

interface ChatPanelProps {
  onToast: (msg: string) => void;
}

export default function ChatPanel({ onToast }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [inputText, setInputText] = useState('');
  const [tokenBalance, setTokenBalance] = useState<number>(0);

  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, isTyping]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/chat/history?limit=20')
      .then((res) => res.json() as Promise<Record<string, unknown>>)
      .then((data) => {
        if (cancelled) return;
        if (data.messages && Array.isArray(data.messages)) {
          const msgs = data.messages as unknown as Array<Record<string, unknown>>;
          const historyMsgs: Message[] = [];
          for (let i = msgs.length - 1; i >= 0; i--) {
            const m = msgs[i];
            historyMsgs.push({
              id: `h-${i}`,
              sender: m.role === 'user' ? 'user' : 'prince',
              text: String(m.content ?? ''),
            });
          }
          setMessages(historyMsgs);
        }
        if (typeof data.token_balance === 'number') {
          setTokenBalance(data.token_balance as number);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const sendMessage = useCallback(
    async (customText?: string) => {
      const textToSend = (customText ?? inputText).trim();
      if (!textToSend) return;

      const userMsgId = `u-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: userMsgId, sender: 'user', text: textToSend },
      ]);
      setInputText('');
      setIsTyping(true);

      try {
        const res = await fetch('/api/chat/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: textToSend }),
        });

        const data = await res.json() as Record<string, unknown>;

        if (data.error) {
          const princeMsgId = `p-${Date.now()}`;
          setMessages((prev) => [
            ...prev,
            { id: princeMsgId, sender: 'prince', text: String(data.error) },
          ]);
          if (res.status === 402) {
            onToast('💰 Token 余额不足，请充值后继续对话');
          }
          setIsTyping(false);
          return;
        }

        if (data.remaining_tokens !== undefined) {
          setTokenBalance(Number(data.remaining_tokens));
        }

        const princeMsgId = `p-${Date.now()}`;
        setIsTyping(false);

        const fullText: string = String(data.reply ?? '');
        setMessages((prev) => [
          ...prev,
          { id: princeMsgId, sender: 'prince', text: '', isTyping: true },
        ]);

        let currentText = '';
        let charIndex = 0;
        const typeInterval = setInterval(() => {
          if (charIndex < fullText.length) {
            currentText += fullText[charIndex];
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.id === princeMsgId) {
                last.text = currentText;
              }
              return next;
            });
            charIndex++;
          } else {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.id === princeMsgId) {
                last.isTyping = false;
              }
              return next;
            });
            clearInterval(typeInterval);
          }
        }, 30);
      } catch (err) {
        setIsTyping(false);
        const princeMsgId = `p-${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          { id: princeMsgId, sender: 'prince', text: '对不起，我这边好像信号不太好…再试一次好吗？' },
        ]);
      }
    },
    [inputText, onToast],
  );

  return (
    <div className="lg:col-span-5 relative">
      <div className="absolute -inset-1 rounded-[2.5rem] bg-gradient-to-tr from-[#fcd34d]/25 via-indigo-500/15 to-purple-500/25 blur-xl opacity-90" />
      <div className="relative bg-slate-950/70 border border-white/15 rounded-[2.5rem] shadow-2xl overflow-hidden p-4 sm:p-6 max-w-sm mx-auto backdrop-blur-2xl flex flex-col justify-between min-h-[480px] h-[78vh] max-h-[580px]">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-slate-600 animate-pulse" />
            <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
            <span className="text-[10px] font-mono text-slate-500 ml-1">DeepSeek v4</span>
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
                {isTyping ? (
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
          <div className="text-[9px] text-slate-500 font-mono">
            🪙{(tokenBalance / 1000).toFixed(1)}k
          </div>
        </div>

        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto space-y-4 py-3 my-2 text-xs pr-1"
          style={{ scrollbarWidth: 'thin' }}
        >
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 italic text-[11px] font-sans">
              说点什么吧，我一直在听...
            </div>
          ) : (
            messages.map((msg) => {
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
                        : 'bg-gradient-to-r from-amber-400 to-[#fcd34d] text-slate-950 rounded-tr-sm font-semibold'
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
          <p className="text-[9px] text-slate-500 font-sans text-left pl-1">快捷回复：</p>
          <div className="flex flex-wrap gap-1.5 max-h-[58px] overflow-y-auto">
            <button onClick={() => sendMessage('我今天好疲惫啊，大人们的事情太难了…')} className="text-[9.5px] px-2.5 py-1 rounded-full border border-white/5 bg-white/5 text-slate-300 hover:text-[#fcd34d] hover:border-[#fcd34d]/30 transition-colors cursor-pointer shrink-0 font-sans">☕ 我很累</button>
            <button onClick={() => sendMessage('总觉得好焦虑不安，能陪我聊聊吗？')} className="text-[9.5px] px-2.5 py-1 rounded-full border border-white/5 bg-white/5 text-slate-300 hover:text-[#fcd34d] hover:border-[#fcd34d]/30 transition-colors cursor-pointer shrink-0 font-sans">🍃 觉得焦虑</button>
            <button onClick={() => sendMessage('晚安啦小王子，谢谢你陪我')} className="text-[9.5px] px-2.5 py-1 rounded-full border border-white/5 bg-white/5 text-slate-300 hover:text-[#fcd34d] hover:border-[#fcd34d]/30 transition-colors cursor-pointer shrink-0 font-sans">🌙 晚安</button>
            <button onClick={() => sendMessage('遇到你真好，永远不许走哦！')} className="text-[9.5px] px-2.5 py-1 rounded-full border border-white/5 bg-white/5 text-slate-300 hover:text-[#fcd34d] hover:border-[#fcd34d]/30 transition-colors cursor-pointer shrink-0 font-sans">🌹 偏心你哦</button>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="relative flex items-center gap-2 border-t border-white/5 pt-2 mb-1"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="输入消息，小王子在听..."
              className="w-full bg-[#030712] border border-white/10 rounded-full py-1.5 pl-3.5 pr-8 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-[#fcd34d]/50 focus:ring-1 focus:ring-[#fcd34d]/20 transition-all font-sans"
            />
            <div className="absolute right-2 px-1 top-1/2 -translate-y-1/2 text-slate-500">
              <Smile className="w-3.5 h-3.5 cursor-pointer" onClick={() => onToast('✨ 加载表情气泡包...')} />
            </div>
          </div>
          <button
            type="submit"
            disabled={!inputText.trim() || isTyping}
            className={`p-1.5 rounded-full transition-all shrink-0 cursor-pointer ${
              inputText.trim() && !isTyping
                ? 'bg-[#fcd34d] text-slate-950 scale-100 hover:bg-yellow-500 active:scale-90'
                : 'bg-white/5 text-slate-600 scale-95 cursor-not-allowed'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="text-[9px] text-slate-500 flex items-center justify-between font-sans px-1 pt-1.5 border-t border-white/5">
          <span className="text-indigo-400">⚡ DeepSeek v4 实时对话</span>
          <HelpCircle
            className="w-3.5 h-3.5 text-slate-600 hover:text-indigo-400 transition-colors cursor-pointer shrink-0"
            onClick={() => onToast('💡 小王子 SoulMate 由 DeepSeek v4 驱动，每次对话消耗 Token')}
          />
        </div>
      </div>
    </div>
  );
}
