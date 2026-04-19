const phoneNumber = import.meta.env.VITE_BUSINESS_PHONE || "+13313168167";

export const SYSTEM_CONFIG = {
  BUSINESS_PHONE: String(phoneNumber).trim(),
};
