// src/components/ui/LoadingScreen.tsx
"use client";

import React from "react";
import { Spinner } from "./Spinner";

type LoadingScreenProps = {
  message?: string;
};

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = "読み込み中です…",
}) => {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200">
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-white/70 bg-white/80 px-10 py-8 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl">
        {/* 小さめのブランド的なラベル */}
        <span className="text-[10px] tracking-[0.16em] uppercase text-slate-400">
          Tripboard
        </span>

        <Spinner size="lg" />

        {/* メインのメッセージ */}
        <p className="text-sm font-medium text-slate-700">{message}</p>

        {/* サブコピー（お好みで文言変えてOK） */}
        <p className="text-[11px] text-slate-400">
          数秒で準備が完了します。
        </p>
      </div>
    </main>
  );
};
