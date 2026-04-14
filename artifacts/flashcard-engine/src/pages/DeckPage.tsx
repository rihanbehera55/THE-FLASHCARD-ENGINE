import { useState } from "react";
import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import { useStore } from "@/store/useStore";
import { useListCards, useUpdateCard, useDeleteCard } from "@workspace/api-client-react";

interface Card {
  id: string;
  question: string;
  answer: string;
  hint: string;
  difficulty: number;
  repetitions: number;
  nextReview: string | null;
}

export default function DeckPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const { isGuest, guestCards, guestDecks, updateGuestCard, deleteGuestCard } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Card>>({});
  const updateCard = useUpdateCard();
  const deleteCard = useDeleteCard();

  const { data: apiCards = [], refetch } = useListCards(deckId!, {
    query: { enabled: !!deckId && !isGuest },
  });

  const cards: Card[] = (isGuest
    ? guestCards.filter((c) => c.deckId === deckId)
    : apiCards) as Card[];

  const deck = isGuest
    ? guestDecks.find((d) => d.id === deckId)
    : null;

  async function saveEdit(id: string) {
    if (isGuest) {
      updateGuestCard(id, editData);
    } else {
      await updateCard.mutateAsync({ cardId: id, data: editData });
      refetch();
    }
    setEditingId(null);
    setEditData({});
  }

  async function handleDelete(id: string) {
    if (isGuest) {
      deleteGuestCard(id);
    } else {
      await deleteCard.mutateAsync({ cardId: id });
      refetch();
    }
  }

  function startEdit(card: Card) {
    setEditingId(card.id);
    setEditData({ question: card.question, answer: card.answer, hint: card.hint, difficulty: card.difficulty });
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/library">
          <span className="text-muted-foreground hover:text-foreground transition-colors text-sm cursor-pointer">
            Library
          </span>
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-sm text-foreground">{deck?.title ?? "Deck"}</span>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gradient-cyan">{deck?.title ?? "Cards"}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {cards.length} card{cards.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href={`/practice/${deckId}`}>
          <motion.span
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="px-5 py-2.5 rounded-xl bg-primary/10 text-primary border border-primary/25 text-sm font-medium hover:bg-primary/20 transition-all cursor-pointer glow-cyan"
          >
            Study Now
          </motion.span>
        </Link>
      </div>

      {cards.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">No cards in this deck.</div>
      )}

      <div className="space-y-3">
        {cards.map((card, i) => (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="glass-card rounded-xl p-4 border border-white/[0.06] hover:border-primary/20 transition-all"
          >
            {editingId === card.id ? (
              <div className="space-y-2">
                <input
                  value={editData.question ?? ""}
                  onChange={(e) => setEditData((p) => ({ ...p, question: e.target.value }))}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                  placeholder="Question"
                />
                <textarea
                  value={editData.answer ?? ""}
                  onChange={(e) => setEditData((p) => ({ ...p, answer: e.target.value }))}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50 resize-none"
                  rows={3}
                  placeholder="Answer"
                />
                <div className="flex gap-2">
                  <input
                    value={editData.hint ?? ""}
                    onChange={(e) => setEditData((p) => ({ ...p, hint: e.target.value }))}
                    className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                    placeholder="Hint"
                  />
                  <select
                    value={editData.difficulty ?? 3}
                    onChange={(e) => setEditData((p) => ({ ...p, difficulty: parseInt(e.target.value) }))}
                    className="bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                  >
                    {[1,2,3,4,5].map(d => <option key={d} value={d}>Level {d}</option>)}
                  </select>
                  <button onClick={() => saveEdit(card.id)} className="px-4 py-2 bg-primary/15 text-primary rounded-lg text-sm font-medium hover:bg-primary/25 transition-all">Save</button>
                  <button onClick={() => setEditingId(null)} className="px-3 py-2 text-muted-foreground hover:text-foreground rounded-lg text-sm">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium mb-1.5 text-foreground">{card.question}</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">{card.answer}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {card.hint && (
                      <span className="text-xs text-primary/60 bg-primary/5 px-2 py-0.5 rounded-full">
                        {card.hint}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      card.difficulty <= 2 ? "bg-green-500/10 text-green-400" :
                      card.difficulty === 3 ? "bg-amber-500/10 text-amber-400" :
                      "bg-red-500/10 text-red-400"
                    }`}>
                      {card.difficulty <= 2 ? "Easy" : card.difficulty === 3 ? "Medium" : "Hard"}
                    </span>
                    {card.repetitions > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {card.repetitions} review{card.repetitions !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => startEdit(card)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  <button onClick={() => handleDelete(card.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
