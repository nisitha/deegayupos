'use client';

import React, { useEffect, useState, useRef } from 'react';
import { motion, useMotionValue, useSpring, type Variants } from 'framer-motion';

/**
 * MotionPageShell: Smooth entrance fade + subtle upward glide
 * Triggered on route mount with zero layout shift
 */
export function MotionPageShell({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Stagger container and item variants
 */
export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
};

export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
  },
};

/**
 * MotionStaggerGrid: Orchestrates sequential entrance for cards/widgets
 */
export function MotionStaggerGrid({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={staggerContainerVariants}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * MotionStaggerItem: Single staggered child with tactile hover lift
 */
export function MotionStaggerItem({
  children,
  className = '',
  enableHover = true,
}: {
  children: React.ReactNode;
  className?: string;
  enableHover?: boolean;
}) {
  return (
    <motion.div
      variants={staggerItemVariants}
      whileHover={enableHover ? { y: -3, transition: { duration: 0.2 } } : undefined}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * MotionAnimatedNumber: Smooth count-up number formatter for currency and metrics
 * Avoids constant flicker on background telemetry updates by checking diff thresholds
 */
export function MotionAnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = '',
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState<number>(value);
  const motionVal = useMotionValue(value);
  const springVal = useSpring(motionVal, { stiffness: 90, damping: 20 });
  const prevValueRef = useRef<number>(value);

  useEffect(() => {
    // Only animate if value actually changed
    if (Math.abs(prevValueRef.current - value) > 0.001) {
      prevValueRef.current = value;
      motionVal.set(value);
    }
  }, [value, motionVal]);

  useEffect(() => {
    const unsubscribe = springVal.on('change', (latest) => {
      setDisplayValue(latest);
    });
    return () => unsubscribe();
  }, [springVal]);

  const formatted = displayValue.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

/**
 * Segmented Pill Tab Bar Item
 */
export interface MotionTabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  count?: number | string;
}

/**
 * MotionPillTabs: Segmented tab bar with gliding active pill indicator
 */
export function MotionPillTabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  layoutId = 'activePillTab',
  activePillClass = 'bg-white text-slate-900 shadow-sm',
  inactiveTabClass = 'text-slate-600 hover:text-slate-900',
  className = '',
}: {
  tabs: MotionTabItem<T>[];
  activeTab: T;
  onChange: (id: T) => void;
  layoutId?: string;
  activePillClass?: string;
  inactiveTabClass?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer select-none ${
              isActive ? 'text-slate-900' : inactiveTabClass
            }`}
          >
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className={`absolute inset-0 rounded-lg ${activePillClass}`}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive
                      ? 'bg-slate-900/10 text-slate-900'
                      : 'bg-slate-300/60 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
