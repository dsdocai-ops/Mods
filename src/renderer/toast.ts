// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
export type ToastKind = "info" | "success" | "error";

export interface ToastPayload {
  id: number;
  message: string;
  kind: ToastKind;
}

let counter = 0;
const TOAST_EVENT = "omega:toast";

export function toast(message: string, kind: ToastKind = "info"): void {
  const payload: ToastPayload = { id: ++counter, message, kind };
  window.dispatchEvent(new CustomEvent<ToastPayload>(TOAST_EVENT, { detail: payload }));
}

export function onToast(callback: (payload: ToastPayload) => void): () => void {
  const listener = (e: Event) => callback((e as CustomEvent<ToastPayload>).detail);
  window.addEventListener(TOAST_EVENT, listener);
  return () => window.removeEventListener(TOAST_EVENT, listener);
}
