'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ToastProps {
  message: string | null;
}

export default function Toast({ message }: ToastProps) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div 
          initial={{ opacity: 0, y: -50, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -20, x: '-50%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3.5 bg-slate-900/90 hover:bg-slate-900 border border-amber-500/30 shadow-2xl shadow-amber-500/10 rounded-2xl flex items-center gap-3 backdrop-blur-xl max-w-[90vw] md:max-w-md"
        >
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
          <span className="text-xs sm:text-sm font-medium text-amber-100 tracking-wide line-clamp-2">{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
