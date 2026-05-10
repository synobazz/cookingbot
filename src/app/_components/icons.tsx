// Inline-SVG-Icon-Set. Alle Icons stammen 1:1 aus docs/redesign/cookingbot-redesign.html.
// Stroke-width: 2 (Default). aria-hidden, weil Icons in Buttons/Links immer mit Text-Label kommen.

import type { SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "xmlns" | "viewBox" | "fill" | "stroke">;

const base: SVGProps<SVGSVGElement> = {
  className: "ico",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  "aria-hidden": true,
};

export function HomeIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M3 12l9-9 9 9" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

export function BookIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M4 4h12a4 4 0 014 4v12H8a4 4 0 01-4-4V4z" />
      <path d="M4 4v12a4 4 0 004 4" />
    </svg>
  );
}

export function CalendarIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

export function CartIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M5 7h14l-1.5 11a2 2 0 01-2 1.7H8.5a2 2 0 01-2-1.7L5 7z" />
      <path d="M9 7V5a3 3 0 016 0v2" />
    </svg>
  );
}

export function CogIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 008.6 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 8.6a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

export function LogoutIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

export function SearchIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function RefreshIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M21 12a9 9 0 11-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

export function PlusIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function ClockIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function PeopleIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2" />
      <circle cx="10" cy="7" r="4" />
    </svg>
  );
}

export function StarIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M12 2l3 7h7l-5.5 4 2 7-6.5-4.5L5.5 20l2-7L2 9h7z" />
    </svg>
  );
}

export function ShuffleIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M3 12a9 9 0 0118 0M3 12a9 9 0 0018 0M3 12l3-3M21 12l-3-3M3 12l3 3M21 12l-3 3" />
    </svg>
  );
}

export function CheckIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function CloseIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export function ChevronDownIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function DownloadIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}

export function EyeIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function EyeOffIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M17.94 17.94A10.94 10.94 0 0112 19c-7 0-10-7-10-7a18.93 18.93 0 014.22-5.19M9.9 4.24A10.94 10.94 0 0112 4c7 0 10 7 10 7a18.5 18.5 0 01-2.16 3.19M14.12 14.12A3 3 0 1112 9" />
      <path d="M2 2l20 20" />
    </svg>
  );
}

export function HeartIcon(p: IconProps & { filled?: boolean }) {
  const { filled, ...rest } = p;
  return (
    <svg {...base} fill={filled ? "currentColor" : "none"} {...rest}>
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  );
}

export function GridIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <rect x="3" y="3" width="8" height="8" />
      <rect x="13" y="3" width="8" height="8" />
      <rect x="3" y="13" width="8" height="8" />
      <rect x="13" y="13" width="8" height="8" />
    </svg>
  );
}

export function MenuIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

export function ListCheckIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  );
}

export function TrashIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 1.7H8a2 2 0 01-2-1.7L5 6" />
    </svg>
  );
}

export function PantryIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M5 3h14v18H5z" />
      <path d="M5 9h14M5 15h14" />
      <circle cx="9" cy="6" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="9" cy="18" r="1" />
    </svg>
  );
}

export function HeartPulseIcon(p: IconProps) {
  return (
    <svg {...base} {...p}>
      <path d="M12 21s-7-4.5-9.5-9A5 5 0 0112 6a5 5 0 019.5 6c-.6 1-1.4 2-2.4 2.9" />
      <path d="M3 12h4l2-3 3 6 2-3h7" />
    </svg>
  );
}
