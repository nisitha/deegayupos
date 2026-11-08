import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' | 'cyan';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'border-transparent bg-brand-cyan/20 text-cyan-300 border border-cyan-500/30',
    secondary: 'border-transparent bg-obsidian-muted text-slate-300 border border-obsidian-border',
    outline: 'text-slate-300 border border-obsidian-border',
    success:
      'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-obsidian-badge',
    warning: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
    destructive: 'bg-red-500/15 text-red-300 border border-red-500/30',
    cyan: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-cyan focus:ring-offset-2',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
