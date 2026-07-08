// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
// Monochrome line icons (stroke: currentColor) matching the Omega design sheet - every icon
// inherits its color from the surrounding text so active/inactive/hover states come for free.
interface IconProps {
  size?: number;
}

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

/** Filled play triangle - the one icon the design sheet fills solid (PLAY buttons, Play nav item). */
export function PlayIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)} fill="currentColor" stroke="none">
      <path d="M7 4.8c0-.9 1-1.5 1.8-1L19 10.9c.8.5.8 1.7 0 2.2L8.8 19.3c-.8.5-1.8-.1-1.8-1V4.8z" />
    </svg>
  );
}

export function HomeIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4 10.2L12 3.6l8 6.6V20a1 1 0 0 1-1 1h-4.6v-6.4h-4.8V21H5a1 1 0 0 1-1-1v-9.8z" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M6 9.5l6 6 6-6" />
    </svg>
  );
}

export function ArrowRightIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4 12h16M13 5l7 7-7 7" />
    </svg>
  );
}

export function GearIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09c0 .68.4 1.3 1.03 1.56a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9c.26.63.88 1.03 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.03z" />
    </svg>
  );
}

export function PlusIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function XIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function InfoIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" strokeWidth="2.2" />
    </svg>
  );
}

/** Isometric block outline - the monochrome take on the design sheet's Minecraft block icon. */
export function CubeIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 2.6l8 4.6v9.6l-8 4.6-8-4.6V7.2l8-4.6z" />
      <path d="M12 12l8-4.6M12 12v9.2M12 12L4 7.4" />
    </svg>
  );
}

export function PuzzleIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M9.5 4.5a2 2 0 1 1 4 0V6H16a2 2 0 0 1 2 2v2.5h1.5a2 2 0 1 1 0 4H18V19a2 2 0 0 1-2 2h-2.5v-1.5a2 2 0 1 0-4 0V21H7a2 2 0 0 1-2-2v-2.5H3.5a2 2 0 1 1 0-4H5V8a2 2 0 0 1 2-2h2.5V4.5z" />
    </svg>
  );
}
