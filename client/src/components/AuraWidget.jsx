import { useState } from "react";
import AuraChat from "./AuraChat.jsx";

export default function AuraWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating Button */}
      <div
        role="button"
        tabIndex={0}
        aria-label={open ? "Close AURA" : "Open AURA"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          width: "65px",
          height: "65px",
          borderRadius: "50%",
          background: "linear-gradient(145deg, #d4af37, #000)",
          color: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: "bold",
          cursor: "pointer",
          zIndex: 9999,
          boxShadow: "0 0 20px #d4af37",
          animation: "aura-widget-pulse 2s infinite",
        }}
      >
        AURA
      </div>

      {/* Chat Panel */}
      {open ? (
        <div
          style={{
            position: "fixed",
            bottom: "100px",
            right: "20px",
            width: "min(300px, calc(100vw - 40px))",
            maxHeight: "min(70vh, 560px)",
            overflow: "auto",
            zIndex: 9999,
          }}
        >
          <AuraChat embedded onRequestClose={() => setOpen(false)} />
        </div>
      ) : null}

      {/* Glow Animation */}
      <style>
        {`
          @keyframes aura-widget-pulse {
            0% { box-shadow: 0 0 10px #d4af37; }
            50% { box-shadow: 0 0 30px #d4af37; }
            100% { box-shadow: 0 0 10px #d4af37; }
          }
        `}
      </style>
    </>
  );
}
