const FALLBACK_ANSWER =
  "Sorry, I couldn't find an exact answer to your question. You may try rephrasing your inquiry or contact Boss Gudo A.R.C. Aqua Farm directly for further assistance.";
const MINIMUM_MATCH_SCORE = 25;

const GENERIC_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "can",
  "cost",
  "do",
  "for",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "much",
  "of",
  "on",
  "or",
  "price",
  "the",
  "to",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
  "you",
  "your",
]);

export function normalizeChatMessage(value) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getMeaningfulWords(value) {
  return normalizeChatMessage(value)
    .split(" ")
    .filter((word) => word && !GENERIC_WORDS.has(word));
}

function compareStrings(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function getFaqId(faq) {
  return String(faq._id ?? faq.id ?? "");
}

function containsWholePhrase(message, phrase) {
  const phraseIndex = message.indexOf(phrase);
  return (
    phraseIndex !== -1 &&
    (phraseIndex === 0 || message[phraseIndex - 1] === " ") &&
    (phraseIndex + phrase.length === message.length ||
      message[phraseIndex + phrase.length] === " ")
  );
}

function getKeywordScore(messageWords, messagePhrase, keywords) {
  let highestScore = 0;
  const matchedWords = new Set();
  const partialWords = new Set();

  for (const keyword of keywords) {
    if (typeof keyword !== "string") continue;
    const keywordWords = getMeaningfulWords(keyword);
    if (keywordWords.length === 0) continue;

    const keywordPhrase = keywordWords.join(" ");
    const isPhraseMatch =
      keywordWords.length > 1 &&
      containsWholePhrase(messagePhrase, keywordPhrase);

    if (isPhraseMatch) {
      highestScore = Math.max(highestScore, 60);
    }

    for (const keywordWord of keywordWords) {
      const exactWordMatch = messageWords.includes(keywordWord);
      const pluralWordMatch =
        keywordWord.length >= 4 &&
        messageWords.some(
          (word) =>
            word.length > keywordWord.length &&
            word.length <= keywordWord.length + 2 &&
            word.startsWith(keywordWord) &&
            /s$/.test(word),
        );
      if (exactWordMatch || pluralWordMatch) {
        matchedWords.add(keywordWord);
      } else if (
        keywordWord.length >= 5 &&
        messageWords.some(
          (word) =>
            word.length >= 5 &&
            (word.includes(keywordWord) || keywordWord.includes(word)),
        )
      ) {
        highestScore = Math.max(highestScore, 10);
        partialWords.add(keywordWord);
      }
    }
  }

  const exactWordScore =
    matchedWords.size > 1 ? 40 : matchedWords.size === 1 ? 25 : 0;
  const partialWordScore = partialWords.size * 10;
  if (matchedWords.size > 1) {
    highestScore = Math.max(highestScore, exactWordScore + partialWordScore);
  } else {
    highestScore = Math.max(
      highestScore,
      exactWordScore + partialWordScore,
      partialWordScore,
    );
  }

  return highestScore;
}

function scoreFaqMatch(message, faq) {
  if (faq.active === false || typeof faq.question !== "string") {
    return 0;
  }

  const normalizedMessage = normalizeChatMessage(message);
  const normalizedQuestion = normalizeChatMessage(faq.question);
  const messageWords = getMeaningfulWords(message);
  if (messageWords.length === 0) {
    return 0;
  }
  if (normalizedMessage === normalizedQuestion) {
    return 100;
  }

  const messagePhrase = messageWords.join(" ");
  const questionWords = getMeaningfulWords(faq.question);
  const questionPhrase = normalizeChatMessage(faq.question);
  let score = getKeywordScore(messageWords, messagePhrase, faq.keywords);

  if (
    questionWords.length > 0 &&
    containsWholePhrase(normalizedMessage, questionPhrase)
  ) {
    score = Math.max(score, 80);
  }

  return score;
}

export function findBestFaqMatch(message, faqs) {
  if (typeof message !== "string" || !Array.isArray(faqs)) {
    return null;
  }

  return faqs
    .map((faq) => ({ faq, score: scoreFaqMatch(message, faq) }))
    .filter(({ score }) => score >= MINIMUM_MATCH_SCORE)
    .sort((left, right) => {
      const scoreOrder = right.score - left.score;
      if (scoreOrder !== 0) return scoreOrder;
      const questionOrder = compareStrings(
        normalizeChatMessage(left.faq.question),
        normalizeChatMessage(right.faq.question),
      );
      if (questionOrder !== 0) return questionOrder;
      return compareStrings(getFaqId(left.faq), getFaqId(right.faq));
    })
    .map(({ faq }) => faq)[0] ?? null;
}

export function getChatbotResponse(message, faqs) {
  const matchedFaq = findBestFaqMatch(message, faqs);
  if (!matchedFaq || typeof matchedFaq.answer !== "string") {
    return { matched: false, answer: FALLBACK_ANSWER };
  }
  return {
    matched: true,
    answer: matchedFaq.answer,
    faqId: getFaqId(matchedFaq),
  };
}

export { FALLBACK_ANSWER, MINIMUM_MATCH_SCORE };
