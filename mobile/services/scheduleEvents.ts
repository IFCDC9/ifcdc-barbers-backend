type Listener = () => void;

const listeners = new Set<Listener>();

/** Fired after a barber schedule is saved — Booking tab reloads slots. */
export function subscribeScheduleUpdated(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitScheduleUpdated(): void {
  listeners.forEach((fn) => fn());
}
