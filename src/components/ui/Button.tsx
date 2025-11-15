'use client';

import * as React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean; // w-full にするためのカスタム props
};

const cx = (...classes: (string | false | null | undefined)[]) =>
  classes.filter(Boolean).join(' ');

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  children,
  ...rest // ← ここには fullWidth は含めない
}) => {
  const base =
    'inline-flex items-center justify-center rounded-full font-medium transition-all ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 ' +
    'focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ' +
    'disabled:opacity-50 disabled:cursor-not-allowed';

  const sizeClass: Record<ButtonSize, string> = {
    xs: 'text-[11px] px-3 py-1.5',
    sm: 'text-xs px-4 py-2',
    md: 'text-sm px-5 py-2.5',
    lg: 'text-base px-6 py-3',
  };

  const variantClass: Record<ButtonVariant, string> = {
    primary:
      'bg-gradient-to-b from-slate-900 to-slate-950 text-slate-50 ' +
      'shadow-[0_14px_30px_rgba(15,23,42,0.35)] hover:shadow-[0_18px_40px_rgba(15,23,42,0.45)] ' +
      'hover:-translate-y-[1px] active:translate-y-0 ' +
      'dark:from-slate-200 dark:to-slate-50 dark:text-slate-900 ' +
      'dark:shadow-[0_14px_30px_rgba(0,0,0,0.45)]',
    secondary:
      'bg-slate-100 text-slate-900 hover:bg-slate-200 border border-slate-200 ' +
      'dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700 hover:dark:bg-slate-700',
    ghost:
      'bg-transparent text-slate-600 hover:bg-slate-100 border border-transparent ' +
      'dark:text-slate-200 hover:dark:bg-slate-800',
    outline:
      'border border-slate-300 text-slate-800 bg-white hover:bg-slate-50 ' +
      'dark:border-slate-600 dark:text-slate-100 dark:bg-slate-900 hover:dark:bg-slate-800',
    danger:
      'bg-red-500 text-white hover:bg-red-600 shadow-sm ' +
      'dark:bg-red-500 dark:hover:bg-red-600',
  };

  const finalClass = cx(
    base,
    sizeClass[size],
    variantClass[variant],
    fullWidth && 'w-full',
    className
  );

  return (
    <button className={finalClass} {...rest}>
      {children}
    </button>
  );
};
