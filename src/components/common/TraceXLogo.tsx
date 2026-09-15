import React from 'react';

interface TraceXLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  onClick?: () => void;
  title?: string;
}

export const TraceXLogo: React.FC<TraceXLogoProps> = ({
  size = 'md',
  className = '',
  onClick,
  title = 'TraceXMail Forensic Intelligence'
}) => {
  const pixelMap = {
    xs: 20,
    sm: 26,
    md: 32,
    lg: 44,
    xl: 64
  };

  const px = pixelMap[size] || pixelMap.md;

  return (
    <div
      onClick={onClick}
      title={title}
      className={`relative inline-flex items-center justify-center select-none ${onClick ? 'cursor-pointer transition-transform hover:scale-105 active:scale-95' : ''} ${className}`}
      style={{ width: px, height: px }}
    >
      <svg
        width={px}
        height={px}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
      >
        {/* Outer Shield Hexagon */}
        <path
          d="M24 4L42 12V25C42 35.5 34.3 43.8 24 46C13.7 43.8 6 35.5 6 25V12L24 4Z"
          fill="#1c1813"
          stroke="#3d3428"
          strokeWidth="2"
        />

        {/* Inner Shield Lining with Forensic Red & Gold Gradient */}
        <path
          d="M24 7L39 13.7V24.5C39 33.3 32.7 40.5 24 42.5C15.3 40.5 9 33.3 9 24.5V13.7L24 7Z"
          fill="#14110d"
          stroke="#b23a2e"
          strokeWidth="1.5"
          strokeOpacity="0.8"
        />

        {/* Envelope Structure */}
        <path
          d="M14 18H34V32H14V18Z"
          fill="#1c1813"
          stroke="#8e8574"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M14 19L24 26L34 19"
          stroke="#c9a227"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Forensic Crosshair Lines */}
        <line x1="24" y1="12" x2="24" y2="16" stroke="#b23a2e" strokeWidth="2" strokeLinecap="round" />
        <line x1="24" y1="34" x2="24" y2="38" stroke="#b23a2e" strokeWidth="2" strokeLinecap="round" />
        <line x1="8" y1="25" x2="12" y2="25" stroke="#b23a2e" strokeWidth="2" strokeLinecap="round" />
        <line x1="36" y1="25" x2="40" y2="25" stroke="#b23a2e" strokeWidth="2" strokeLinecap="round" />

        {/* Center Target Focal Node */}
        <circle cx="24" cy="25" r="3" fill="#b23a2e" />
        <circle cx="24" cy="25" r="1.2" fill="#ede6d8" />
      </svg>
    </div>
  );
};
