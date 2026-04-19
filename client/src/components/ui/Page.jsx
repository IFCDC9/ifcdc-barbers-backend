import React from "react";
import { theme } from "./theme.js";

export function Page({ children }) {
  return (
    <div style={{ maxWidth: theme.layout.maxWidth, margin: "0 auto", padding: "48px 16px" }}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, right }) {
  return (
    <header style={styles.header}>
      <div style={{ display: "grid", gap: 10 }}>
        <h1 style={styles.title}>{title}</h1>
        {subtitle ? <p style={styles.subtitle}>{subtitle}</p> : null}
      </div>
      {right ? <div style={styles.right}>{right}</div> : null}
    </header>
  );
}

const styles = {
  header: {
    padding: "22px 22px",
    borderRadius: theme.radius.lg,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.subtle,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },
  title: { margin: 0, fontSize: 34, letterSpacing: -0.6, color: theme.colors.text },
  subtitle: { margin: 0, fontSize: 14, color: theme.colors.muted },
  right: { marginLeft: "auto" },
};

