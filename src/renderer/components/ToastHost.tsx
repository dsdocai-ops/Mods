import { useEffect, useState } from "react";
import { onToast, type ToastPayload } from "../toast";

export default function ToastHost() {
  const [toasts, setToasts] = useState<ToastPayload[]>([]);

  useEffect(() => {
    return onToast((payload) => {
      setToasts((prev) => [...prev, payload]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== payload.id));
      }, 3200);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-host">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
