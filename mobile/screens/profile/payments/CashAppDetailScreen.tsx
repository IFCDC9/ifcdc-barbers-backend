import React from "react";
import {
  PaymentBanner,
  PaymentDetailRow,
  PaymentDetailSection,
  PaymentConfigBlock,
} from "../../../components/payments/PaymentDetailParts";
import { UX } from "../../../utils/uxCopy";
import { getPaymentProvider } from "../../../services/paymentPlatformModel";
import PaymentDetailLayout from "./PaymentDetailLayout";

export default function CashAppDetailScreen() {
  const provider = getPaymentProvider("cash_app");

  return (
    <PaymentDetailLayout provider={provider}>
      <PaymentBanner
        tone="muted"
        title={UX.sectionReady}
        body="Cash App checkout will be available in a future update."
      />

      <PaymentDetailSection title="Provider status">
        <PaymentDetailRow label="Status" value="In setup" highlight />
        <PaymentDetailRow label="Review queue" value="Active" />
        <PaymentDetailRow label="QR display" value="In setup" />
      </PaymentDetailSection>

      <PaymentDetailSection title="Features">
        <PaymentDetailRow label="Tag-based payments" value="Active" />
        <PaymentDetailRow label="QR checkout" value="In setup" />
        <PaymentDetailRow label="Auto reconciliation" value="In setup" />
        <PaymentDetailRow label="Staff review tools" value="Active" />
      </PaymentDetailSection>

      <PaymentDetailSection title="Cash App profile">
        <PaymentDetailRow label="Cash App tag" value="$IFCDCBarbers" />
        <PaymentDetailRow label="Manual payment review" value="Active" />
      </PaymentDetailSection>

      <PaymentConfigBlock label="QR code display" />

      <PaymentBanner
        title="What's next"
        body="Automated tag verification and booking reconciliation will activate when setup is complete."
      />
    </PaymentDetailLayout>
  );
}
