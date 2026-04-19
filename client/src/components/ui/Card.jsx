import React from "react";
import { theme } from "./theme.js";

export function Card({ children, style }) {
  return <div style={{ ...styles.card, ...style }}>{children}</div>;
}

export function CardTitle({ children }) {
  return <div style={styles.title}>{children}</div>;
}

export function CardBody({ children }) {
  return <div style={styles.body}>{children}</div>;
}

const styles = {
  card: {
    padding: "14px 14px",
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.card,
  },
  title: {
    fontWeight: 900,
    fontSize: 12,
    letterSpacing: 1.4,
    color: "rgba(238,242,255,0.85)",
    marginBottom: 10,
    textTransform: "uppercase",
  },
  body: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 1.5,
  },
};

