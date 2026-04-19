import { Outlet } from "react-router-dom";
import AppNav from "../components/AppNav.jsx";
import { useDevice } from "../hooks/useDevice.js";

export default function MainLayout() {
  const device = useDevice();

  const nav =
    device === "mobile" ? <AppNav variant="bottom" /> : device === "tablet" ? <AppNav variant="top" /> : <AppNav variant="sidebar" />;

  return (
    <div className={`ifcdc-shell ifcdc-shell--${device} ifcdc-no-x pb-safe pt-safe`} data-device={device}>
      {device === "desktop" ? (
        <aside className="ifcdc-shell__sidebar">{nav}</aside>
      ) : device === "tablet" ? (
        <header className="ifcdc-shell__topnav">{nav}</header>
      ) : null}

      <main className="ifcdc-shell__main premium-stage">
        <div className="ifcdc-layout-container">
          <Outlet />
        </div>
      </main>

      {device === "mobile" ? nav : null}
    </div>
  );
}
