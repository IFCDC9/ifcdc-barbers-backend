import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuraChat from "./AuraChat.jsx";

/**
 * Global AURA assistant — floating button (gold glow), opens chat panel on every route.
 */
export default function Aura() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <button
        type="button"
        className="aura-container"
        aria-label={open ? "Close AURA assistant" : "Open AURA assistant"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="aura-core">
          <span className="aura-core__label">AURA</span>
        </span>
      </button>

      {open ? (
        <div className="aura-chat-dock" role="dialog" aria-modal="true" aria-label="AURA AI assistant">
          <AuraChat embedded navigate={navigate} onRequestClose={() => setOpen(false)} />
        </div>
      ) : null}
    </>
  );
}
