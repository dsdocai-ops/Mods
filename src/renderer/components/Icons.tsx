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

/** T-shirt outline - the design sheet's Cosmetics icon. */
export function ShirtIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M8.5 3.5L4 6l1.6 3.2 2.1-.7V20a1 1 0 0 0 1 1h6.6a1 1 0 0 0 1-1V8.5l2.1.7L20 6l-4.5-2.5a3.2 3.2 0 0 1-7 0z" />
    </svg>
  );
}

export function DiscordIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.3 5.4A17 17 0 0 0 15 4l-.2.4a12.6 12.6 0 0 1 3.7 1.9 12 12 0 0 0-10.1 0A12.6 12.6 0 0 1 12.2 4.4L12 4a17 17 0 0 0-4.3 1.4C4.9 9.6 4.2 13.6 4.5 17.6a17 17 0 0 0 5.2 2.6l.4-.6a11 11 0 0 1-1.7-.8l.4-.3a8.5 8.5 0 0 0 7.2 0l.4.3c-.5.3-1.1.6-1.7.8l.4.6a17 17 0 0 0 5.2-2.6c.4-4.7-.7-8.6-2.6-12.2zM9.7 15.2c-.8 0-1.5-.8-1.5-1.7 0-1 .7-1.7 1.5-1.7s1.6.8 1.5 1.7c0 1-.7 1.7-1.5 1.7zm4.6 0c-.8 0-1.5-.8-1.5-1.7 0-1 .7-1.7 1.5-1.7s1.6.8 1.5 1.7c0 1-.7 1.7-1.5 1.7z" />
    </svg>
  );
}

export function GitHubIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2z" />
    </svg>
  );
}

export function GlobeIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.5 3.8 5.7 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.7-3.8-9S9.5 5.5 12 3z" />
    </svg>
  );
}

/** Small external-link glyph shown after "Browse mods" / social labels in the design sheet. */
export function ExternalLinkIcon({ size = 14 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M14 4h6v6" />
      <path d="M20 4l-9 9" />
      <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </svg>
  );
}
