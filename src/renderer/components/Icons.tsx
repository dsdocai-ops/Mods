// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).

/**
 * A shared line-icon set (stroke="currentColor", so every icon inherits its container's color for
 * free - dim when inactive, white/red when active/hover) instead of each screen inventing its own
 * ad hoc SVGs. Matches the reference design's icon language: simple, geometric, two-tone.
 */
const base = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function HomeIcon(props: { size?: number; className?: string }) {
  return (
    <svg {...base} width={props.size ?? 18} height={props.size ?? 18} className={props.className}>
      <path d="M3 11 12 4l9 7" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

export function PlayIcon(props: { size?: number; className?: string }) {
  return (
    <svg {...base} width={props.size ?? 18} height={props.size ?? 18} className={props.className}>
      <path d="M6 4.5v15l13-7.5Z" />
    </svg>
  );
}

export function ModsIcon(props: { size?: number; className?: string }) {
  return (
    <svg {...base} width={props.size ?? 18} height={props.size ?? 18} className={props.className}>
      <path d="M9 3.5a1.5 1.5 0 0 1 3 0V4h2a1 1 0 0 1 1 1v2h.5a1.5 1.5 0 0 1 0 3H15v2a1 1 0 0 1-1 1h-2v.5a1.5 1.5 0 0 1-3 0V13H7a1 1 0 0 1-1-1v-2h-.5a1.5 1.5 0 0 1 0-3H6V5a1 1 0 0 1 1-1h2Z" />
    </svg>
  );
}

export function CosmeticsIcon(props: { size?: number; className?: string }) {
  return (
    <svg {...base} width={props.size ?? 18} height={props.size ?? 18} className={props.className}>
      <path d="M8 4 4 6.5 6 9l2-1.2V19a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7.8L18 9l2-2.5L16 4a4 4 0 0 1-8 0Z" />
    </svg>
  );
}

export function SettingsIcon(props: { size?: number; className?: string }) {
  return (
    <svg {...base} width={props.size ?? 18} height={props.size ?? 18} className={props.className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M21 12h-2.2M5.2 12H3M18 6l-1.5 1.5M7.5 16.5 6 18M18 18l-1.5-1.5M7.5 7.5 6 6" />
    </svg>
  );
}

export function AboutIcon(props: { size?: number; className?: string }) {
  return (
    <svg {...base} width={props.size ?? 18} height={props.size ?? 18} className={props.className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.01" />
    </svg>
  );
}

export function ChevronDownIcon(props: { size?: number; className?: string }) {
  return (
    <svg {...base} width={props.size ?? 16} height={props.size ?? 16} className={props.className}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function ExternalLinkIcon(props: { size?: number; className?: string }) {
  return (
    <svg {...base} width={props.size ?? 14} height={props.size ?? 14} className={props.className}>
      <path d="M9 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3M14 4h6v6M20 4 11 13" />
    </svg>
  );
}

export function MoreVerticalIcon(props: { size?: number; className?: string }) {
  return (
    <svg {...base} width={props.size ?? 16} height={props.size ?? 16} className={props.className}>
      <circle cx="12" cy="5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function GitHubIcon(props: { size?: number; className?: string }) {
  return (
    <svg width={props.size ?? 18} height={props.size ?? 18} viewBox="0 0 24 24" fill="currentColor" className={props.className}>
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.36 1.09 2.93.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.95 0-1.1.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.4 9.4 0 0 1 5 0c1.9-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.69 0 3.85-2.34 4.7-4.57 4.94.36.31.68.92.68 1.85v2.75c0 .26.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  );
}
