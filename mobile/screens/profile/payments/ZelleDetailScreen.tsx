import React from "react";
import {
  PaymentBanner,
  PaymentDetailRow,
  PaymentDetailSection,
} from "../../../components/payments/PaymentDetailParts";
import { UX } from "../../../utils/uxCopy";
import { getPaymentProvider } from "../../../services/paymentPlatformModel";
import PaymentDetailLayout from "./PaymentDetailLayout";

export default function ZelleDetailScreen() {
  const provider = getPaymentProvider("zelle");

  return (
    <PaymentDetailLayout provider={provider}>
      <PaymentBanner
        tone="muted"
        title={UX.sectionReady}
        body="Zelle checkout will be available in a future update."
      />

      <PaymentDetailSection title="Provider status">
        <PaymentDetailRow label="Status" value="In setup" highlight />
        <PaymentDetailRow label="Automation" value="In setup" />
        <PaymentDetailRow label="Settlement" value="Staff review" />
      </PaymentDetailSection>

      <PaymentDetailSection title="Features">
        <PaymentDetailRow label="Bank transfer" value="Active" />
        <PaymentDetailRow label="Auto booking match" value="In setup" />
        <PaymentDetailRow label="Deposit mode" value="Not offered" />
        <PaymentDetailRow label="Platform fee" value="Not offered" />
      </PaymentDetailSection>

      <PaymentDetailSection title="Business profile">
        <PaymentDetailRow label="Business email" value="payments@ifcdc.org" />
        <PaymentDetailRow label="Business phone" value="—" />
        <PaymentDetailRow label="Confirmation workflow" value="Staff review" />
      </PaymentDetailSection>

      <PaymentBanner
        title="What's next"
        body="Receipt matching and automatic payment updates will activate when setup is complete."
      />
    </PaymentDetailLayout>
  );
}
