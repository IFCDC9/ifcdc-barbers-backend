export function getVoiceForLanguage(language) {
  const voices = {
    en: "Polly.Joanna-Neural",
    es: "Polly.Conchita",
    fr: "Polly.Celine",
    ht: "Polly.Joanna-Neural",
    de: "Polly.Marlene",
    ar: "Polly.Zeina",
    hi: "Polly.Aditi",
    pt: "Polly.Camila",
    zh: "Polly.Zhiyu"
  }

  return voices[language] || "Polly.Joanna-Neural"
}

export const selectVoice = (language = "en-US") => {
  const normalizedLanguage = String(language).toLowerCase()
  const shortLanguageCode = normalizedLanguage.slice(0, 2)
  const selectedVoice = getVoiceForLanguage(shortLanguageCode)

  const twilioLanguageByCode = {
    en: "en-US",
    es: "es-ES",
    fr: "fr-FR",
    ht: "ht-HT",
    de: "de-DE",
    ar: "ar-SA",
    hi: "hi-IN",
    pt: "pt-BR",
    zh: "zh-CN"
  }

  if (twilioLanguageByCode[shortLanguageCode]) {
    return {
      voice: selectedVoice,
      language: twilioLanguageByCode[shortLanguageCode]
    }
  }

  if (normalizedLanguage === "es" || normalizedLanguage.startsWith("es-")) {
    return {
      voice: selectedVoice,
      language: "es-ES"
    }
  }

  if (normalizedLanguage === "fr" || normalizedLanguage.startsWith("fr-")) {
    return {
      voice: selectedVoice,
      language: "fr-FR"
    }
  }

  return {
    voice: selectedVoice,
    language: "en-US"
  }
}

export const selectVoiceByCallerType = ({ callerType = "", language = "en-US" } = {}) => {
  const normalizedCallerType = String(callerType)
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ")

  if (normalizedCallerType === "multilingual assistant") {
    return selectVoice(language).voice
  }

  if (normalizedCallerType === "ai receptionist") {
    return "Polly.Joanna-Neural"
  }

  if (normalizedCallerType === "ai booking agent") {
    return "Polly.Joanna-Neural"
  }

  if (normalizedCallerType === "ai queue manager") {
    return "Polly.Matthew-Neural"
  }

  if (normalizedCallerType === "ai customer assistant") {
    return selectVoice(language).voice
  }

  if (normalizedCallerType === "ai multilingual phone operator") {
    return selectVoice(language).voice
  }

  if (normalizedCallerType === "front desk professional") {
    return "Polly.Joanna-Neural"
  }

  if (normalizedCallerType === "barbershop casual") {
    return "Polly.Matthew-Neural"
  }

  if (normalizedCallerType === "after hours booking agent") {
    return "Polly.Matthew-Neural"
  }

  if (normalizedCallerType === "spanish") {
    return "Polly.Conchita"
  }

  if (normalizedCallerType === "vip") {
    return "Polly.Matthew-Neural"
  }

  return selectVoice(language).voice
}
