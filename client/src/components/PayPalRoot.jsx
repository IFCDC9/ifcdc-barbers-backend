import React from "react";

/** Used by PayButton to know the app is wrapped with PayPalScriptProvider. */
export const PayPalReadyContext = React.createContext({ ready: false });
