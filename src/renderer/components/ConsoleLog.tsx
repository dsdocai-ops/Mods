// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import { useEffect, useRef } from "react";

interface Props {
  lines: string[];
}

/** How close to the bottom (px) still counts as "following the log" for autoscroll purposes. */
const PINNED_THRESHOLD_PX = 48;

export default function ConsoleLog({ lines }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Whether the user is at (or near) the bottom. Tracked in a ref updated by onScroll so new lines
  // only autoscroll when the user is actually following the tail - scrolling up to read an earlier
  // error used to get yanked back to the bottom on every incoming line.
  const pinnedRef = useRef(true);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < PINNED_THRESHOLD_PX;
  };

  // Scroll the console's OWN scrollTop, never scrollIntoView: scrollIntoView scrolls every
  // scrollable ancestor too, so each incoming line also yanked the page (.main-area) down to the
  // console's bottom edge - scrolling the instance page up while a game streamed output was a
  // constant losing fight. Depends on `lines`, not `lines.length`: the log is capped at
  // MAX_LOG_LINES, after which the length never changes again and autoscroll silently died.
  useEffect(() => {
    const el = containerRef.current;
    if (el && pinnedRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [lines]);

  return (
    <div className="console-log" ref={containerRef} onScroll={handleScroll}>
      {lines.length === 0 && <p className="console-empty">No output yet. Launch the instance to see logs here.</p>}
      {lines.map((line, i) => (
        <div key={i} className={`console-line ${line.startsWith("[err]") ? "console-line-err" : ""}`}>
          {line}
        </div>
      ))}
    </div>
  );
}
