/**
 * AURA voice booking — explicit state machine (no backward transitions on valid input).
 */

export const VoiceState = {
  GREETING: "GREETING",
  SERVICE_SELECTION: "SERVICE_SELECTION",
  TIME_SELECTION: "TIME_SELECTION",
  PHONE_CAPTURE: "PHONE_CAPTURE",
  CONFIRMATION: "CONFIRMATION",
  COMPLETED: "COMPLETED",
};

/** @returns {Record<string, unknown>} */
export function createVoiceBookingMachineState() {
  return {
    machineState: VoiceState.GREETING,
    /** First TwiML turn plays greeting; then we only run SERVICE_SELECTION+. */
    greetingPlayed: false,
    /** `pick_time` | `pick_name` while in TIME_SELECTION */
    timePhase: "pick_time",
    /** `entry` | `confirm` while in PHONE_CAPTURE */
    phonePhase: "entry",
    /** Pending 10-digit US mobile (digits only) before user confirms readback */
    pendingPhone10: "",
    /** Confirmed 10-digit US mobile */
    phoneDigits10: "",
    keypadActive: false,
    nlKeypadRetries: 0,
    idleConfuse: 0,
    voiceHistory: [],
    lastIntent: "",
    lastUserLine: "",
    service: "",
    name: "",
    timeStr: "",
    timeDisplay: "",
    dateStr: "",
    chooseTimeFails: 0,
    timeKeypad: false,
    closeoutFinalized: false,
    /** Max invalid attempts per gate (exceeded → graceful hangup) */
    retry: {
      service: 0,
      time: 0,
      name: 0,
      phone: 0,
      phoneConfirm: 0,
      final: 0,
      idle: 0,
    },
  };
}

/** Strip to 10 US mobile digits; empty string if invalid. */
export function extract10DigitUsPhone(raw) {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length === 10) return d;
  if (d.length === 11 && d.startsWith("1")) return d.slice(1);
  if (d.length > 10) return d.slice(-10);
  return "";
}

/** Format as 732-743-5048 for readback (10 digits only). */
export function formatUsPhoneDash10(digits10) {
  const x = String(digits10 || "").replace(/\D/g, "");
  if (x.length !== 10) return String(digits10 || "").trim() || "that number";
  return `${x.slice(0, 3)}-${x.slice(3, 6)}-${x.slice(6)}`;
}
