import { pgTable, text, timestamp, integer, real, uuid, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cardsTable = pgTable("cards", {
  id: uuid("id").defaultRandom().primaryKey(),
  deckId: uuid("deck_id").notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  hint: text("hint").default("").notNull(),
  difficulty: integer("difficulty").default(3).notNull(),
  ef: real("ef").default(2.5).notNull(),
  intervalDays: integer("interval_days").default(1).notNull(),
  repetitions: integer("repetitions").default(0).notNull(),
  nextReview: date("next_review"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCardSchema = createInsertSchema(cardsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCard = z.infer<typeof insertCardSchema>;
export type Card = typeof cardsTable.$inferSelect;
