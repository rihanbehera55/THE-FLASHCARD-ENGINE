import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useStore } from "@/store/useStore";
import { useListDecks, useDeleteDeck } from "@workspace/api-client-react";

export default function LibraryPage() {
  const { user, isGuest, guestDecks, deleteGuestDeck } = useStore();
  const [search, setSearch] = useState("");
  const deleteDeck = useDeleteDeck();

  const { data: apiDecks = [], isLoading, refetch } = useListDecks(
    user ? { userId: user.id } : undefined,
    { query: { enabled: !!user && !isGuest } },
  );

  const decks = isGuest || !user ? guestDecks : apiDecks;

  const filtered = decks.filter((d) =>
    d.title.toLowerCase().includes(search.toLowerCase()),
  );

  async function handleDelete(id: string) {
    if (isGuest || !user) {
      deleteGuestDeck(id);
    } else {
      await deleteDeck.mutateAsync({ deckId: id });
      refetch();
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gradient-cyan">Library</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {decks.length} deck{decks.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/">
          <motion.span
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="px-5 py-2.5 rounded-xl bg-primary/10 text-primary border border-primary/25 text-sm font-medium hover:bg-primary/20 transition-all cursor-pointer glow-cyan"
          >
            + New Deck
          </motion.span>
        </Link>
      </div>

      <div className="mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search decks..."
          className="w-full max-w-sm bg-input border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground/40"
        />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-24"
        >
          <div className="w-20 h-20 rounded-full bg-primary/5 flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-primary/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <p className="text-muted-foreground mb-4">No decks yet. Upload a PDF to get started.</p>
          <Link href="/">
            <span className="px-5 py-2 rounded-xl bg-primary/10 text-primary border border-primary/25 text-sm font-medium hover:bg-primary/20 transition-all cursor-pointer">
              Upload PDF
            </span>
          </Link>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((deck, i) => (
          <motion.div
            key={deck.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card rounded-2xl p-5 border border-white/[0.06] hover:border-primary/25 transition-all group relative"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground truncate mb-0.5">{deck.title}</h3>
                <p className="text-xs text-muted-foreground">
                  {deck.totalCards} card{deck.totalCards !== 1 ? "s" : ""}
                </p>
              </div>
              <button
                onClick={() => handleDelete(deck.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">Mastery</span>
                <span className="text-primary font-medium">{Math.round(deck.masteryPct)}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${deck.masteryPct}%` }}
                  transition={{ delay: i * 0.05 + 0.2, duration: 0.8, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                />
              </div>
            </div>

            {deck.dueToday > 0 && (
              <div className="mb-4 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-xs text-amber-400 font-medium">
                  {deck.dueToday} due today
                </span>
              </div>
            )}

            <div className="flex gap-2">
              <Link href={`/deck/${deck.id}`}>
                <motion.span
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 flex items-center justify-center px-3 py-2 rounded-xl text-xs font-medium text-muted-foreground border border-white/[0.08] hover:border-white/20 hover:text-foreground transition-all cursor-pointer"
                >
                  View Cards
                </motion.span>
              </Link>
              <Link href={`/practice/${deck.id}`}>
                <motion.span
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 flex items-center justify-center px-3 py-2 rounded-xl text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all cursor-pointer"
                >
                  Study Now
                </motion.span>
              </Link>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
