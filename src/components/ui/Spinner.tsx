// src/components/ui/Spinner.tsx
"use client";

import React from "react";

type SpinnerProps = {
  size?: "sm" | "md" | "lg";
};

export const Spinner: React.FC<SpinnerProps> = ({ size = "md" }) => {
  const outerSize =
    size === "sm" ? "h-7 w-7" : size === "lg" ? "h-11 w-11" : "h-9 w-9";
  const innerSize =
    size === "sm" ? "h-5 w-5" : size === "lg" ? "h-8 w-8" : "h-6 w-6";

  return (
    <div className="relative inline-flex items-center justify-center">
      {/* 外側の薄いリング（止まっている） */}
      <div
        className={`${outerSize} rounded-full border border-slate-200/70 shadow-[0_8px_24px_rgba(15,23,42,0.08)] bg-white/60 backdrop-blur`}
      />

      {/* 内側の回転リング */}
      <div
        className={`${innerSize} absolute rounded-full border-[2px] border-slate-300 border-t-slate-500 animate-spin`}
      />
    </div>
  );
};

