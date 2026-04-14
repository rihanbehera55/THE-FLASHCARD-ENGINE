import { pgTable, text, timestamp, integer, real, uuid, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const decksTable = pgTable("decks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description").default("").notNull(),
  sourcePdfUrl: text("source_pdf_url"),
  totalCards: integer("total_cards").default(0).notNull(),
  masteryPct: real("mastery_pct").default(0).notNull(),
  archived: boolean("archived").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDeckSchema = createInsertSchema(decksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  totalCards: true,
  masteryPct: true,
});

export type InsertDeck = z.infer<typeof insertDeckSchema>;
export type Deck = typeof decksTable.$inferSelect;
