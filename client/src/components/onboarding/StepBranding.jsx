export default function StepBranding({ draft, setDraft }) {
  return (
    <>
      <p className="ifcdc-onboarding-hint">Upload logo and a profile photo (JPEG, PNG, WebP, or GIF — max 5MB each).</p>
      <label className="ifcdc-onboarding-label" htmlFor="ob-logo">
        Logo
      </label>
      <input
        id="ob-logo"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        className="ifcdc-onboarding-input"
        style={{ padding: "0.5rem" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          setDraft((d) => ({ ...d, logoFile: f || null }));
        }}
      />
      <label className="ifcdc-onboarding-label" htmlFor="ob-profile">
        Profile image
      </label>
      <input
        id="ob-profile"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        className="ifcdc-onboarding-input"
        style={{ padding: "0.5rem" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          setDraft((d) => ({ ...d, profileFile: f || null }));
        }}
      />
      {draft.logoFile ? <p className="ifcdc-onboarding-hint">Logo: {draft.logoFile.name}</p> : null}
      {draft.profileFile ? <p className="ifcdc-onboarding-hint">Profile: {draft.profileFile.name}</p> : null}
    </>
  );
}
