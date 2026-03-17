export const RECEPTIONIST_NAME = "Melody"

export const getIncomingGreeting = ({ returningCustomerName = "", shopGreeting = "", shopName = "I F C D C Barbers" } = {}) => {
  if (returningCustomerName) {
    return `Welcome back ${returningCustomerName}. This is ${RECEPTIONIST_NAME}.`
  }

  if (shopGreeting) {
    return `${shopGreeting} This is ${RECEPTIONIST_NAME}.`
  }

  return `Welcome to ${shopName}. This is ${RECEPTIONIST_NAME}.`
}

export const getVoiceEntryGreeting = ({ shopGreeting = "", shopName = "I F C D C Barbers" } = {}) => {
  if (shopGreeting) {
    return `${shopGreeting} This is ${RECEPTIONIST_NAME}. Mike does fades and beard trims, and Jay does designs and premium cuts. How can I help you today?`
  }

  return `Welcome to ${shopName}. This is ${RECEPTIONIST_NAME}. Mike does fades and beard trims, and Jay does designs and premium cuts. How can I help you today?`
}

export const getVoiceRetryPrompt = () => "How can I help?"

export const getVoiceRetryFollowup = () => "Sorry, let's try again."

export const getNoSpeechPrompt = () => "I didn't catch that. How can I help?"

export const getRealtimeUnavailablePrompt = () => "The realtime assistant is currently unavailable. Please call again shortly."

export const getRealtimeIntro = ({ shopName = "I F C D C Barbers", returningCustomerName = "" } = {}) => {
  const welcome = returningCustomerName
    ? `Welcome back ${returningCustomerName}. This is ${RECEPTIONIST_NAME}. `
    : `Welcome to ${shopName}. This is ${RECEPTIONIST_NAME}. `

  return `${welcome}Mike does fades and beard trims, and Jay does designs and premium cuts. Connecting you now.`
}

export const getRealtimeClosing = (shopName = "I F C D C Barbers") => {
  return `That wraps up our realtime session. Thanks for calling ${shopName}.`
}

export const getEndCallGoodbye = (shopName = "I F C D C Barbers") => {
  return `You're all set. Thanks for calling ${shopName}. Have a great day.`
}

export const getBookingConfirmLead = () => "Perfect. I'm confirming your booking now."

export const getBookingConfirmHold = () => "Please stay with me for a moment."

export const getPreferredBarberPrompt = () => "If you have a preferred barber, say the name now, like Mike or Jay."

export const getBookingFallbackReply = () => "Let me help with your booking. What day works for you?"

export const getBookingToolFallbackReply = () => "I can still help with booking. Please tell me your barber, date, and preferred time."

export const getQuotaBookingFallbackReply = () => {
  return "Our AI assistant is temporarily unavailable. I can still help with a booking. Please tell me your barber, date, and preferred time."
}

export const getTimeoutReply = () => "I'm taking a bit too long to respond right now. Please repeat your request briefly."

export const getGenericFailureReply = () => "Sorry, I had trouble processing that. Please try again."

export const getBookingPlaceholderReply = (speech = "") => {
  return `Thank you. I heard: ${speech}. I'm connecting this with our booking tools now so I can confirm everything for you.`
}

export const getReceptionistUnknownGreeting = (shopName = "I F C D C Barbers") => {
  return `Hi, welcome to ${shopName}. This is ${RECEPTIONIST_NAME}. I can help with appointments, wait times, and shop info. What do you need today?`
}

export const getReceptionistPricingReply = () => {
  return "A haircut is $30, and a beard service is $15. Would you like to book with Mike or Jay?"
}

export const getReceptionistLocationReply = (shopName = "I F C D C Barbers") => {
  return `You're calling ${shopName}. If you want, I can also help you book an appointment right now.`
}

export const getReceptionistHoursReply = () => {
  return "We're open Mon–Sat 9am–7pm. Would you like to book an appointment?"
}

export const getShopHoursReply = () => {
  return "We're open Mon–Sat 9am–7pm."
}

export const getShopInformationReply = () => {
  return `Welcome to IFCDC Barbers. This is ${RECEPTIONIST_NAME}. We're open Mon–Sat 9am–7pm, and I can also help you book your next appointment whenever you're ready.`
}

export const getQueueEmptyReply = () => {
  return "Great news, the queue is currently clear."
}

export const getQueueCountReply = (total = 0) => {
  return `There ${total === 1 ? "is" : "are"} currently ${total} customer${total === 1 ? "" : "s"} in the queue.`
}

export const getQueueAddedReply = (position = 1) => {
  return `You're in. I've added you to the queue at position ${position}.`
}

export const getQueueUnsupportedActionReply = () => {
  return "I can help with queue status or adding you to the queue."
}

export const getSMSMissingInputReply = () => {
  return "Please share the phone number and message you'd like me to send."
}

export const getSMSNotConfiguredReply = () => {
  return "SMS isn't configured yet. Once Twilio credentials are connected, I can send confirmations for you."
}

export const getSMSSentReply = () => {
  return "Done. Your text message has been sent."
}

export const getSMSConfirmationMissingPhoneReply = () => {
  return "Please share the phone number so I can send the confirmation text."
}

export const getReceptionistBarberReply = () => {
  return "We have Mike for fades and beard trims, and Jay for designs and premium cuts. Who would you like to book with?"
}

export const getReceptionistQueueReply = () => {
  return "Sure, I can check the queue for you. Do you want the current wait time now?"
}

export const getReceptionistCatchAllReply = () => {
  return "I understand. I can help with booking, availability, wait time, and shop hours. What would you like to do?"
}

export const getReceptionistGreetingByLanguage = (language = "en-US", shopName = "I F C D C Barbers") => {
  if (language === "es-ES") {
    return `Hola, gracias por llamar a ${shopName}. Soy ${RECEPTIONIST_NAME}. ¿En qué puedo ayudarte?`
  }

  if (language === "fr-FR") {
    return `Bonjour, merci d'avoir appelé ${shopName}. Je suis ${RECEPTIONIST_NAME}. Comment puis-je vous aider aujourd'hui ?`
  }

  if (language === "ht-HT") {
    return `Bonjou, mèsi paske ou rele ${shopName}. Mwen se ${RECEPTIONIST_NAME}. Kijan mwen ka ede ou jodi a?`
  }

  if (language === "ar-SA") {
    return `مرحبًا، شكرًا لاتصالك بـ ${shopName}. أنا ${RECEPTIONIST_NAME}. كيف يمكنني مساعدتك اليوم؟`
  }

  return `Hi, thanks for calling ${shopName}. This is ${RECEPTIONIST_NAME}. How can I help you today?`
}
