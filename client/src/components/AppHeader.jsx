import React, { useState } from "react";
import { NavLink } from "react-router-dom";
const links = [
  { to: "/", label: "Home" },
  { to: "/barbers", label: "Barbers" },
  { to: "/booking", label: "Book" },
  { to: "/about", label: "About" },
  { to: "/admin", label: "Admin" },
];

export default function AppHeader() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="app-header">
        <NavLink to="/" className="app-header__brand" onClick={() => setOpen(false)}>
          IFCDC <span>Barbers</span>
        </NavLink>

        <nav className="app-header__nav" aria-label="Primary">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) => (isActive ? "active" : undefined)}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="app-header__actions">
          <NavLink to="/login" className="btn btn-ghost" style={{ fontSize: "0.85rem", padding: "0.5rem 0.9rem" }}>
            Sign in
          </NavLink>
          <NavLink to="/register" className="btn btn-primary" style={{ fontSize: "0.85rem", padding: "0.5rem 1rem" }}>
            Join
          </NavLink>
          <button
            type="button"
            className="menu-toggle"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>

      <div className="mobile-drawer" data-open={open ? "true" : "false"} aria-hidden={!open}>
        <button
          type="button"
          className="mobile-drawer__backdrop"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
        <div className="mobile-drawer__panel">
          <div style={{ fontFamily: "var(--ifcdc-font-display)", fontSize: "1.35rem", fontWeight: 700 }}>
            Menu
          </div>
          <nav className="mobile-drawer__links" aria-label="Mobile">
            {links.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                onClick={() => setOpen(false)}
                className={({ isActive }) => (isActive ? "active" : undefined)}
              >
                {label}
              </NavLink>
            ))}
            <NavLink to="/login" onClick={() => setOpen(false)}>
              Sign in
            </NavLink>
            <NavLink to="/register" onClick={() => setOpen(false)}>
              Create account
            </NavLink>
          </nav>
        </div>
      </div>
    </>
  );
}
