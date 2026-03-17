-- Seed example shop record for IFCDC Barbers Newark
-- Update the phone_number to match your Twilio number before running.

INSERT INTO shops (name, phone_number, twilio_account_sid, twilio_auth_token, hours, services, default_language, greeting, created_at)
VALUES (
  'IFCDC Barbers Newark',
  '+12065551234', -- change to your Twilio 'To' number
  NULL,
  NULL,
  '{"mon":"09:00-19:00","tue":"09:00-19:00","wed":"09:00-19:00","thu":"09:00-19:00","fri":"09:00-19:00","sat":"09:00-17:00","sun":null}',
  '["haircut","fade","trim","beard","shave"]',
  'en',
  'Thanks for calling IFCDC Barbers Newark.',
  NOW()
)
ON CONFLICT (phone_number) DO NOTHING;
