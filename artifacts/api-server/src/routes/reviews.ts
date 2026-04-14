import { Router } from "express";
import { db } from "@workspace/db";
import { cardsTable, reviewsTable, decksTable, usersTable } from "@workspace/db";
import { eq, and, lte, sql, gte } from "drizzle-orm";
import { computeSM2, nextReviewDate } from "../lib/sm2.js";
import { buildRetentionCurve, computeDeckProgressPct } from "../lib/progress.js";
import {
  SubmitReviewBody,
  GetDueCardsParams,
  GetUserStatsParams,
} from "@workspace/api-zod";

const router = Router();

async function getDeckProgress(deckId: string, userId: string) {
  const cards = await db
    .select({
      id: cardsTable.id,
      ef: cardsTable.ef,
      repetitions: cardsTable.repetitions,
    })
    .from(cardsTable)
    .where(eq(cardsTable.deckId, deckId));

  const reviewedRows = await db
    .selectDistinct({ cardId: reviewsTable.cardId })
    .from(reviewsTable)
    .innerJoin(cardsTable, eq(reviewsTable.cardId, cardsTable.id))
    .where(and(eq(cardsTable.deckId, deckId), eq(reviewsTable.userId, userId)));

  return computeDeckProgressPct({
    totalCards: cards.length,
    reviewedCards: reviewedRows.length,
    sm2ReviewedCards: cards.filter(
      (deckCard) => deckCard.repetitions > 0 || deckCard.ef > 2.5,
    ).length,
  });
}

router.post("/reviews", async (req, res) => {
  const parsed = SubmitReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { cardId, userId, rating } = parsed.data;

  const [card] = await db
    .select()
    .from(cardsTable)
    .where(eq(cardsTable.id, cardId))
    .limit(1);

  if (!card) {
    res.status(404).json({ error: "Card not found" });
    return;
  }

  const updated = computeSM2(
    { ef: card.ef, intervalDays: card.intervalDays, repetitions: card.repetitions },
    rating,
  );
  const nextDate = nextReviewDate(updated.intervalDays);

  const [updatedCard] = await db
    .update(cardsTable)
    .set({
      ef: updated.ef,
      intervalDays: updated.intervalDays,
      repetitions: updated.repetitions,
      nextReview: nextDate.toISOString().split("T")[0],
      updatedAt: new Date(),
    })
    .where(eq(cardsTable.id, cardId))
    .returning();

  await db.insert(reviewsTable).values({ cardId, userId, rating });

  // Align deck progress with reviewed-card progress instead of mastered-only cards.
  const masteryPct = await getDeckProgress(card.deckId, userId);

  await db
    .update(decksTable)
    .set({ masteryPct, updatedAt: new Date() })
    .where(eq(decksTable.id, card.deckId));

  await updateStreak(userId);

  res.json({
    ...updatedCard,
    nextReview: updatedCard.nextReview ?? null,
    createdAt: updatedCard.createdAt.toISOString(),
    updatedAt: updatedCard.updatedAt.toISOString(),
  });
});

async function updateStreak(userId: string) {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastStudied = user.lastStudiedAt ? new Date(user.lastStudiedAt) : null;

  if (lastStudied) {
    lastStudied.setHours(0, 0, 0, 0);
    const diffDays = Math.floor(
      (today.getTime() - lastStudied.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diffDays === 0) return;
    if (diffDays === 1) {
      await db
        .update(usersTable)
        .set({ streakDays: user.streakDays + 1, lastStudiedAt: new Date() })
        .where(eq(usersTable.id, userId));
    } else {
      await db
        .update(usersTable)
        .set({ streakDays: 1, lastStudiedAt: new Date() })
        .where(eq(usersTable.id, userId));
    }
  } else {
    await db
      .update(usersTable)
      .set({ streakDays: 1, lastStudiedAt: new Date() })
      .where(eq(usersTable.id, userId));
  }
}

router.get("/users/:userId/due-cards", async (req, res) => {
  const parsed = GetDueCardsParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  const { userId } = parsed.data;
  const today = new Date().toISOString().split("T")[0];

  const userDecks = await db
    .select()
    .from(decksTable)
    .where(eq(decksTable.userId, userId));

  const deckIds = userDecks.map((d) => d.id);
  if (deckIds.length === 0) {
    res.json([]);
    return;
  }

  const allDue: Array<object> = [];
  for (const deckId of deckIds) {
    const dueCards = await db
      .select()
      .from(cardsTable)
      .where(
        and(eq(cardsTable.deckId, deckId), lte(cardsTable.nextReview, today)),
      );
    allDue.push(
      ...dueCards.map((c) => ({
        ...c,
        nextReview: c.nextReview ?? null,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    );
  }

  res.json(allDue);
});

router.get("/users/:userId/stats", async (req, res) => {
  const parsed = GetUserStatsParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  const { userId } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  const userDecks = await db
    .select()
    .from(decksTable)
    .where(eq(decksTable.userId, userId));

  const totalDecks = userDecks.length;
  let totalCards = 0;
  let masteredCards = 0;
  let dueToday = 0;
  let reviewedCards = 0;
  let averageEf = 2.5;

  const today = new Date().toISOString().split("T")[0];

  for (const deck of userDecks) {
    const cards = await db
      .select()
      .from(cardsTable)
      .where(eq(cardsTable.deckId, deck.id));
    totalCards += cards.length;
    masteredCards += cards.filter((c) => c.repetitions >= 3).length;
    reviewedCards += cards.filter((c) => c.repetitions > 0 || c.ef > 2.5).length;
    dueToday += cards.filter(
      (c) => c.nextReview && c.nextReview <= today,
    ).length;
  }

  if (totalCards > 0) {
    const efAgg = await db
      .select({
        avgEf: sql<number>`coalesce(avg(${cardsTable.ef}), 2.5)`,
      })
      .from(cardsTable)
      .innerJoin(decksTable, eq(cardsTable.deckId, decksTable.id))
      .where(eq(decksTable.userId, userId));

    averageEf = Number(efAgg[0]?.avgEf ?? 2.5);
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const reviewsToday = await db
    .select({ count: sql<number>`count(*)` })
    .from(reviewsTable)
    .where(
      and(
        eq(reviewsTable.userId, userId),
        gte(reviewsTable.reviewedAt, todayStart),
      ),
    );

  const cardsReviewedToday = Number(reviewsToday[0]?.count ?? 0);
  const averageMastery =
    totalCards > 0 ? (reviewedCards / totalCards) * 100 : 0;
  const retentionRate = totalCards > 0 ? (masteredCards / totalCards) * 100 : 0;
  const retentionCurve = buildRetentionCurve(
    retentionRate > 0 ? retentionRate : 85,
    Math.max(1.5, averageEf * 1.8),
  );

  res.json({
    userId,
    totalDecks,
    totalCards,
    masteredCards,
    streakDays: user?.streakDays ?? 0,
    cardsReviewedToday,
    dueToday,
    averageMastery,
    retentionRate,
    retentionCurve,
  });
});

export default router;
