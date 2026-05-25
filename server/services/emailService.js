import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({ to, subject, html }) {
  try {
    const response = await resend.emails.send({
      from: process.env.MAIL_FROM,
      to,
      subject,
      html,
      reply_to: process.env.MAIL_REPLY_TO || process.env.MAIL_FROM,
    });

    console.log("✅ Email sent:", response);
    return response;
  } catch (error) {
    console.error("❌ Email error:", error);
    throw error;
  }
}

