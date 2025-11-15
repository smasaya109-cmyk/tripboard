import * as React from 'react';

type CardProps = React.HTMLAttributes<HTMLDivElement>;

export const Card: React.FC<CardProps> = ({
  className = '',
  children,
  ...props
}) => {
  const base =
    'rounded-3xl border border-slate-200/80 bg-white/85 ' +
    'backdrop-blur-xl shadow-[0_18px_45px_rgba(15,23,42,0.08)] ' +
    'transition-shadow';

  const finalClass = [base, className].filter(Boolean).join(' ');

  return (
    <div className={finalClass} {...props}>
      {children}
    </div>
  );
};

const base =
  'rounded-3xl border border-slate-200/80 bg-white/85 ' +
  'backdrop-blur-xl shadow-[0_18px_45px_rgba(15,23,42,0.08)] ' +
  'transition-shadow dark:border-slate-800/80 dark:bg-slate-900/80 dark:shadow-[0_18px_45px_rgba(0,0,0,0.45)]';


