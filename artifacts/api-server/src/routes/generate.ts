import { Router } from "express";
import {
  GeminiGenerationError,
  generateFlashcardsFromGemini,
} from "../lib/gemini.js";
import { GenerateCardsBody } from "@workspace/api-zod";

const router = Router();

router.post("/", async (req, res) => {
  const parsed = GenerateCardsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { text, subject, level } = parsed.data;

  try {
    const cards = await generateFlashcardsFromGemini(
      text,
      subject ?? "general",
      level ?? "intermediate",
    );

    res.json({ cards });
  } catch (error) {
    if (error instanceof GeminiGenerationError) {
      res.status(503).json({
        error: "Flashcard generation is temporarily unavailable. Please try again.",
      });
      return;
    }

    throw error;
  }
});

export default router;
