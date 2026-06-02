import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
  theme?: 'light' | 'dark';
}

export default function GlassCard({ children, className = '', id, theme = 'dark' }: GlassCardProps) {
  const isLight = theme === 'light';
  return (
    <div
      id={id}
      className={`relative overflow-hidden rounded-2xl transition-all duration-300 ${
        isLight
          ? `border border-neutral-300 bg-white shadow-[0_8px_32px_0_rgba(0,0,0,0.08)] ${className}`
          : `border border-white/10 bg-white/5 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] backdrop-blur-md ${className}`
      }`}
    >
      {/* Subtle shine overlay */}
      {!isLight && (
        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/10 pointer-events-none" />
      )}
      {children}
    </div>
  );
}
