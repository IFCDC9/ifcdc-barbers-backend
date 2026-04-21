const completedCalls = new Set();

export function isCallCompleted(callSid) {
  return completedCalls.has(callSid);
}

export function markCallCompleted(callSid) {
  completedCalls.add(callSid);
}

