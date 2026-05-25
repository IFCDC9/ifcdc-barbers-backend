export default function StepLocation({ draft, setDraft }) {
  return (
    <>
      <p className="ifcdc-onboarding-hint">Clients see this on your profile and booking confirmation. Coordinates are optional.</p>
      <label className="ifcdc-onboarding-label" htmlFor="ob-address">
        Address
      </label>
      <textarea
        id="ob-address"
        className="ifcdc-onboarding-textarea"
        rows={3}
        value={draft.address}
        onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
        placeholder="Street, city, state"
      />
      <label className="ifcdc-onboarding-label" htmlFor="ob-lat">
        Latitude (optional)
      </label>
      <input
        id="ob-lat"
        className="ifcdc-onboarding-input"
        inputMode="decimal"
        value={draft.latitude}
        onChange={(e) => setDraft((d) => ({ ...d, latitude: e.target.value }))}
        placeholder="e.g. 40.7128"
      />
      <label className="ifcdc-onboarding-label" htmlFor="ob-lng">
        Longitude (optional)
      </label>
      <input
        id="ob-lng"
        className="ifcdc-onboarding-input"
        inputMode="decimal"
        value={draft.longitude}
        onChange={(e) => setDraft((d) => ({ ...d, longitude: e.target.value }))}
        placeholder="e.g. -74.0060"
      />
    </>
  );
}
