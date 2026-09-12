import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Keyboard, Sparkles, Command } from 'lucide-react';
import { SHORTCUT_DEFINITIONS } from '../hooks/useKeyboardShortcuts';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({
  isOpen,
  onClose
}: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-2xl bg-[#16130f] border border-[#3a352c] rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#3a352c] bg-[#1a1712]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300">
                <Keyboard className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#ede6d8]">Keyboard Shortcuts Cheatsheet</h3>
                <p className="text-xs text-[#8a8070]">Power user keybindings for rapid email triage and investigation</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#8a8070] hover:text-[#ede6d8] hover:bg-[#26211a] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
            {SHORTCUT_DEFINITIONS.map((section) => (
              <div key={section.category} className="space-y-2.5">
                <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400/90 flex items-center gap-2">
                  <Command className="w-3 h-3" />
                  <span>{section.category}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {section.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#1d1914] border border-[#342e26] text-xs"
                    >
                      <span className="text-[#d6cdbe] font-sans pr-2 leading-tight">
                        {item.description}
                      </span>
                      <kbd className="px-2 py-0.5 text-[10.5px] font-mono font-bold bg-[#26211a] border border-[#3a352c] text-amber-300 rounded shadow-xs shrink-0 whitespace-nowrap">
                        {item.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 bg-[#14120f] border-t border-[#3a352c] flex items-center justify-between text-xs text-[#8a8070]">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Press <kbd className="px-1 py-0.2 bg-[#26211a] border border-[#3a352c] rounded text-[10px] font-mono text-amber-300">?</kbd> anywhere to view this reference</span>
            </span>
            <button
              onClick={onClose}
              className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-mono font-bold text-xs transition-colors cursor-pointer"
            >
              Got it (Esc)
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
