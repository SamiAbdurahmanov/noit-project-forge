"use client";
import React from "react";
import { motion } from "framer-motion";

interface ErrorScreenProps {
  errorMessage: string;
  onClose: () => void;
}

export const ErrorScreen: React.FC<ErrorScreenProps> = ({
  errorMessage,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="
          relative w-full max-w-md rounded-2xl
          border border-orange-500/20
          bg-white/5 backdrop-blur-xl
          shadow-2xl shadow-black/40
          p-8
        "
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
          aria-label="Close error"
        >
          ✕
        </button>

        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-orange-500/10 to-transparent pointer-events-none" />

        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10 border border-orange-500/30">
              <span className="text-orange-400 text-lg">⚠</span>
            </div>
            <h2 className="text-lg font-semibold tracking-wide text-white">
              Нещо се обърка
            </h2>
          </div>

          <p className="text-sm leading-relaxed text-gray-300">
            {errorMessage}
          </p>

          <div className="mt-6 flex justify-end">
            <span className="text-xs text-gray-500">
              Моля опитайте отново или променете данните.
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
