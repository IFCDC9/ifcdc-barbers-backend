import React from "react";

/**
 * If AURA fails to render, the rest of the SPA (nav, routes) still works.
 */
export default class AuraErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.warn("[ifcdc] AURA suppressed render error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
