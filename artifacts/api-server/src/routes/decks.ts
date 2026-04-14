import { Router } from "express";
import { db } from "@workspace/db";
import { decksTable, cardsTable, reviewsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { computeDeckProgressPct } from "../lib/progress.js";
import {
  ListDecksQueryParams,
  CreateDeckBody,
  GetDeckParams,
  UpdateDeckParams,
  UpdateDeckBody,
  DeleteDeckParams,
} from "@workspace/api-zod";

const router = Router();

async function getDeckMetrics(deckId: string, userId: string, today: string) {
  const cards = await db
    .select({
      id: cardsTable.id,
      ef: cardsTable.ef,
      repetitions: cardsTable.repetitions,
      nextReview: cardsTable.nextReview,
    })
    .from(cardsTable)
    .where(eq(cardsTable.deckId, deckId));

  const reviewedRows = await db
    .selectDistinct({ cardId: reviewsTable.cardId })
    .from(reviewsTable)
    .innerJoin(cardsTable, eq(reviewsTable.cardId, cardsTable.id))
    .where(and(eq(cardsTable.deckId, deckId), eq(reviewsTable.userId, userId)));

  const totalCards = cards.length;
  const reviewedCards = reviewedRows.length;
  const sm2ReviewedCards = cards.filter(
    (card) => card.repetitions > 0 || card.ef > 2.5,
  ).length;
  const dueToday = cards.filter(
    (card) => !!card.nextReview && card.nextReview <= today,
  ).length;

  return {
    totalCards,
    dueToday,
    masteryPct: computeDeckProgressPct({
      reviewedCards,
      sm2ReviewedCards,
      totalCards,
    }),
  };
}

router.get("/", async (req, res) => {
  const parsed = ListDecksQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }

  const { userId } = parsed.data;

  const decks = userId
    ? await db.select().from(decksTable).where(eq(decksTable.userId, userId))
    : await db.select().from(decksTable);

  const today = new Date().toISOString().split("T")[0];

  const decksWithDue = await Promise.all(
    decks.map(async (deck) => {
      // Recompute per-deck metrics to avoid stale percentages and cross-deck leakage.
      const metrics = await getDeckMetrics(deck.id, deck.userId, today);
      return {
        ...deck,
        totalCards: metrics.totalCards,
        masteryPct: metrics.masteryPct,
        createdAt: deck.createdAt.toISOString(),
        updatedAt: deck.updatedAt.toISOString(),
        dueToday: metrics.dueToday,
        sourcePdfUrl: deck.sourcePdfUrl ?? undefined,
      };
    }),
  );

  res.json(decksWithDue);
});

router.post("/", async (req, res) => {
  const parsed = CreateDeckBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { userId, title, description, cards } = parsed.data;

  const [deck] = await db
    .insert(decksTable)
    .values({ userId, title, description: description ?? "" })
    .returning();

  if (cards && cards.length > 0) {
    await db.insert(cardsTable).values(
      cards.map((c) => ({
        deckId: deck.id,
        question: c.question,
        answer: c.answer,
        hint: c.hint ?? "",
        difficulty: c.difficulty,
      })),
    );

    await db
      .update(decksTable)
      .set({ totalCards: cards.length })
      .where(eq(decksTable.id, deck.id));
  }

  res.status(201).json({
    ...deck,
    createdAt: deck.createdAt.toISOString(),
    updatedAt: deck.updatedAt.toISOString(),
    dueToday: 0,
    sourcePdfUrl: deck.sourcePdfUrl ?? undefined,
  });
});

router.get("/:deckId", async (req, res) => {
  const parsed = GetDeckParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  const { deckId } = parsed.data;
  const [deck] = await db
    .select()
    .from(decksTable)
    .where(eq(decksTable.id, deckId));

  if (!deck) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const metrics = await getDeckMetrics(deck.id, deck.userId, today);

  res.json({
    ...deck,
    totalCards: metrics.totalCards,
    masteryPct: metrics.masteryPct,
    createdAt: deck.createdAt.toISOString(),
    updatedAt: deck.updatedAt.toISOString(),
    dueToday: metrics.dueToday,
    sourcePdfUrl: deck.sourcePdfUrl ?? undefined,
  });
});

router.put("/:deckId", async (req, res) => {
  const paramsParsed = UpdateDeckParams.safeParse(req.params);
  const bodyParsed = UpdateDeckBody.safeParse(req.body);

  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { deckId } = paramsParsed.data;
  const updates = bodyParsed.data;

  const [deck] = await db
    .update(decksTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(decksTable.id, deckId))
    .returning();

  if (!deck) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }

  res.json({
    ...deck,
    createdAt: deck.createdAt.toISOString(),
    updatedAt: deck.updatedAt.toISOString(),
    dueToday: 0,
    sourcePdfUrl: deck.sourcePdfUrl ?? undefined,
  });
});

router.delete("/:deckId", async (req, res) => {
  const parsed = DeleteDeckParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  const { deckId } = parsed.data;
  await db.delete(cardsTable).where(eq(cardsTable.deckId, deckId));
  await db.delete(decksTable).where(eq(decksTable.id, deckId));

  res.json({ success: true });
});

export default router;
