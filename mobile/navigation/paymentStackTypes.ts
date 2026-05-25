/** Shared payment drill-down routes — names must match Stack.Screen `name` exactly. */
export type PaymentStackParamList = {
  PaymentMethods: undefined;
  PaymentProviderDetailScreen: undefined;
  PayPalDetailScreen: undefined;
  ApplePayDetailScreen: undefined;
  ZelleDetailScreen: undefined;
  CashAppDetailScreen: undefined;
};

export const PAYMENT_DETAIL_ROUTE = {
  paypal: "PayPalDetailScreen",
  apple_pay: "ApplePayDetailScreen",
  zelle: "ZelleDetailScreen",
  cash_app: "CashAppDetailScreen",
} as const satisfies Record<string, keyof PaymentStackParamList>;
