'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';

interface ModalProps {
  open: boolean;
  title: string;
  content: string;
  onClose: () => void;
}

export default function Modal({ open, title, content, onClose }: ModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="relative w-full max-w-md bg-slate-900 border border-indigo-500/30 rounded-2.5xl p-6 sm:p-8 shadow-2xl z-10"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-300">
                  <Sparkles className="w-5 h-5 text-amber-300" />
                </div>
                <h3 className="text-lg font-bold text-white tracking-wide">
                  {title}
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                {content}
              </p>
              <div className="pt-4 flex gap-3 justify-end">
                <button 
                  onClick={onClose}
                  className="px-6 py-2.5 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-300 to-amber-400 hover:from-amber-400 hover:to-amber-500 rounded-full transition-all active:scale-95 shadow-md cursor-pointer"
                >
                  我知道了
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
