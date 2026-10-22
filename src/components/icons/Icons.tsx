import React from 'react';

export interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  color?: string;
  strokeWidth?: number;
}

const baseProps = (size: number, color?: string, strokeWidth = 2): React.SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: color || 'currentColor',
  strokeWidth,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  // Icônes décoratives : les contrôles qui les contiennent portent le libellé accessible
  'aria-hidden': true,
  focusable: 'false',
});

/** Star representing galactic systems */
export function IconSystem({ size = 16, className, style, color, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className} style={style}>
      <polygon
        points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
        fill="currentColor"
        fillOpacity="0.15"
      />
    </svg>
  );
}

/** Broadcast / radar wave from a star system */
export function IconRadarSystem({ size = 16, className, style, color, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className} style={style}>
      <path d="M4.93 4.93a10 10 0 0 1 14.14 0" />
      <path d="M7.76 7.76a6 6 0 0 1 8.48 0" />
      <circle cx="12" cy="14" r="2" fill="currentColor" />
    </svg>
  );
}

/** Crosshairs / tactical radar for fleets */
export function IconRadarFleet({ size = 16, className, style, color, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className} style={style}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.2" />
      <line x1="12" y1="3" x2="12" y2="7" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <line x1="3" y1="12" x2="7" y2="12" />
      <line x1="17" y1="12" x2="21" y2="12" />
    </svg>
  );
}

/** Minimap layout icon */
export function IconMiniMap({ size = 16, className, style, color, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className} style={style}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <rect x="13" y="13" width="6" height="6" rx="1" fill={color || 'currentColor'} fillOpacity="0.35" stroke={color || 'currentColor'} strokeWidth="1.5" />
    </svg>
  );
}

/** Help / info question mark */
export function IconHelp({ size = 16, className, style, color, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className} style={style}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

/** Filter sliders / advanced settings */
export function IconSliders({ size = 16, className, style, color, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className} style={style}>
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}

/** Fleet movement / waypoints arrow */
export function IconFleetMove({ size = 16, className, style, color, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className} style={style}>
      <path d="M5 18L18 6" />
      <polyline points="10 6 18 6 18 14" />
      <circle cx="5" cy="18" r="2.5" fill="currentColor" />
    </svg>
  );
}

/** Focus frame / viewfinder : la flotte au centre, le reste s'écarte */
export function IconFleetFocus({ size = 16, className, style, color, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className} style={style}>
      <path d="M4 9V6a2 2 0 0 1 2-2h3" />
      <path d="M15 4h3a2 2 0 0 1 2 2v3" />
      <path d="M20 15v3a2 2 0 0 1-2 2h-3" />
      <path d="M9 20H6a2 2 0 0 1-2-2v-3" />
      <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.25" />
    </svg>
  );
}

/** Media Play icon */
export function IconPlay({ size = 14, className, style, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color || 'currentColor'} stroke="none" aria-hidden="true" focusable="false" className={className} style={style}>
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}

/** Media Stop icon */
export function IconStop({ size = 14, className, style, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color || 'currentColor'} stroke="none" aria-hidden="true" focusable="false" className={className} style={style}>
      <rect x="5" y="5" width="14" height="14" rx="1.5" />
    </svg>
  );
}

/** Warning / Alert triangle */
export function IconAlert({ size = 16, className, style, color, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className} style={style}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

/** Clipboard for copying schemas */
export function IconClipboard({ size = 16, className, style, color, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className} style={style}>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  );
}

/** Checkmark */
export function IconCheck({ size = 16, className, style, color, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className} style={style}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/** Refresh / reset circular arrows */
export function IconRefresh({ size = 16, className, style, color, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className} style={style}>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <polyline points="21 3 21 8 16 8" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <polyline points="3 21 3 16 8 16" />
    </svg>
  );
}

/** Close / delete cross */
export function IconClose({ size = 16, className, style, color, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className} style={style}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/** Directional chevron icons */
export function IconChevronDown({ size = 16, className, style, color, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className} style={style}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function IconChevronRight({ size = 16, className, style, color, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className} style={style}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function IconChevronLeft({ size = 16, className, style, color, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className} style={style}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export function IconChevronUp({ size = 16, className, style, color, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className} style={style}>
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

/** 6-dot grip handle indicating a draggable panel header */
export function IconGrip({ size = 16, className, style, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color || 'currentColor'} aria-hidden="true" focusable="false" className={className} style={style}>
      <circle cx="8" cy="6" r="1.75" />
      <circle cx="16" cy="6" r="1.75" />
      <circle cx="8" cy="12" r="1.75" />
      <circle cx="16" cy="12" r="1.75" />
      <circle cx="8" cy="18" r="1.75" />
      <circle cx="16" cy="18" r="1.75" />
    </svg>
  );
}

/** Right arrow for origins and destinations */
export function IconArrowRight({ size = 14, className, style, color, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className} style={style}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
