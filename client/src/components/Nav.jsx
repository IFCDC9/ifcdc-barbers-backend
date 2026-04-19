import React from "react";
import { NavLink } from "react-router-dom";

const TABS = [
  { to: "/", label: "Home", end: true },
  { to: "/barbers", label: "Barbers" },
  { to: "/booking", label: "Booking" },
  { to: "/about", label: "About" },
  { to: "/admin", label: "Admin" },
];

export default function Nav() {
  return (
    <>
      <header className="nav-bar nav-bar--top" role="banner">
        <NavLink to="/" className="nav-bar__brand" end>
          IFCDC <span className="nav-bar__brand-accent">BARBERS</span>
        </NavLink>
      </header>
      <nav className="bottom-nav" aria-label="Main navigation">
        {TABS.map(({ to, label, end }) => (
          <NavLink
            key={to + label}
            to={to}
            end={Boolean(end)}
            className={({ isActive }) =>
              "bottom-nav__link" + (isActive ? " bottom-nav__link--active" : "")
            }
          >
            <span className="bottom-nav__label">{label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
