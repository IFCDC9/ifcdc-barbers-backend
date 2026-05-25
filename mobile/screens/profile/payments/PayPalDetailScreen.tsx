import React, { useEffect, useState } from "react";
import { Alert } from "react-native";
import GlowButton from "../../../components/GlowButton";
import {
  PaymentDetailRow,
  PaymentDetailSection,
  PaymentConfigBlock,
} from "../../../components/payments/PaymentDetailParts";
import { UX } from "../../../utils/uxCopy";
import { getPaymentProvider } from "../../../services/paymentPlatformModel";
import {
  loadPayPalLastTestAt,
  recordPayPalTestTransaction,
} from "../../../services/paymentPlatformPrefs";
import PaymentDetailLayout from "./PaymentDetailLayout";

function formatWhen(iso: string | null) {
  if (!iso) return "Not yet verified";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not yet verified";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function PayPalDetailScreen() {
  const provider = getPaymentProvider("paypal");
  const [lastVerified, setLastVerified] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    void loadPayPalLastTestAt().then(setLastVerified);
  }, []);

  const onVerify = async () => {
    setVerifying(true);
    try {
      await recordPayPalTestTransaction();
      setLastVerified(await loadPayPalLastTestAt());
      Alert.alert("PayPal", "Connection verified. Live checkout is unchanged.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <PaymentDetailLayout provider={provider}>
      <PaymentDetailSection title="Provider status">
        <PaymentDetailRow label="Status" value="Active" highlight />
        <PaymentDetailRow label="Connected merchant email" value="service@ifcdc.org" />
        <PaymentDetailRow label="Last successful transaction" value="—" />
      </PaymentDetailSection>

      <PaymentDetailSection title="Features">
        <PaymentDetailRow label="Booking checkout" value="Active" highlight />
        <PaymentDetailRow label="Deposit capture" value="Active" highlight />
        <PaymentDetailRow label="Receipt delivery" value="Active" />
        <PaymentDetailRow label="Refund workflow" value="Staff review" />
      </PaymentDetailSection>

      <PaymentDetailSection title="Connection status">
        <PaymentDetailRow label="Booking payments" value="Connected" highlight />
        <PaymentDetailRow label="Platform fee" value="$0.99 active" highlight />
        <PaymentDetailRow label="Deposit mode" value="Active" highlight />
        <PaymentDetailRow label="Last verification" value={formatWhen(lastVerified)} />
      </PaymentDetailSection>

      <PaymentConfigBlock label="Transaction history" />

      <GlowButton
        label={verifying ? "Verifying…" : "Verify PayPal connection"}
        onPress={onVerify}
        disabled={verifying}
        loading={verifying}
      />
    </PaymentDetailLayout>
  );
}
