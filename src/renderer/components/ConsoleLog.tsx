import { useEffect, useRef } from "react";

interface Props {
  lines: string[];
}

export default function ConsoleLog({ lines }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [lines.length]);

  return (
    <div className="console-log">
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
