const sessions = new Map();

export function getSession(callSid) {
  if (!sessions.has(callSid)) {
    sessions.set(callSid, {
      step: "start",
      data: {}
    });
  }
  return sessions.get(callSid);
}

export function updateSession(callSid, updates) {
  const session = getSession(callSid);
  Object.assign(session.data, updates);
}

export function setStep(callSid, step) {
  const session = getSession(callSid);
  session.step = step;
}

export function clearSession(callSid) {
  sessions.delete(callSid);
}
