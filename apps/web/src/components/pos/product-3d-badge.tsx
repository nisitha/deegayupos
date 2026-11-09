'use client';

import React from 'react';
import {
  classifyAyurvedicDepartment,
  AYURVEDIC_MASTER_DEPARTMENTS,
} from '../../lib/ayurvedic-departments';

interface Product3dBadgeProps {
  departmentId?: string;
  productName?: string;
  categoryName?: string;
  categorySlug?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Product3dBadge({
  departmentId,
  productName,
  categoryName,
  categorySlug,
  size = 'md',
  className = '',
}: Product3dBadgeProps) {
  const deptKey =
    departmentId ||
    classifyAyurvedicDepartment(productName || '', categoryName, categorySlug);

  const defaultDept = AYURVEDIC_MASTER_DEPARTMENTS['fmcg']!;
  const dept = (deptKey ? AYURVEDIC_MASTER_DEPARTMENTS[deptKey] : null) || defaultDept;

  // Size configurations
  const sizeClasses = {
    sm: 'w-8 h-8 rounded-lg',
    md: 'w-14 h-14 rounded-2xl',
    lg: 'w-16 h-16 rounded-2xl',
  }[size];

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-7 h-7',
    lg: 'w-8 h-8',
  }[size];

  // Specific 3D Skeuomorphic SVG Artwork for each Department
  const render3dIcon = () => {
    switch (dept.id) {
      case 'arishta':
        // Arishta & Asawa: 3D Amber Elixir Flask / Bottle
        return (
          <svg
            viewBox="0 0 32 32"
            fill="none"
            className={`${iconSizes} drop-shadow-md`}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="arishtaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FDE68A" />
                <stop offset="40%" stopColor="#D97706" />
                <stop offset="100%" stopColor="#78350F" />
              </linearGradient>
              <linearGradient id="corkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#92400E" />
              </linearGradient>
            </defs>
            {/* Cork Stopper */}
            <rect x="13" y="3" width="6" height="3" rx="1.5" fill="url(#corkGrad)" />
            {/* Neck */}
            <rect x="14" y="6" width="4" height="4" rx="1" fill="url(#arishtaGrad)" />
            {/* Glass Rim */}
            <path d="M12 6h8v2h-8z" fill="#FEF3C7" opacity="0.8" />
            {/* Flask Body */}
            <path
              d="M14 9l-5 8c-1.5 2.5-1 6 2 7.5 1.5.8 5.5 1.5 8 0 3-1.5 3.5-5 2-7.5l-5-8h-2z"
              fill="url(#arishtaGrad)"
            />
            {/* Liquid Level Reflection */}
            <ellipse cx="16" cy="20" rx="4.5" ry="1.5" fill="#FDE68A" opacity="0.6" />
            {/* Glass Sheen */}
            <path
              d="M11 18c0-3 2-6 3-7"
              stroke="#FFFFFF"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.8"
            />
          </svg>
        );

      case 'taila':
        // Medicinal Oils: Glowing Golden Oil Droplet with Light Refraction
        return (
          <svg
            viewBox="0 0 32 32"
            fill="none"
            className={`${iconSizes} drop-shadow-md`}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="tailaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FEF08A" />
                <stop offset="35%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#B45309" />
              </linearGradient>
            </defs>
            {/* 3D Droplet */}
            <path
              d="M16 4C16 4 8 15 8 20.5C8 24.64 11.58 28 16 28C20.42 28 24 24.64 24 20.5C24 15 16 4 16 4Z"
              fill="url(#tailaGrad)"
            />
            {/* Inner Refraction */}
            <circle cx="16" cy="21" r="5" fill="#FBBF24" opacity="0.5" />
            {/* Specular White Highlight */}
            <path
              d="M12.5 16c1-3 3.5-6.5 3.5-6.5"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.9"
            />
            <circle cx="12" cy="19" r="1.2" fill="#FFFFFF" opacity="0.9" />
          </svg>
        );

      case 'churna':
        // Churna: Mortar and Pestle with Fresh Ground Herbal Powder
        return (
          <svg
            viewBox="0 0 32 32"
            fill="none"
            className={`${iconSizes} drop-shadow-md`}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="churnaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#A7F3D0" />
                <stop offset="40%" stopColor="#10B981" />
                <stop offset="100%" stopColor="#065F46" />
              </linearGradient>
              <linearGradient id="pestleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F3F4F6" />
                <stop offset="100%" stopColor="#9CA3AF" />
              </linearGradient>
            </defs>
            {/* Pestle angled */}
            <path
              d="M19 6L23 9L15 20L12 18L19 6Z"
              fill="url(#pestleGrad)"
              stroke="#047857"
              strokeWidth="0.5"
            />
            {/* Mortar Bowl */}
            <path
              d="M6 14C6 14 7 26 16 26C25 26 26 14 26 14H6Z"
              fill="url(#churnaGrad)"
            />
            {/* Mortar Lip */}
            <ellipse cx="16" cy="14" rx="10" ry="2.5" fill="#34D399" />
            {/* Churna Powder inside bowl */}
            <ellipse cx="16" cy="15" rx="7" ry="1.5" fill="#047857" />
            {/* Highlight */}
            <path
              d="M9 19c1.5 3 4 5 7 5"
              stroke="#FFFFFF"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.6"
            />
          </svg>
        );

      case 'guli':
        // Guli & Vati: Two-Tone Herbal Medicine Pill / Capsule
        return (
          <svg
            viewBox="0 0 32 32"
            fill="none"
            className={`${iconSizes} drop-shadow-md`}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="capsuleBlue" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#93C5FD" />
                <stop offset="100%" stopColor="#2563EB" />
              </linearGradient>
              <linearGradient id="capsuleWhite" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="100%" stopColor="#CBD5E1" />
              </linearGradient>
            </defs>
            {/* Angled Capsule */}
            <g transform="rotate(45 16 16)">
              {/* Left/Bottom Half (Blue) */}
              <path
                d="M10 16H22V23C22 26.31 19.31 29 16 29C12.69 29 10 26.31 10 23V16Z"
                fill="url(#capsuleBlue)"
              />
              {/* Right/Top Half (White) */}
              <path
                d="M10 9C10 5.69 12.69 3 16 3C19.31 3 22 5.69 22 9V16H10V9Z"
                fill="url(#capsuleWhite)"
              />
              {/* Center Divider Ring */}
              <line x1="9" y1="16" x2="23" y2="16" stroke="#1E40AF" strokeWidth="1" />
              {/* Pill Highlight */}
              <path
                d="M12 7V22"
                stroke="#FFFFFF"
                strokeWidth="1.5"
                strokeLinecap="round"
                opacity="0.8"
              />
            </g>
          </svg>
        );

      case 'rasayana':
        // Rasayana & Leha: Traditional Ceramic Honey & Jam Pot
        return (
          <svg
            viewBox="0 0 32 32"
            fill="none"
            className={`${iconSizes} drop-shadow-md`}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="rasayanaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F472B6" />
                <stop offset="40%" stopColor="#DB2777" />
                <stop offset="100%" stopColor="#831843" />
              </linearGradient>
            </defs>
            {/* Lid */}
            <rect x="11" y="6" width="10" height="3" rx="1.5" fill="#FBCFE8" />
            <circle cx="16" cy="5" r="1.5" fill="#DB2777" />
            {/* Pot Neck */}
            <rect x="12" y="9" width="8" height="2" fill="#BE185D" />
            {/* Pot Belly */}
            <path
              d="M8 12C6 17 6 23 10 26C12 27.5 20 27.5 22 26C26 23 26 17 24 12H8Z"
              fill="url(#rasayanaGrad)"
            />
            {/* Glow / Gold Honey Line */}
            <path
              d="M10 16c3 1.5 9 1.5 12 0"
              stroke="#FDE047"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Highlight */}
            <path
              d="M10 14c-1.5 3-1.5 6 0 9"
              stroke="#FFFFFF"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.7"
            />
          </svg>
        );

      case 'kasaya':
        // Kwatha & Decoctions: Clay Brewing Kettle / Pot
        return (
          <svg
            viewBox="0 0 32 32"
            fill="none"
            className={`${iconSizes} drop-shadow-md`}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="kasayaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FCD34D" />
                <stop offset="40%" stopColor="#D97706" />
                <stop offset="100%" stopColor="#78350F" />
              </linearGradient>
            </defs>
            {/* Handle on top */}
            <path
              d="M10 9C10 5 22 5 22 9"
              stroke="#F59E0B"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Kettle Body */}
            <circle cx="16" cy="18" r="8" fill="url(#kasayaGrad)" />
            {/* Spout */}
            <path
              d="M8 17L4 13"
              stroke="#D97706"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Steam Wisp */}
            <path
              d="M15 4c0-1 1-1.5 1-2.5"
              stroke="#FBBF24"
              strokeWidth="1.2"
              strokeLinecap="round"
              opacity="0.8"
            />
            {/* Pot Highlight */}
            <circle cx="13" cy="15" r="2" fill="#FEF3C7" opacity="0.7" />
          </svg>
        );

      case 'raw_herbs':
        // Raw & Dry Herbs: Botanical Medicinal Leaf Sprig
        return (
          <svg
            viewBox="0 0 32 32"
            fill="none"
            className={`${iconSizes} drop-shadow-md`}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="herbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#86EFAC" />
                <stop offset="40%" stopColor="#22C55E" />
                <stop offset="100%" stopColor="#15803D" />
              </linearGradient>
            </defs>
            {/* Stem */}
            <path
              d="M6 26C10 22 18 16 26 8"
              stroke="#166534"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Top Leaf */}
            <path
              d="M26 8C26 8 27 15 20 16C17 12 21 8 26 8Z"
              fill="url(#herbGrad)"
            />
            {/* Left Leaf */}
            <path
              d="M16 17C16 17 12 18 10 22C14 23 18 20 16 17Z"
              fill="url(#herbGrad)"
            />
            {/* Vein Highlight */}
            <path
              d="M24 10c-3 3-5 5-7 6"
              stroke="#DCFCE7"
              strokeWidth="1"
              strokeLinecap="round"
            />
          </svg>
        );

      case 'balms':
        // Balms & Ointments: Round Balm Tub / Tin
        return (
          <svg
            viewBox="0 0 32 32"
            fill="none"
            className={`${iconSizes} drop-shadow-md`}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="balmGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FDA4AF" />
                <stop offset="40%" stopColor="#F43F5E" />
                <stop offset="100%" stopColor="#9F1239" />
              </linearGradient>
            </defs>
            {/* Base Tin */}
            <rect x="7" y="14" width="18" height="11" rx="4" fill="url(#balmGrad)" />
            {/* Screw Cap */}
            <rect x="6" y="9" width="20" height="6" rx="2" fill="#FECDD3" />
            <line x1="6" y1="12" x2="26" y2="12" stroke="#E11D48" strokeWidth="1" />
            {/* Gloss sheen */}
            <path
              d="M9 16h14"
              stroke="#FFFFFF"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.8"
            />
          </svg>
        );

      case 'skincare':
        // Herbal Skincare: Soap & Sparkles
        return (
          <svg
            viewBox="0 0 32 32"
            fill="none"
            className={`${iconSizes} drop-shadow-md`}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="skincareGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#67E8F9" />
                <stop offset="40%" stopColor="#06B6D4" />
                <stop offset="100%" stopColor="#0E7490" />
              </linearGradient>
            </defs>
            {/* Soap bar / dispenser */}
            <rect x="8" y="10" width="16" height="15" rx="4" fill="url(#skincareGrad)" />
            <circle cx="16" cy="17" r="3" fill="#A5F3FC" opacity="0.6" />
            {/* Sparkle 1 */}
            <path
              d="M24 6l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z"
              fill="#FDE047"
            />
            {/* Sparkle 2 */}
            <circle cx="7" cy="9" r="1.5" fill="#67E8F9" />
            {/* Gloss highlight */}
            <path
              d="M10 13c0-1 2-2 4-2"
              stroke="#FFFFFF"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.8"
            />
          </svg>
        );

      case 'fmcg':
      default:
        // General FMCG & Healthcare: First Aid Medical Cross Badge
        return (
          <svg
            viewBox="0 0 32 32"
            fill="none"
            className={`${iconSizes} drop-shadow-md`}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="fmcgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#C4B5FD" />
                <stop offset="40%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#5B21B6" />
              </linearGradient>
            </defs>
            {/* Rounded Shield */}
            <rect x="7" y="6" width="18" height="20" rx="6" fill="url(#fmcgGrad)" />
            {/* Medical Cross */}
            <rect x="14" y="10" width="4" height="12" rx="1.5" fill="#FFFFFF" />
            <rect x="10" y="14" width="12" height="4" rx="1.5" fill="#FFFFFF" />
          </svg>
        );
    }
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 overflow-hidden shadow-md shadow-black/10 group-hover:scale-105 transition-all duration-200 ${sizeClasses} bg-gradient-to-br ${dept.gradient} ${className}`}
      title={`${dept.en} (${dept.si})`}
    >
      {/* 3D Glass Sheen Top Layer */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/30 pointer-events-none" />
      {/* Inner Highlight Ring */}
      <div className="absolute inset-0 rounded-[inherit] ring-1 ring-white/40 ring-inset pointer-events-none" />
      {/* Centered 3D Emitted Vector Icon */}
      <div className="relative z-10 flex items-center justify-center">
        {render3dIcon()}
      </div>
    </div>
  );
}
