// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./styles.css";

// Belt-and-suspenders around the ErrorBoundary: it only catches React render/lifecycle errors, not
// errors thrown from async callbacks, event handlers, or module top-level. Those would otherwise
// leave a silent white window in a packaged build with no console visible. This paints the error
// onto the page (inline-styled so it doesn't depend on any CSS/React having rendered) so a crash is
// always readable/screenshottable instead of a blank white-out.
function paintFatalError(label: string, detail: string) {
  const existing = document.getElementById("omega-fatal-error");
  if (existing) {
    existing.textContent += `\n\n${label}: ${detail}`;
    return;
  }
  const box = document.createElement("pre");
  box.id = "omega-fatal-error";
  box.style.cssText =
    "position:fixed;inset:0;margin:0;padding:24px;background:#0a0a0a;color:#f5f5f5;font:12px/1.5 monospace;white-space:pre-wrap;overflow:auto;z-index:99999;";
  box.textContent = `Omega Client hit an error. Please screenshot this and send it over:\n\n${label}: ${detail}`;
  document.body.appendChild(box);
}

window.addEventListener("error", (e) => paintFatalError("Error", (e.error?.stack ?? e.error?.message ?? e.message ?? "unknown").toString()));
window.addEventListener("unhandledrejection", (e) => paintFatalError("Unhandled rejection", (e.reason?.stack ?? e.reason?.message ?? String(e.reason)).toString()));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
