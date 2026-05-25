import React from "react";
import PaymentMethodsScreen from "../screens/profile/PaymentMethodsScreen";
import PaymentProviderDetailScreen from "../screens/profile/payments/PaymentProviderDetailScreen";
import PayPalDetailScreen from "../screens/profile/payments/PayPalDetailScreen";
import ApplePayDetailScreen from "../screens/profile/payments/ApplePayDetailScreen";
import ZelleDetailScreen from "../screens/profile/payments/ZelleDetailScreen";
import CashAppDetailScreen from "../screens/profile/payments/CashAppDetailScreen";
import type { PaymentStackParamList } from "./paymentStackTypes";

export const PAYMENT_STACK_SCREENS: {
  name: keyof PaymentStackParamList;
  component: React.ComponentType;
}[] = [
  { name: "PaymentMethods", component: PaymentMethodsScreen },
  { name: "PaymentProviderDetailScreen", component: PaymentProviderDetailScreen },
  { name: "PayPalDetailScreen", component: PayPalDetailScreen },
  { name: "ApplePayDetailScreen", component: ApplePayDetailScreen },
  { name: "ZelleDetailScreen", component: ZelleDetailScreen },
  { name: "CashAppDetailScreen", component: CashAppDetailScreen },
];
