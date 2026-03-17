const SPANISH_HINTS = [
  "hola",
  "buenos",
  "buenas",
  "cita",
  "barbero",
  "horario",
  "disponibilidad",
  "cola",
  "gracias"
]

const FRENCH_HINTS = [
  "bonjour",
  "bonsoir",
  "merci",
  "rendez-vous",
  "barbier",
  "disponibilite",
  "disponibilité",
  "salut"
]

const CREOLE_HINTS = [
  "bonjou",
  "bonswa",
  "mèsi",
  "mesi",
  "kijan",
  "randevou",
  "koupe",
  "cheve",
  "barbye",
  "tanpri"
]

const ARABIC_HINTS = [
  "مرحبا",
  "اهلا",
  "أهلا",
  "حجز",
  "موعد",
  "حلاق",
  "شكرا",
  "شكراً"
]

export const detectLanguage = async (speech = "") => {
  const text = String(speech).toLowerCase().trim()

  if (!text) return "en-US"

  const hasSpanishCharacters = /[áéíóúñ¿¡]/.test(text)
  const hasSpanishHintWord = SPANISH_HINTS.some(word => text.includes(word))
  const hasFrenchCharacters = /[àâçéèêëîïôùûüÿœæ]/.test(text)
  const hasFrenchHintWord = FRENCH_HINTS.some(word => text.includes(word))
  const hasCreoleHintWord = CREOLE_HINTS.some(word => text.includes(word))
  const hasArabicCharacters = /[\u0600-\u06FF]/.test(text)
  const hasArabicHintWord = ARABIC_HINTS.some(word => text.includes(word))

  if (hasSpanishCharacters || hasSpanishHintWord) {
    return "es-ES"
  }

  if (hasFrenchCharacters || hasFrenchHintWord) {
    return "fr-FR"
  }

  if (hasCreoleHintWord) {
    return "ht-HT"
  }

  if (hasArabicCharacters || hasArabicHintWord) {
    return "ar-SA"
  }

  return "en-US"
}
