/** User-facing copy — production tone only, no dev diagnostics. */
export const UX = {
  loading: "Loading…",
  emptyRecords: "No records found.",
  emptyBookings: "No bookings found.",
  emptyAppointments: "No appointments yet. Book your first visit from the Home tab.",
  emptyFiltered: "No records match your filters.",
  errorGeneric: "Action could not be completed right now.",
  errorRetry: "Please try again.",
  errorConnection: "Service temporarily unavailable.",
  errorPermission: "You don't have permission to perform this action.",
  sectionReady: "This section is ready for configuration.",
  paymentInfrastructure: "Payment infrastructure",
  platformUsers: "Platform users",
  platformBusinesses: "Platform businesses",
  adminTools: "Admin tools",
  shareUnavailable: "Sharing is not supported on this device.",
  notificationSent: "Check your notification tray for the alert.",
  offlineShopNote: "Changes are saved on this device and will sync with your shop profile.",
  scheduleNotSet: "Schedule not set — tap Edit Schedule to add availability.",
  scheduleLoadIssue: "Your saved schedule could not be loaded. Review the details below and tap Save to update.",
  smsInviteDisabled: "SMS invitations are not enabled yet.",
  googleSignInUnavailable: "Google sign-in is not available at this time.",
} as const;

/** Common alert body: action failed + retry hint. */
export function actionFailedMessage(hint?: string): string {
  return hint ? `${UX.errorGeneric} ${hint}` : `${UX.errorGeneric} ${UX.errorRetry}`;
}
