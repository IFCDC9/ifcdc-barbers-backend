import Sentiment from "sentiment";

const sentiment = new Sentiment();

export function detectEmotion(text) {

  const result = sentiment.analyze(text);

  if (result.score < -2) {
    return "frustrated";
  }

  if (result.score > 2) {
    return "happy";
  }

  return "neutral";
}
