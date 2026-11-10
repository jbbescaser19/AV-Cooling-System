/** Conservative, explainable English/Filipino sentiment heuristics.
 * Not an LLM or a guarantee of customer's intent. Always retain original text.
 */
const positive = new Set([
  "good",
  "great",
  "excellent",
  "amazing",
  "perfect",
  "fast",
  "helpful",
  "kind",
  "friendly",
  "professional",
  "reliable",
  "satisfied",
  "recommend",
  "love",
  "happy",
  "thank",
  "thanks",
  "salamat",
  "maayos",
  "mabilis",
  "maganda",
  "magaling",
  "mabait",
  "ayos",
  "sulit",
  "ganda",
  "husay",
]);
const negative = new Set([
  "bad",
  "poor",
  "terrible",
  "awful",
  "broken",
  "late",
  "slow",
  "rude",
  "expensive",
  "disappointed",
  "issue",
  "problem",
  "defective",
  "unhappy",
  "worst",
  "delay",
  "faulty",
  "refund",
  "pangit",
  "mabagal",
  "mahal",
  "sira",
  "palpak",
  "reklamo",
  "sayang",
]);
const negations = new Set([
  "not",
  "never",
  "no",
  "hindi",
  "di",
  "walang",
  "wala",
]);
export function analyzeFeedbackSentiment(comment, rating) {
  const tokens =
    String(comment || "")
      .toLowerCase()
      .match(/[a-zA-ZÀ-ÿ]+/g) || [];
  let score = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    let point = positive.has(token) ? 1 : negative.has(token) ? -1 : 0;
    if (
      point &&
      tokens
        .slice(Math.max(0, index - 2), index)
        .some((word) => negations.has(word))
    )
      point *= -1;
    score += point;
  }
  // The customer's explicit rating matters but text may overturn it.
  score += { 1: -2, 2: -1, 3: 0, 4: 1, 5: 2 }[Number(rating)] ?? 0;
  return score >= 2 ? "POSITIVE" : score <= -2 ? "NEGATIVE" : "NEUTRAL";
}
