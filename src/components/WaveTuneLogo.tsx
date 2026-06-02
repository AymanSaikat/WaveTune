import React from 'react';

interface WaveTuneLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | number;
}

export default function WaveTuneLogo({ className = '', size = 'md' }: WaveTuneLogoProps) {
  const pixelSize = typeof size === 'number' 
    ? size 
    : size === 'sm' ? 36 : size === 'md' ? 44 : 80;

  return (
    <div 
      className={`relative rounded-2xl overflow-hidden shrink-0 shadow-lg ${className}`}
      style={{ 
        width: pixelSize, 
        height: pixelSize,
        background: 'linear-gradient(135deg, #021B3A 0%, #0F5E7B 50%, #9035B0 100%)'
      }}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full p-2"
      >
        <defs>
          <linearGradient id="waveGlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#A855F7" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id="waveCenter" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#E0F2FE" stopOpacity="0.9" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer background echo waves */}
        <path
          d="M 10,50 Q 22,35 34,50 T 58,50 T 82,50 T 90,50"
          stroke="url(#waveGlow)"
          strokeWidth="1.2"
          strokeLinecap="round"
          className="opacity-40"
        />
        <path
          d="M 10,50 Q 22,65 34,50 T 58,50 T 82,50 T 90,50"
          stroke="url(#waveGlow)"
          strokeWidth="1.2"
          strokeLinecap="round"
          className="opacity-45"
        />

        {/* Overlapping back waves to create depth */}
        <path
          d="M 12,50 C 22,38 27,62 37,50 C 47,38 52,62 62,50 C 72,38 77,62 88,50"
          stroke="#38BDF8"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="opacity-50"
        />
        <path
          d="M 12,50 C 22,62 27,38 37,50 C 47,62 52,38 62,50 C 72,62 77,38 88,50"
          stroke="#E9D5FF"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="opacity-60"
        />

        {/* Main glowing 'W' style focal sine wave representing WaveTune */}
        <path
          d="M 15,50 C 25,30 30,70 40,50 C 50,30 55,70 65,50 C 75,30 80,70 85,50"
          stroke="url(#waveCenter)"
          strokeWidth="4"
          strokeLinecap="round"
          filter="url(#glow)"
        />
        
        {/* Additional overlaid fine curves to capture the aesthetic exactly */}
        <path
          d="M 15,52 C 25,32 30,72 40,52 C 50,32 55,72 65,52 C 75,32 80,72 85,52"
          stroke="#38BDF8"
          strokeWidth="1"
          strokeLinecap="round"
          className="opacity-80"
        />
      </svg>
    </div>
  );
}
