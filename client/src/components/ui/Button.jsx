import React from "react";
import { theme } from "./theme.js";

export function Button({ children, variant = "indigo", disabled, style, type = "button", ...props }) {
  const base = {
    width: "100%",
    cursor: disabled ? "not-allowed" : "pointer",
    padding: "10px 12px",
    borderRadius: theme.radius.sm,
    fontWeight: 900,
    fontSize: 14,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: "rgba(255,255,255,0.06)",
    color: "rgba(238,242,255,0.50)",
  };

  const variants = {
    indigo: {
      border: `1px solid ${theme.colors.indigoBorder}`,
      backgroundColor: theme.colors.indigoBg,
      color: "rgba(238,242,255,0.98)",
    },
    green: {
      border: `1px solid ${theme.colors.greenBorder}`,
      backgroundColor: theme.colors.greenBg,
      color: "rgba(238,242,255,0.98)",
    },
  };

  const applied = disabled ? base : { ...base, ...variants[variant] };

  return (
    <button type={type} disabled={disabled} style={{ ...applied, ...style }} {...props}>
      {children}
    </button>
  );
}

