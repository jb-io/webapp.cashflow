/** Strichsymbole, 24er-Raster, erben die Textfarbe. */
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base: IconProps = {
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
};

export const IconChart = (p: IconProps) => (
  <svg {...base} {...p}><path d="M3 17l5-6 4 4 5-7 4 5" /><path d="M3 21h18" /></svg>
);
export const IconList = (p: IconProps) => (
  <svg {...base} {...p}><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3.5" cy="6" r="1.2" /><circle cx="3.5" cy="12" r="1.2" /><circle cx="3.5" cy="18" r="1.2" /></svg>
);
export const IconTags = (p: IconProps) => (
  <svg {...base} {...p}><path d="M3 5.5A2.5 2.5 0 015.5 3H10l9 9-6.5 6.5L3 9.5z" /><circle cx="7.6" cy="7.6" r="1.3" /></svg>
);
export const IconWallet = (p: IconProps) => (
  <svg {...base} {...p}><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18" /><circle cx="16.5" cy="14.5" r="1.2" /></svg>
);
export const IconPlus = (p: IconProps) => (<svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>);
export const IconCopy = (p: IconProps) => (
  <svg {...base} {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 012-2h9" /></svg>
);
export const IconMore = (p: IconProps) => (
  <svg {...base} {...p}><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></svg>
);
export const IconPower = (p: IconProps) => (<svg {...base} {...p}><path d="M12 4v8" /><path d="M7.5 6.8a7 7 0 109 0" /></svg>);
export const IconTrash = (p: IconProps) => (
  <svg {...base} {...p}><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" /></svg>
);
export const IconWarn = (p: IconProps) => (
  <svg {...base} {...p}><path d="M12 4l9 16H3z" /><path d="M12 10v4" /><circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none" /></svg>
);
export const IconChevronLeft = (p: IconProps) => (<svg {...base} {...p}><path d="M14 6l-6 6 6 6" /></svg>);
export const IconChevronRight = (p: IconProps) => (<svg {...base} {...p}><path d="M10 6l6 6-6 6" /></svg>);
export const IconEmpty = (p: IconProps) => (
  <svg {...base} {...p}><rect x="3" y="5" width="18" height="15" rx="2.5" /><path d="M3 10h18M8 15h8" /></svg>
);
