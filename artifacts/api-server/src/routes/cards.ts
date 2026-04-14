import { Router } from "express";
import { db } from "@workspace/db";
import { cardsTable, decksTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  ListCardsParams,
  UpdateCardParams,
  UpdateCardBody,
  DeleteCardParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/decks/:deckId/cards", async (req, res) => {
  const parsed = ListCardsParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  const { deckId } = parsed.data;
  const cards = await db
    .select()
    .from(cardsTable)
    .where(eq(cardsTable.deckId, deckId));

  res.json(
    cards.map((c) => ({
      ...c,
      nextReview: c.nextReview ?? null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
  );
});

router.put("/cards/:cardId", async (req, res) => {
  const paramsParsed = UpdateCardParams.safeParse(req.params);
  const bodyParsed = UpdateCardBody.safeParse(req.body);

  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { cardId } = paramsParsed.data;
  const updates = bodyParsed.data;

  const [card] = await db
    .update(cardsTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(cardsTable.id, cardId))
    .returning();

  if (!card) {
    res.status(404).json({ error: "Card not found" });
    return;
  }

  res.json({
    ...card,
    nextReview: card.nextReview ?? null,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  });
});

router.delete("/cards/:cardId", async (req, res) => {
  const parsed = DeleteCardParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  const { cardId } = parsed.data;
  const [card] = await db
    .select()
    .from(cardsTable)
    .where(eq(cardsTable.id, cardId))
    .limit(1);

  if (card) {
    await db.delete(cardsTable).where(eq(cardsTable.id, cardId));
    await db
      .update(decksTable)
      .set({
        totalCards: sql`${decksTable.totalCards} - 1`,
        updatedAt: new Date(),
      })
      .where(eq(decksTable.id, card.deckId));
  }

  res.json({ success: true });
});

export default router;
