import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/store/useStore";
import { useListCards, useSubmitReview } from "@workspace/api-client-react";

interface Card {
  id: string;
  question: string;
  answer: string;
  hint: string;
  difficulty: number;
  ef: number;
  intervalDays: number;
  repetitions: number;
  nextReview: string | null;
}

const RATINGS = [
  { value: 0, label: "Again", color: "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30" },
  { value: 2, label: "Hard", color: "bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30" },
  { value: 3, label: "Good", color: "bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30" },
  { value: 4, label: "Easy", color: "bg-primary/20 text-primary border-primary/30 hover:bg-primary/30" },
  { value: 5, label: "Perfect", color: "bg-secondary/20 text-secondary border-secondary/30 hover:bg-secondary/30" },
];

export default function PracticePage() {
  const { deckId } = useParams<{ deckId: string }>();
  const [, navigate] = useLocation();
  const { user, isGuest, guestCards, guestDecks, addGuestReview } = useStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [practiceQueue, setPracticeQueue] = useState<Card[]>([]);
  const submitReview = useSubmitReview();

  const { data: apiCards = [] } = useListCards(deckId!, {
    query: { enabled: !!deckId && !isGuest },
  });

  const deck = isGuest ? guestDecks.find((d) => d.id === deckId) : null;

  useEffect(() => {
    const cards: Card[] = (isGuest
      ? guestCards.filter((c) => c.deckId === deckId)
      : (apiCards as Card[]));
    setPracticeQueue(cards);
  }, [apiCards, isGuest, guestCards, deckId]);

  const current = practiceQueue[currentIndex];

  async function handleRating(rating: number) {
    if (!current) return;

    if (isGuest) {
      addGuestReview(current.id, rating);
    } else if (user) {
      await submitReview.mutateAsync({
        data: { cardId: current.id, userId: user.id, rating },
      });
    }

    setFlipped(false);
    setShowHint(false);

    if (currentIndex + 1 >= practiceQueue.length) {
      setDone(true);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }

  function handleSkip() {
    setFlipped(false);
    setShowHint(false);
    if (currentIndex + 1 >= practiceQueue.length) {
      setDone(true);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-24 h-24 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6 glow-cyan">
            <svg className="w-12 h-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gradient-cyan mb-3">Session Complete</h2>
          <p className="text-muted-foreground mb-8">
            You reviewed {practiceQueue.length} card{practiceQueue.length !== 1 ? "s" : ""}. Great work!
          </p>
          <div className="flex gap-3 justify-center">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => { setCurrentIndex(0); setDone(false); setFlipped(false); }}
              className="px-6 py-3 rounded-xl bg-primary/10 text-primary border border-primary/25 font-medium hover:bg-primary/20 transition-all"
            >
              Study Again
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/library")}
              className="px-6 py-3 rounded-xl bg-white/5 text-foreground border border-white/10 font-medium hover:bg-white/10 transition-all"
            >
              Back to Library
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const progress = practiceQueue.length > 0 ? ((currentIndex) / practiceQueue.length) * 100 : 0;

  return (
    <div className="min-h-screen flex flex-col bg-background grid-bg">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4">
        <button
          onClick={() => navigate(`/library`)}
          className="text-muted-foreground hover:text-foreground transition-colors text-sm flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Exit
        </button>

        <div className="flex items-center gap-4 flex-1 mx-8">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4 }}
              className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
            />
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {currentIndex + 1} / {practiceQueue.length}
          </span>
        </div>

        <button
          onClick={handleSkip}
          className="text-muted-foreground hover:text-foreground transition-colors text-sm"
        >
          Skip
        </button>
      </div>

      {/* Card area */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.25 }}
              className="perspective-1000"
            >
              <motion.div
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ duration: 0.5, type: "spring", stiffness: 200, damping: 20 }}
                className="relative transform-style-3d cursor-pointer"
                style={{ minHeight: "320px" }}
                onClick={() => !flipped && setFlipped(true)}
              >
                {/* Front */}
                <div
                  className={`absolute inset-0 backface-hidden glass-card rounded-3xl p-10 flex flex-col items-center justify-center neon-border text-center ${flipped ? "pointer-events-none" : ""}`}
                >
                  <div className="absolute top-5 left-5">
                    <span className={`text-xs px-2.5 py-1 rounded-full ${
                      current.difficulty <= 2 ? "bg-green-500/10 text-green-400" :
                      current.difficulty === 3 ? "bg-amber-500/10 text-amber-400" :
                      "bg-red-500/10 text-red-400"
                    }`}>
                      {current.difficulty <= 2 ? "Easy" : current.difficulty === 3 ? "Medium" : "Hard"}
                    </span>
                  </div>
                  <p className="text-xl font-semibold text-foreground leading-relaxed mb-6">
                    {current.question}
                  </p>
                  {current.hint && showHint && (
                    <motion.p
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm text-primary/70 bg-primary/5 px-4 py-2 rounded-xl border border-primary/15"
                    >
                      Hint: {current.hint}
                    </motion.p>
                  )}
                  <div className="absolute bottom-5 inset-x-0 flex items-center justify-center gap-6">
                    {current.hint && !showHint && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowHint(true); }}
                        className="text-xs text-muted-foreground hover:text-primary transition-colors"
                      >
                        Show hint
                      </button>
                    )}
                    <p className="text-xs text-muted-foreground">Click to reveal answer</p>
                  </div>
                </div>

                {/* Back */}
                <div
                  className="absolute inset-0 backface-hidden rotate-y-180 glass-card rounded-3xl p-10 flex flex-col items-center justify-center text-center border border-primary/20 glow-cyan"
                  style={{ background: "linear-gradient(135deg, rgba(0,200,255,0.04) 0%, rgba(139,92,246,0.04) 100%)" }}
                >
                  <div className="absolute top-5 left-5 text-xs text-primary/40 uppercase tracking-widest font-medium">
                    Answer
                  </div>
                  <p className="text-lg text-foreground leading-relaxed">{current.answer}</p>
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>

          {/* Rating buttons */}
          <AnimatePresence>
            {flipped && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.25 }}
                className="mt-8"
              >
                <p className="text-center text-xs text-muted-foreground mb-4 uppercase tracking-widest">
                  How well did you know this?
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {RATINGS.map((r) => (
                    <motion.button
                      key={r.value}
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleRating(r.value)}
                      className={`py-3 rounded-xl text-sm font-semibold border transition-all ${r.color}`}
                    >
                      {r.label}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
