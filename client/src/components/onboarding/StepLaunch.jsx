export default function StepLaunch({ busy }) {
  return (
    <>
      <p className="ifcdc-onboarding-hint">
        We will publish your first bookable style from your top service so clients can pick it on the booking flow. You can add more styles anytime from your dashboard.
      </p>
      <p className="ifcdc-onboarding-hint">When you tap <strong>Go live</strong>, your shop is ready for IFCDC bookings.</p>
      {busy ? <p className="ifcdc-onboarding-hint">Publishing…</p> : null}
    </>
  );
}
