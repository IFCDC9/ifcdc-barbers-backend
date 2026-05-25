export type PaymentProviderId = "paypal" | "apple_pay" | "zelle" | "cash_app";

/** UI status for the payment hub list — not live checkout state. */
export type PaymentStatusLabel = "active" | "setup_required" | "pending_configuration";

export type PaymentProviderConfig = {
  payment_provider: PaymentProviderId;
  payment_status: PaymentStatusLabel;
  supports_deposit: boolean;
  supports_platform_fee: boolean;
  supports_mobile_wallet: boolean;
  id: PaymentProviderId;
  name: string;
  icon: string;
  headline: string;
  description: string;
};

export const PAYMENT_STATUS_COPY: Record<
  PaymentStatusLabel,
  { label: string; tone: "active" | "setup" | "pending" }
> = {
  active: { label: "Active", tone: "active" },
  setup_required: { label: "Setup", tone: "setup" },
  pending_configuration: { label: "In setup", tone: "pending" },
};

export const PAYMENT_PROVIDERS: PaymentProviderConfig[] = [
  {
    payment_provider: "paypal",
    payment_status: "active",
    supports_deposit: true,
    supports_platform_fee: true,
    supports_mobile_wallet: false,
    id: "paypal",
    name: "PayPal",
    icon: "💳",
    headline: "Primary checkout",
    description: "Booking deposits, full payments, and platform fee collection.",
  },
  {
    payment_provider: "apple_pay",
    payment_status: "setup_required",
    supports_deposit: true,
    supports_platform_fee: true,
    supports_mobile_wallet: true,
    id: "apple_pay",
    name: "Apple Pay",
    icon: "🍎",
    headline: "Mobile wallet checkout",
    description: "Native iOS wallet payments with merchant validation.",
  },
  {
    payment_provider: "zelle",
    payment_status: "pending_configuration",
    supports_deposit: false,
    supports_platform_fee: false,
    supports_mobile_wallet: false,
    id: "zelle",
    name: "Zelle",
    icon: "🏦",
    headline: "Bank transfer",
    description: "Bank-to-bank payments with staff confirmation.",
  },
  {
    payment_provider: "cash_app",
    payment_status: "pending_configuration",
    supports_deposit: false,
    supports_platform_fee: false,
    supports_mobile_wallet: false,
    id: "cash_app",
    name: "Cash App",
    icon: "💵",
    headline: "Cash App payments",
    description: "Tag-based payments with staff review.",
  },
];

export function getPaymentProvider(id: PaymentProviderId): PaymentProviderConfig {
  return PAYMENT_PROVIDERS.find((p) => p.id === id) ?? PAYMENT_PROVIDERS[0];
}
