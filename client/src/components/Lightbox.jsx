import { useEffect } from "react";

export default function Lightbox({ open, src, alt = "", onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="ifcdc-lightbox" role="dialog" aria-modal="true" aria-label="Image preview">
      <button type="button" className="ifcdc-lightbox__backdrop" aria-label="Close" onClick={() => onClose?.()} />
      <div className="ifcdc-lightbox__panel">
        <img className="ifcdc-lightbox__img" src={src} alt={alt} />
        <button type="button" className="ifcdc-lightbox__close" onClick={() => onClose?.()}>
          Close
        </button>
      </div>
    </div>
  );
}

