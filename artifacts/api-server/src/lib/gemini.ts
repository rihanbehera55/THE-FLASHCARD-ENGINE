import { logger } from "./logger.js";
import {
  cleanPdfText,
  chunkSections,
  extractSections,
  type TextChunk,
} from "./text-processing.js";

interface CardInput {
  question: string;
  answer: string;
  hint: string;
  difficulty: number;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

export class GeminiGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiGenerationError";
  }
}

const MODEL_NAME = "gemini-2.5-flash";
const TARGET_CARD_COUNT = 6;
const MAX_FINAL_CARDS = 8;
const MIN_FINAL_CARDS = 5;
const MIN_QUESTION_LENGTH = 14;
const MIN_ANSWER_LENGTH = 24;

function normalizeDifficulty(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(5, Math.max(1, Math.round(value)));
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "easy") return 2;
    if (normalized === "medium") return 3;
    if (normalized === "hard") return 4;
    const parsed = parseInt(normalized, 10);
    if (!Number.isNaN(parsed)) {
      return Math.min(5, Math.max(1, parsed));
    }
  }

  return 3;
}

function cleanJson(raw: string): CardInput[] {
  try {
    const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) {
      return [];
    }

    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((card) => ({
      question: typeof card?.question === "string" ? card.question.trim() : "",
      answer: typeof card?.answer === "string" ? card.answer.trim() : "",
      hint: typeof card?.hint === "string" ? card.hint.trim() : "",
      difficulty: normalizeDifficulty(card?.difficulty),
    }));
  } catch {
    return [];
  }
}

function buildPrompt(chunk: TextChunk, subject: string, level: string, cardLimit: number): string {
  return `You are an expert teacher, educator, and learning designer.

Your task is to convert the given study material into high-quality flashcards for deep understanding and long-term retention.

IMPORTANT CONTEXT:
The input may be noisy, unstructured, or partially broken (e.g., extracted from PDFs).
You must intelligently clean, interpret, and extract meaningful concepts.

GOAL:
Create flashcards that test understanding, reasoning, and clarity - NOT rote memorization.

RULES:
1. UNDERSTAND THE CONTENT
- Extract only meaningful concepts
- Ignore broken, repeated, or irrelevant text
- Combine fragmented sentences into clear ideas
- If sections or headings exist, treat them as separate concepts

2. QUESTION DESIGN
- Questions must be natural and human-like
- Do NOT use phrases like "What is meant by", "Define", or "Explain briefly"
- Ask questions that test understanding, reasoning, or process
- Each question must be self-contained

3. ANSWER DESIGN
- Answers must be clear, complete, and concise
- Do NOT repeat the question
- Do NOT cut sentences midway
- Use simple but precise language

4. QUALITY CONTROL
- Skip unclear or low-quality content
- Prefer 5-8 high-quality flashcards over many poor ones
- Avoid duplication
- Each flashcard must teach something useful

5. DIFFICULTY TAGGING
- easy = basic concept or fact
- medium = explanation or comparison
- hard = reasoning or cause-effect

6. STYLE
- Questions should sound like a teacher helping a student understand
- NOT like an exam template or textbook definition

7. OUTPUT FORMAT
Return ONLY valid JSON. No markdown. No explanation.

[
  {
    "question": "...",
    "answer": "...",
    "hint": "...",
    "difficulty": "easy/medium/hard"
  }
]

ADDITIONAL CONTEXT:
Subject: ${subject}
Level: ${level}
Section heading: ${chunk.heading}
Generate at most ${cardLimit} flashcards for this chunk.

INPUT:
${chunk.content}`;
}

function extractQuestionKey(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|a|an|is|are|of|to|in|for|and|or|what|why|how|when)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isIncompleteAnswer(answer: string): boolean {
  return (
    answer.length < MIN_ANSWER_LENGTH ||
    /(?:\.\.\.|:|-)\s*$/.test(answer) ||
    !/[.?!]$/.test(answer)
  );
}

function isMeaninglessQuestion(question: string): boolean {
  const normalized = question.toLowerCase();
  return (
    question.length < MIN_QUESTION_LENGTH ||
    normalized.startsWith("what is meant by") ||
    normalized.startsWith("define ") ||
    normalized.includes("the above") ||
    normalized.includes("following text")
  );
}

function validateCards(cards: CardInput[], heading: string): CardInput[] {
  return cards.filter((card) => {
    if (!card.question || !card.answer) {
      return false;
    }

    if (isMeaninglessQuestion(card.question) || isIncompleteAnswer(card.answer)) {
      return false;
    }

    if (card.answer.toLowerCase() === card.question.toLowerCase()) {
      return false;
    }

    const hint = card.hint || heading.split(/\s+/).slice(0, 3).join(" ");
    card.hint = hint.slice(0, 40);
    return true;
  });
}

function dedupeCards(cards: CardInput[]): CardInput[] {
  const seen = new Set<string>();
  const deduped: CardInput[] = [];

  for (const card of cards) {
    const questionKey = extractQuestionKey(card.question);
    if (!questionKey || seen.has(questionKey)) {
      continue;
    }

    seen.add(questionKey);
    deduped.push(card);
  }

  return deduped;
}

function scoreCard(card: CardInput): number {
  const hintScore = card.hint ? 2 : 0;
  const questionScore = Math.min(20, Math.floor(card.question.length / 8));
  const answerScore = Math.min(20, Math.floor(card.answer.length / 12));
  return hintScore + questionScore + answerScore + (6 - Math.abs(card.difficulty - 3));
}

function selectFinalCards(cards: CardInput[]): CardInput[] {
  return [...cards]
    .sort((left, right) => scoreCard(right) - scoreCard(left))
    .slice(0, MAX_FINAL_CARDS);
}

function buildFallbackQuestion(sentence: string, heading: string): string {
  const cleanedSentence = sentence.replace(/\s+/g, " ").trim();
  const firstClause = cleanedSentence
    .replace(/^[0-9]+(\.[0-9]+)*\s*/, "")
    .split(/[,:;()-]/)[0]
    .trim();

  if (heading && heading !== "Overview") {
    return `What is the key idea in ${heading.toLowerCase()} regarding ${firstClause.toLowerCase()}?`;
  }

  return `What does the material explain about ${firstClause.toLowerCase()}?`;
}

function buildFallbackCards(cleanedText: string, subject: string): CardInput[] {
  const chunks = chunkSections(extractSections(cleanedText));
  const cards: CardInput[] = [];

  for (const chunk of chunks) {
    const sentences = chunk.content
      .split(/(?<=[.?!])\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length >= 35)
      .slice(0, 2);

    for (const sentence of sentences) {
      cards.push({
        question: buildFallbackQuestion(sentence, chunk.heading || subject),
        answer: sentence,
        hint: chunk.heading.split(/\s+/).slice(0, 3).join(" "),
        difficulty: 2,
      });
    }
  }

  return dedupeCards(validateCards(cards, subject)).slice(0, MIN_FINAL_CARDS);
}

async function generateChunkCards(
  apiKey: string,
  chunk: TextChunk,
  subject: string,
  level: string,
  cardLimit: number,
): Promise<CardInput[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [
            {
              text: "You are a careful study-material extraction system that outputs only valid JSON flashcards.",
            },
          ],
        },
        contents: [
          {
            parts: [{ text: buildPrompt(chunk, subject, level, cardLimit) }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          topP: 0.8,
          maxOutputTokens: 900,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    throw new GeminiGenerationError(
      `Gemini request failed with status ${response.status}`,
    );
  }

  const data = (await response.json()) as GeminiResponse;
  const content =
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("") ?? "";

  return validateCards(cleanJson(content), chunk.heading);
}

export async function generateFlashcardsFromGemini(
  text: string,
  subject = "general",
  level = "intermediate",
): Promise<CardInput[]> {
  if (!text.trim()) {
    throw new GeminiGenerationError("No text was provided for flashcard generation.");
  }

  const apiKey =
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_GEMINI_API_KEY ??
    process.env.GOOGLE_API_KEY;

  const cleanedText = cleanPdfText(text);
  const sections = extractSections(cleanedText);
  const chunks = chunkSections(sections);

  if (!apiKey || chunks.length === 0) {
    return buildFallbackCards(cleanedText, subject);
  }

  const perChunkLimit = Math.max(1, Math.ceil(TARGET_CARD_COUNT / chunks.length));
  const generatedCards: CardInput[] = [];

  for (const chunk of chunks) {
    try {
      const cards = await generateChunkCards(apiKey, chunk, subject, level, perChunkLimit);
      generatedCards.push(...cards);
    } catch (error) {
      logger.warn(
        { err: error, heading: chunk.heading, chunkLength: chunk.content.length },
        "Gemini flashcard generation failed for chunk",
      );
    }
  }

  const fallbackCards = buildFallbackCards(cleanedText, subject);
  const finalCards = selectFinalCards(dedupeCards(generatedCards));
  if (finalCards.length >= MIN_FINAL_CARDS) {
    return finalCards;
  }

  const mergedCards = selectFinalCards(dedupeCards([...finalCards, ...fallbackCards]));
  if (mergedCards.length > 0) {
    return mergedCards;
  }

  if (fallbackCards.length > 0) {
    return fallbackCards;
  }

  throw new GeminiGenerationError(
    "Gemini could not generate usable flashcards from the provided material.",
  );
}
