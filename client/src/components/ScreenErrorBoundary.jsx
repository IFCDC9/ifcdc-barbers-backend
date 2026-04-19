import React from "react";

export default class ScreenErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "", stack: "" };
  }

  static getDerivedStateFromError(error) {
    const e = error instanceof Error ? error : new Error(String(error));
    return { hasError: true, message: e.message || String(e), stack: e.stack || "" };
  }

  componentDidCatch(error) {
    // Keep console logging for desktop debugging, but always show something on-screen on mobile.
    console.error("[ScreenErrorBoundary]", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            background: "black",
            color: "white",
            height: "100vh",
            padding: "16px",
            overflow: "auto",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
            fontSize: "13px",
            lineHeight: 1.4,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 8 }}>IFCDC app crashed</div>
          <div style={{ opacity: 0.95, marginBottom: 12 }}>{this.state.message}</div>
          {this.state.stack ? (
            <pre style={{ whiteSpace: "pre-wrap", opacity: 0.75 }}>{this.state.stack}</pre>
          ) : null}
        </div>
      );
    }
    return this.props.children;
  }
}

