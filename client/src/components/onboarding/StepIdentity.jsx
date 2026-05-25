export default function StepIdentity({ draft, setDraft }) {
  return (
    <>
      <p className="ifcdc-onboarding-hint">Create your owner account. You will appear as a barber on IFCDC with booking checkout.</p>
      <label className="ifcdc-onboarding-label" htmlFor="ob-name">
        Your name
      </label>
      <input
        id="ob-name"
        className="ifcdc-onboarding-input"
        autoComplete="name"
        value={draft.name}
        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        placeholder="Full name"
      />
      <label className="ifcdc-onboarding-label" htmlFor="ob-email">
        Email
      </label>
      <input
        id="ob-email"
        type="email"
        className="ifcdc-onboarding-input"
        autoComplete="email"
        value={draft.email}
        onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
        placeholder="you@shop.com"
      />
      <label className="ifcdc-onboarding-label" htmlFor="ob-password">
        Password
      </label>
      <input
        id="ob-password"
        type="password"
        className="ifcdc-onboarding-input"
        autoComplete="new-password"
        value={draft.password}
        onChange={(e) => setDraft((d) => ({ ...d, password: e.target.value }))}
        placeholder="12+ chars, upper, lower, number, symbol"
      />
      <label className="ifcdc-onboarding-label" htmlFor="ob-display">
        Barber display name
      </label>
      <input
        id="ob-display"
        className="ifcdc-onboarding-input"
        value={draft.displayName}
        onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))}
        placeholder="Shown to clients"
      />
      <label className="ifcdc-onboarding-label" htmlFor="ob-shop">
        Shop name (optional)
      </label>
      <input
        id="ob-shop"
        className="ifcdc-onboarding-input"
        value={draft.shopName}
        onChange={(e) => setDraft((d) => ({ ...d, shopName: e.target.value }))}
        placeholder="Studio / brand"
      />
      <label className="ifcdc-onboarding-label" htmlFor="ob-phone">
        Phone (optional)
      </label>
      <input
        id="ob-phone"
        type="tel"
        className="ifcdc-onboarding-input"
        autoComplete="tel"
        value={draft.phone}
        onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
        placeholder="Shop phone"
      />
      <label className="ifcdc-onboarding-label" htmlFor="ob-bio">
        Short bio (optional)
      </label>
      <textarea
        id="ob-bio"
        className="ifcdc-onboarding-textarea"
        value={draft.bio}
        onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
        placeholder="What makes your chair special?"
      />
    </>
  );
}
