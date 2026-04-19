import React from "react";
import { theme } from "./ui/theme.js";
import { USER_PUBLIC_KEY } from "../lib/authSession.js";

export default function Navbar({ route, navigate, isLoggedIn, onLogout }) {
  const [publicUser, setPublicUser] = React.useState(null);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(USER_PUBLIC_KEY);
      setPublicUser(raw ? JSON.parse(raw) : null);
    } catch {
      setPublicUser(null);
    }
  }, [route]);

  const onNav = (to) => (e) => {
    e.preventDefault();
    navigate(to);
  };

  const onLogoutClick = (e) => {
    e.preventDefault();
    onLogout?.();
  };

  const onPublicLogout = (e) => {
    e.preventDefault();
    try {
      window.localStorage.removeItem(USER_PUBLIC_KEY);
    } catch {
      /* ignore */
    }
    setPublicUser(null);
    navigate("/");
  };

  return (
    <header style={styles.header}>
      <div style={styles.inner}>
        <a href="#/" onClick={onNav("/")} style={styles.brandLink} aria-label="IFCDC Home">
          <div style={styles.brand}>IFCDC</div>
        </a>
        <nav style={styles.nav}>
          <a href="#/" onClick={onNav("/")} style={route?.name === "home" ? styles.linkActive : styles.link}>Home</a>
          <a href="#/barbers" onClick={onNav("/barbers")} style={route?.name === "barbers" ? styles.linkActive : styles.link}>Barbers</a>
          <a href="#/about" onClick={onNav("/about")} style={route?.name === "about" ? styles.linkActive : styles.link}>
            About
          </a>
          <a
            href="#contact"
            onClick={(e) => {
              e.preventDefault();
              navigate("/");
              window.setTimeout(() => {
                document.getElementById("contact")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 60);
            }}
            style={styles.link}
          >
            Contact
          </a>
          {isLoggedIn ? (
            <>
              <a
                href="#/dashboard"
                onClick={onNav("/dashboard")}
                style={route?.name === "dashboard" ? styles.linkActive : styles.link}
              >
                Dashboard
              </a>
              <a href="#/logout" onClick={onLogoutClick} style={styles.link}>
                Logout
              </a>
            </>
          ) : publicUser?.name ? (
            <>
              <span style={styles.hiUser}>Hi, {publicUser.name}</span>
              <a href="#/logout" onClick={onPublicLogout} style={styles.link}>
                Sign out
              </a>
            </>
          ) : (
            <a href="#/login" onClick={onNav("/login")} style={route?.name === "login" ? styles.linkActive : styles.link}>
              Login
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}

const styles = {
  header: {
    position: "sticky",
    top: 0,
    zIndex: 50,
    backdropFilter: "blur(10px)",
    backgroundColor: "rgba(11, 11, 15, 0.80)",
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  inner: {
    maxWidth: 1040,
    margin: "0 auto",
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  brand: {
    fontWeight: 800,
    letterSpacing: 1.2,
    fontSize: 16,
  },
  brandLink: {
    textDecoration: "none",
    color: "inherit",
  },
  nav: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
  },
  link: {
    color: "rgba(238,242,255,0.9)",
    textDecoration: "none",
    fontSize: 14,
    padding: "8px 10px",
    borderRadius: 10,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.subtle,
  },
  linkActive: {
    color: "rgba(238,242,255,0.98)",
    textDecoration: "none",
    fontSize: 14,
    padding: "8px 10px",
    borderRadius: 10,
    border: `1px solid ${theme.colors.indigoBorder}`,
    backgroundColor: theme.colors.indigoBg,
  },
  hiUser: {
    fontSize: 13,
    color: theme.colors.muted,
    fontWeight: 700,
    padding: "0 4px",
  },
};

