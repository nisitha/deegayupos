import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'glow';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none';

    const variants = {
      default:
        'bg-brand-cyan text-obsidian font-semibold hover:bg-cyan-400 active:scale-[0.98] shadow-sm',
      destructive:
        'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 active:scale-[0.98]',
      outline:
        'border border-obsidian-border bg-obsidian-surface text-slate-200 hover:bg-obsidian-muted hover:border-cyan-500/50 active:scale-[0.98]',
      secondary:
        'bg-obsidian-muted text-slate-200 border border-obsidian-border hover:bg-obsidian-800 active:scale-[0.98]',
      ghost: 'text-slate-300 hover:bg-obsidian-surface hover:text-white',
      glow: 'bg-brand-cyan text-obsidian font-semibold hover:bg-cyan-300 shadow-obsidian-glow active:scale-[0.98]',
    };

    const sizes = {
      default: 'h-10 px-4 py-2',
      sm: 'h-8 rounded-md px-3 text-xs',
      lg: 'h-11 rounded-md px-8 text-base',
      icon: 'h-10 w-10',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';
