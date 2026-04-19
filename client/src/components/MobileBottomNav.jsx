import React from "react";
import { NavLink } from "react-router-dom";

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" />
    </svg>
  );
}

function IconScissors() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="7" cy="7" r="3" />
      <circle cx="17" cy="17" r="3" />
      <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M4 11h16" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6M12 8h.01" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="9" r="3.5" />
      <path d="M6 19.5c0-3 2.5-4.5 6-4.5s6 1.5 6 4.5" />
    </svg>
  );
}

const items = [
  { to: "/", label: "Home", icon: IconHome, end: true },
  { to: "/barbers", label: "Barbers", icon: IconScissors },
  { to: "/booking", label: "Book", icon: IconCalendar },
  { to: "/about", label: "About", icon: IconInfo },
  { to: "/login", label: "Account", icon: IconUser },
];

export default function MobileBottomNav() {
  return (
    <nav className="mobile-bottom-nav" aria-label="Quick navigation">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? "active" : undefined)}>
          <Icon />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
