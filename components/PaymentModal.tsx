'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import type { PlanSelection } from './PricingCards';

interface OrderResult {
  order_id: string;
  aoid: string;
  qr_img: string;
  qr: string;
  qr_price: string;
  price: string;
  expires_in: number;
  pay_type: string;
  plan_name: string;
}

type PaymentStage = 'select' | 'creating' | 'show-qr' | 'paid' | 'error';

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  plan: PlanSelection;
}

export default function PaymentModal({ open, onClose, plan }: PaymentModalProps) {
  const [stage, setStage] = useState<PaymentStage>('select');
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const createOrder = async () => {
    setStage('creating');
    setErrorMsg('');

    try {
      const res = await fetch('/api/pay/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'demo-user',
        },
        body: JSON.stringify({ plan: plan.id }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error ?? '创建订单失败');
      }

      setOrder(data);
      setStage('show-qr');
      startPolling(data.order_id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '创建订单失败');
      setStage('error');
    }
  };

  const startPolling = (orderId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/pay/query?order_id=${orderId}`);
        const data = await res.json();

        if (data.status === 'paid') {
          setStage('paid');
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch {
        // swallow poll errors
      }
    }, 3000);
  };

  const handleClose = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="relative w-full max-w-sm bg-slate-900 border border-slate-700/50 rounded-2xl p-6 sm:p-8 shadow-2xl z-10 text-center"
          >
            {/* Plan Info Header */}
            <div className="mb-5">
              <h3 className="text-lg font-bold text-white">{plan.name}</h3>
              <p className="text-2xl font-extrabold text-amber-300 mt-1">
                ¥{(plan.amount_cents / 100).toFixed(0)}
              </p>
            </div>

            {/* Stage: Creating */}
            {stage === 'creating' && (
              <div className="space-y-3 py-8">
                <Loader2 className="w-10 h-10 text-amber-400 animate-spin mx-auto" />
                <p className="text-sm text-slate-400">正在创建支付订单...</p>
              </div>
            )}

            {/* Stage: Show QR Code */}
            {stage === 'show-qr' && order && (
              <div className="space-y-4">
                <div className="bg-white p-3 rounded-xl mx-auto w-48 h-48 flex items-center justify-center">
                  {order.qr_img ? (
                    <img
                      src={order.qr_img}
                      alt="支付二维码"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-slate-400 text-xs">
                      二维码加载中...
                    </div>
                  )}
                </div>

                {order.qr_price && (
                  <p className="text-xs text-amber-200/70">
                    请支付 ¥{order.qr_price}（与订单价格接近）
                  </p>
                )}
                {!order.qr_price && (
                  <p className="text-xs text-amber-200/70">
                    请手动输入 ¥{order.price} 完成支付
                  </p>
                )}

                <p className="text-xs text-slate-500">
                  {order.pay_type === 'wechat' ? '微信扫码支付' : '支付宝扫码支付'}
                </p>

                <p className="text-[10px] text-slate-600">
                  二维码 {order.expires_in > 0 ? `${order.expires_in} 秒后过期` : '已过期'}
                </p>

                <button
                  onClick={handleClose}
                  className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-white border border-white/10 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                >
                  取消支付
                </button>
              </div>
            )}

            {/* Stage: Paid */}
            {stage === 'paid' && (
              <div className="space-y-4 py-6">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <h4 className="text-lg font-bold text-emerald-300">支付成功!</h4>
                <p className="text-sm text-slate-300">Token 已充值到您的账户</p>
                <button
                  onClick={handleClose}
                  className="px-6 py-2.5 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-300 to-amber-400 rounded-full cursor-pointer hover:from-amber-400 hover:to-amber-500 transition-all active:scale-95"
                >
                  完成
                </button>
              </div>
            )}

            {/* Stage: Error */}
            {stage === 'error' && (
              <div className="space-y-4 py-6">
                <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
                <p className="text-sm text-red-300">{errorMsg}</p>
                <div className="flex gap-2 justify-center pt-2">
                  <button
                    onClick={createOrder}
                    className="px-4 py-2 text-xs font-bold bg-amber-400 text-slate-950 rounded-lg cursor-pointer hover:bg-amber-500 transition-all"
                  >
                    重试
                  </button>
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 text-xs text-slate-400 border border-white/10 rounded-lg cursor-pointer hover:bg-white/5 transition-all"
                  >
                    关闭
                  </button>
                </div>
              </div>
            )}

            {/* Stage: Select (initial, clicking "pay" directs here) */}
            {stage === 'select' && (
              <div className="space-y-4">
                <p className="text-sm text-slate-300">
                  确认使用 <span className="text-amber-300 font-bold">{plan.name}</span>
                  {' '}支付{' '}
                  <span className="text-amber-300 font-bold">
                    ¥{(plan.amount_cents / 100).toFixed(0)}
                  </span>
                </p>
                <div className="flex gap-2 justify-center pt-2">
                  <button
                    onClick={createOrder}
                    className="px-6 py-2.5 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-300 to-amber-500 rounded-full cursor-pointer hover:from-amber-400 hover:to-amber-600 transition-all active:scale-95 flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>确认支付</span>
                  </button>
                  <button
                    onClick={handleClose}
                    className="px-4 py-2.5 text-xs text-slate-400 border border-white/10 rounded-lg cursor-pointer hover:bg-white/5 transition-all"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
