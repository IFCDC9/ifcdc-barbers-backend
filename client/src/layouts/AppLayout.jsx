import React from "react";
import { Outlet } from "react-router-dom";
import AppHeader from "../components/AppHeader.jsx";
import MobileBottomNav from "../components/MobileBottomNav.jsx";
import "../styles/shell.css";

export default function AppLayout() {
  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">
        <Outlet />
      </main>
      <MobileBottomNav />
    </div>
  );
}
