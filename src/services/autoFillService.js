import db from "../db/db.js";
import { sendSMS } from "./notificationService.js";

export async function triggerAutoFill(appointment) {

  const barber = appointment.barber;
  const time = appointment.time;
  const date = appointment.date;

  const candidate = await db.query(
    `SELECT *
     FROM customers
     WHERE preferred_barber = $1
     ORDER BY last_visit DESC
     LIMIT 1`,
    [barber]
  );

  if (!candidate.rows.length) return;

  const customer = candidate.rows[0];

  const message =
    `${barber} has an opening at ${time} today.\nReply YES to book.`;

  await sendSMS(customer.phone, message);

}
