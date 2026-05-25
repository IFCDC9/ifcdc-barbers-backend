export type ConnectionAlertPayload = {
  kind: "network" | "http";
  url: string;
  status?: number;
  message?: string;
};

type Listener = (p: ConnectionAlertPayload) => void;
type ClearListener = () => void;

const failureListeners = new Set<Listener>();
const clearListeners = new Set<ClearListener>();

export function subscribeConnectionAlerts(onFail: Listener, onClear: ClearListener) {
  failureListeners.add(onFail);
  clearListeners.add(onClear);
  return () => {
    failureListeners.delete(onFail);
    clearListeners.delete(onClear);
  };
}

export function reportConnectionFailure(p: ConnectionAlertPayload) {
  console.log("[connection] failure", p.kind, p.url, p.status ?? "", p.message ?? "");
  failureListeners.forEach((fn) => {
    try {
      fn(p);
    } catch (e) {
      console.log("[connection] listener error", e);
    }
  });
}

export function reportConnectionRecovered() {
  console.log("[connection] recovered (successful backend call)");
  clearListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.log("[connection] clear listener error", e);
    }
  });
}
