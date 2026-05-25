const SUGGESTIONS = ["Signature cut", "Fade", "Beard trim", "Lineup", "Kids cut", "Hot towel shave"];

function emptyRow() {
  return { name: "", price: "35", duration_minutes: 30 };
}

export default function StepServices({ draft, setDraft }) {
  const rows = draft.services?.length ? draft.services : [emptyRow()];

  const setRows = (next) => setDraft((d) => ({ ...d, services: next }));

  const addSuggestion = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const filtered = rows.filter((r) => r.name.trim());
    setRows([...filtered, { name: trimmed, price: "35", duration_minutes: 30 }]);
  };

  const updateRow = (i, patch) => {
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };

  const addRow = () => setRows([...rows, emptyRow()]);

  const removeRow = (i) => {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, j) => j !== i));
  };

  return (
    <>
      <p className="ifcdc-onboarding-hint">Each service defaults to 30 minutes. Tap a suggestion or add your own.</p>
      <div className="ifcdc-onboarding-suggest">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" className="ifcdc-onboarding-chip" onClick={() => addSuggestion(s)}>
            + {s}
          </button>
        ))}
      </div>
      {rows.map((row, i) => (
        <div
          key={i}
          style={{
            marginBottom: "1rem",
            paddingBottom: "0.85rem",
            borderBottom: i < rows.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
          }}
        >
          <label className="ifcdc-onboarding-label" htmlFor={`svc-name-${i}`}>
            Service {i + 1}
          </label>
          <input
            id={`svc-name-${i}`}
            className="ifcdc-onboarding-input"
            value={row.name}
            onChange={(e) => updateRow(i, { name: e.target.value })}
            placeholder="Service name"
          />
          <label className="ifcdc-onboarding-label" htmlFor={`svc-price-${i}`}>
            Price (USD)
          </label>
          <input
            id={`svc-price-${i}`}
            className="ifcdc-onboarding-input"
            inputMode="decimal"
            value={row.price}
            onChange={(e) => updateRow(i, { price: e.target.value })}
            placeholder="35"
          />
          {rows.length > 1 ? (
            <button type="button" className="ifcdc-onboarding-btn ifcdc-onboarding-btn--ghost" style={{ marginTop: 8 }} onClick={() => removeRow(i)}>
              Remove service
            </button>
          ) : null}
        </div>
      ))}
      <button type="button" className="ifcdc-onboarding-btn ifcdc-onboarding-btn--ghost" onClick={addRow}>
        + Add service
      </button>
    </>
  );
}
