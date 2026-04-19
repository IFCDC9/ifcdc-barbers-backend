import { NavLink, useNavigate } from "react-router-dom";

export default function AppNav({ variant = "bottom" }) {
  const navigate = useNavigate();

  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("user"));
  } catch {
    user = null;
  }
  const isLoggedIn = Boolean(user);
  const canSeeAdminTab = user?.role === "super_admin" || user?.role === "admin";
  const canSeeBarberSettings = user?.role === "barber" || canSeeAdminTab;

  const tabs = [
    { to: "/", icon: "⌂", label: "Home", end: true },
    { to: "/barbers", icon: "✂", label: "Barbers" },
    { to: "/styles", icon: "✦", label: "Styles" },
    { to: "/phone", icon: "☎", label: "Phone" },
    ...(canSeeBarberSettings ? [{ to: "/barber-settings", icon: "◆", label: "Shop" }] : []),
    ...(canSeeAdminTab ? [{ to: "/admin", icon: "⚙", label: "Admin" }] : []),
    ...(!isLoggedIn ? [{ to: "/login", icon: "🔐", label: "Auth" }] : []),
  ];

  const navClass =
    variant === "sidebar"
      ? "ifcdc-nav ifcdc-nav--sidebar"
      : variant === "top"
        ? "ifcdc-nav ifcdc-nav--top"
        : "ifcdc-bottom-nav ifcdc-main-nav";

  return (
    <nav className={navClass} aria-label="Main navigation">
      {tabs.map(({ to, label, icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          aria-label={label}
          className={({ isActive }) =>
            `ifcdc-bottom-nav__link ifcdc-nav-tab${isActive ? " ifcdc-nav-tab--active" : ""}`
          }
        >
          <span className="ifcdc-bottom-nav__glyph" aria-hidden>
            {icon}
          </span>
          <span className="ifcdc-bottom-nav__text">{label}</span>
        </NavLink>
      ))}

      {isLoggedIn ? (
        <button
          type="button"
          className="ifcdc-bottom-nav__link ifcdc-bottom-nav__link--button ifcdc-nav-tab"
          onClick={() => {
            try {
              localStorage.removeItem("token");
              localStorage.removeItem("user");
            } catch {
              /* ignore */
            }
            navigate("/", { replace: true });
          }}
          aria-label="Logout"
        >
          <span className="ifcdc-bottom-nav__glyph" aria-hidden>
            ⎋
          </span>
          <span className="ifcdc-bottom-nav__text">Logout</span>
        </button>
      ) : null}
    </nav>
  );
}
