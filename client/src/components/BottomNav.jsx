import { NavLink } from "react-router-dom";

const tabs = [
  { to: "/", icon: "⌂", label: "Home", end: true },
  { to: "/barbers", icon: "✂", label: "Barbers" },
  { to: "/booking", icon: "📅", label: "Book" },
  { to: "/phone", icon: "☎", label: "Phone" },
  { to: "/admin", icon: "⚙", label: "Admin" },
];

export default function BottomNav() {
  return (
    <nav className="ifcdc-bottom-nav ifcdc-main-nav" aria-label="Main navigation">
      {tabs.map(({ to, label, icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          aria-label={label}
          className={({ isActive }) =>
            isActive ? "ifcdc-bottom-nav__link ifcdc-bottom-nav__link--active" : "ifcdc-bottom-nav__link"
          }
        >
          <span className="ifcdc-bottom-nav__glyph" aria-hidden>
            {icon}
          </span>
          <span className="ifcdc-bottom-nav__text">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
