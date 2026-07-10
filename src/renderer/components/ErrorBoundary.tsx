// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
import React from "react";

interface State {
  error: Error | null;
  componentStack: string | null;
}

/**
 * Catches render/lifecycle errors anywhere below it and shows the actual error instead of the blank
 * white window an uncaught React error otherwise produces (React 18 unmounts the whole tree on an
 * unhandled render error, and with no boundary that leaves an empty page with no clue what broke).
 * The message + stack are shown on screen and logged, so a packaged build that crashes is
 * self-diagnosing rather than a silent white-out.
 */
export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Also lands in the main-process/packaged log via the renderer console.
    console.error("Renderer error:", error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  render() {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="app-shell error-screen">
        <div className="error-box">
          <h1>Something went wrong</h1>
          <p>The launcher hit an error while rendering. This is the detail we need to fix it:</p>
          <pre className="error-detail">
            {error.message}
            {"\n\n"}
            {error.stack ?? ""}
            {componentStack ?? ""}
          </pre>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
