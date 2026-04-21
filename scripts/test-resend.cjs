/**
 * Loads env the same way as root server.js, then sends one test email via Resend.
 * Requires RESEND_TEST_TO or BOOKING_ADMIN_EMAIL as recipient.
 */
const path = require("path");
const dotenv = require("dotenv");

const rootDir = path.join(__dirname, "..");
dotenv.config({ path: path.join(rootDir, "backend", ".env") });

const { sendEmail } = require(path.join(rootDir, "emailResend.cjs"));

async function main() {
  console.log("ENV CHECK:");
  console.log("RESEND_API_KEY:", process.env.RESEND_API_KEY ? "LOADED" : "MISSING");
  console.log("MAIL_FROM:", process.env.MAIL_FROM);

  // Use a recipient allowed for your verified MAIL_FROM domain (see resend.com/domains).
  const to = String(
    process.env.RESEND_TEST_TO || process.env.EMAIL_USER || process.env.BOOKING_ADMIN_EMAIL || ""
  ).trim();
  if (!to) {
    console.error(
      "Missing recipient: set RESEND_TEST_TO, EMAIL_USER, or BOOKING_ADMIN_EMAIL in backend/.env"
    );
    process.exit(1);
  }

  const result = await sendEmail({
    to,
    subject: "IFCDC Barbers — Resend test",
    html: "<p>Resend test from <code>npm run test:resend</code>.</p>",
    text: "Resend test from npm run test:resend.",
    label: "test-resend-script",
  });

  if (result.error) {
    console.error("SEND FAILED:", result.error);
    process.exit(1);
  }
  console.log("EMAIL SENT OK:", result.data);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
