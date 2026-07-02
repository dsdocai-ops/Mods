import { useEffect, useRef } from "react";

interface Props {
  lines: string[];
}

/** How close to the bottom (px) still counts as "following the log" for autoscroll purposes. */
const PINNED_THRESHOLD_PX = 48;

export default function ConsoleLog({ lines }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Whether the user is at (or near) the bottom. Tracked in a ref updated by onScroll so new lines
  // only autoscroll when the user is actually following the tail - scrolling up to read an earlier
  // error used to get yanked back to the bottom on every incoming line.
  const pinnedRef = useRef(true);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < PINNED_THRESHOLD_PX;
  };

  useEffect(() => {
    if (pinnedRef.current) {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [lines.length]);

  return (
    <div className="console-log" ref={containerRef} onScroll={handleScroll}>
      {lines.length === 0 && <p className="console-empty">No output yet. Launch the instance to see logs here.</p>}
      {lines.map((line, i) => (
        <div key={i} className={`console-line ${line.startsWith("[err]") ? "console-line-err" : ""}`}>
          {line}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
