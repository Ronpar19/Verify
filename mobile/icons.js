// icons.js
//
// Small SVG icon set for LinkCheckerScreen.js, ported from the Verify app
// design (Verify App.dc.html). Kept as plain react-native-svg primitives —
// no icon-font dependency.

import React from 'react';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';

// Two overlapping rotated rounded rectangles — the Verify app logo (chain
// link). Reused at large size for the hero icon and small size as the
// input field's leading icon.
export function LinkLogoIcon({ size = 24, color = '#3F5AE0' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 30 30" fill="none">
      <Rect x="4" y="12" width="14" height="8" rx="4" transform="rotate(-45 4 12)" stroke={color} strokeWidth="2.6" fill="none" />
      <Rect x="12" y="10" width="14" height="8" rx="4" transform="rotate(-45 12 10)" stroke={color} strokeWidth="2.6" fill="none" />
    </Svg>
  );
}

// Globe icon for the language-switch button (top-right).
export function GlobeIcon({ size = 20, color = '#000' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" />
      <Line x1="3" y1="12" x2="21" y2="12" stroke={color} strokeWidth="1.8" />
      <Path
        d="M12 3c2.5 2.5 4 5.7 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.7-4-9s1.5-6.5 4-9z"
        stroke={color}
        strokeWidth="1.8"
        fill="none"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Magnifying glass — the "check link" button icon.
export function SearchIcon({ size = 18, color = '#fff' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth="2.2" />
      <Path d="M21 21l-4.5-4.5" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </Svg>
  );
}

// Clipboard — the "paste from clipboard" button icon.
export function ClipboardIcon({ size = 16, color = '#3F5AE0' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="7" y="3" width="10" height="4" rx="1.5" fill={color} />
      <Rect x="4" y="5" width="16" height="16" rx="2.5" stroke={color} strokeWidth="1.8" fill="none" />
    </Svg>
  );
}

// Checkmark — safe-result icon.
export function CheckIcon({ size = 24, color = '#1FA25A' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12.5l4.5 4.5L19 7" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Warning triangle — danger-result icon.
export function WarningIcon({ size = 24, color = '#E0453F' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 4L21.5 20H2.5L12 4z" stroke={color} strokeWidth="2.2" strokeLinejoin="round" fill="none" />
      <Path d="M12 10v4.5M12 17.2v.1" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
    </Svg>
  );
}

// Shield — "secure" feature chip.
export function ShieldIcon({ size = 18, color = '#3F5AE0' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3l7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6l7-3z" stroke={color} strokeWidth="1.8" fill="none" />
    </Svg>
  );
}

// Bolt — "fast" feature chip.
export function BoltIcon({ size = 18, color = '#3F5AE0' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

// Magnifier with a trailing dot — "advanced search" feature chip.
export function SearchAdvancedIcon({ size = 18, color = '#3F5AE0' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="10.5" cy="10.5" r="6.5" stroke={color} strokeWidth="1.8" fill="none" />
      <Path d="M20 20l-4.8-4.8" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

// Hamburger — opens the downloads side panel.
export function MenuIcon({ size = 20, color = '#000' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1="4" y1="7" x2="20" y2="7" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Line x1="4" y1="12" x2="20" y2="12" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Line x1="4" y1="17" x2="20" y2="17" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

// Apple logo — iOS download row.
export function AppleIcon({ size = 20, color = '#000' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fill={color}
        d="M16.365 1.43c0 1.14-.393 2.023-1.176 2.652-.783.628-1.653.973-2.61.973-.093 0-.19-.007-.29-.02a3.11 3.11 0 0 1-.02-.35c0-1.086.43-2.037 1.29-2.652.65-.46 1.5-.77 2.55-.9.13.1.2.2.256.297zm4.11 16.24c-.29.67-.63 1.29-1.03 1.87-.54.79-1.02 1.34-1.44 1.65-.62.48-1.28.72-1.99.74-.51.02-1.13-.14-1.85-.48-.73-.34-1.4-.5-2.02-.5-.64 0-1.33.16-2.07.5-.74.34-1.34.51-1.8.52-.68.03-1.36-.22-2.03-.75-.45-.34-.95-.9-1.5-1.7-.6-.86-1.09-1.87-1.48-3.02-.42-1.25-.63-2.46-.63-3.63 0-1.34.29-2.5.87-3.47a5.1 5.1 0 0 1 1.83-1.86 4.9 4.9 0 0 1 2.48-.7c.55 0 1.28.17 2.18.51.9.34 1.48.51 1.73.51.19 0 .83-.2 1.9-.6 1.02-.37 1.88-.52 2.6-.46 1.92.16 3.36.91 4.31 2.27-1.72 1.04-2.57 2.5-2.56 4.36.01 1.45.53 2.66 1.55 3.62.46.44.98.78 1.55 1.02-.13.36-.26.7-.4 1.02z"
      />
    </Svg>
  );
}

// Android "bugdroid" head — Android download row.
export function AndroidIcon({ size = 20, color = '#000' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fill={color}
        d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.85 1.23 12.95 1 12 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31C6.97 3.26 6 5.01 6 7h12c0-1.99-.97-3.75-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z"
      />
    </Svg>
  );
}
