import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/store/useStore";
import { useGenerateCards, useCreateDeck } from "@workspace/api-client-react";
import { extractTextFromPDF } from "@/lib/pdfExtract";

interface GeneratedCard {
  question: string;
  answer: string;
  hint: string;
  difficulty: number;
}

export default function HomePage() {
  const [, navigate] = useLocation();
  const { user, isGuest, addGuestDeck } = useStore();
  const [dragOver, setDragOver] = useState(false);
  const [inputMode, setInputMode] = useState<"pdf" | "text">("pdf");
  const [rawText, setRawText] = useState("");
  const [subject, setSubject] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedCards, setGeneratedCards] = useState<GeneratedCard[]>([]);
  const [deckTitle, setDeckTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingCard, setEditingCard] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const generateCards = useGenerateCards();
  const createDeck = useCreateDeck();

  async function processText(text: string) {
    setGenerating(true);
    setGeneratedCards([]);
    try {
      const result = await generateCards.mutateAsync({
        data: { text, subject: subject || "general", level: "intermediate" },
      });
      setGeneratedCards(result.cards as GeneratedCard[]);
    } catch {
      setGeneratedCards([
        { question: "Failed to generate cards. Try again.", answer: "Check your connection or API key.", hint: "", difficulty: 3 },
      ]);
    } finally {
      setGenerating(false);
    }
  }

  async function handleFile(file: File) {
    if (!file.name.endsWith(".pdf") && file.type !== "application/pdf") return;
    const text = await extractTextFromPDF(file);
    if (!deckTitle) setDeckTitle(file.name.replace(".pdf", ""));
    await processText(text);
  }

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) await handleFile(file);
    },
    [subject],
  );

  async function handleSave() {
    if (!deckTitle || generatedCards.length === 0) return;
    setSaving(true);

    try {
      const title = deckTitle || "Untitled Deck";
      const cards = generatedCards;

      if (isGuest || !user) {
        const id = crypto.randomUUID();
        const guestCards = cards.map((c) => ({
          id: crypto.randomUUID(),
          deckId: id,
          question: c.question,
          answer: c.answer,
          hint: c.hint || "",
          difficulty: c.difficulty,
          ef: 2.5,
          intervalDays: 1,
          repetitions: 0,
          nextReview: null,
          createdAt: new Date().toISOString(),
        }));
        addGuestDeck(
          {
            id,
            userId: "guest",
            title,
            description: "",
            totalCards: cards.length,
            masteryPct: 0,
            createdAt: new Date().toISOString(),
            dueToday: cards.length,
          },
          guestCards,
        );
        navigate("/library");
        return;
      }

      await createDeck.mutateAsync({
        data: {
          userId: user.id,
          title,
          cards: cards.map((c) => ({
            question: c.question,
            answer: c.answer,
            hint: c.hint,
            difficulty: c.difficulty,
          })),
        },
      });
      navigate("/library");
    } finally {
      setSaving(false);
    }
  }

  function removeCard(i: number) {
    setGeneratedCards((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateCard(i: number, field: keyof GeneratedCard, value: string | number) {
    setGeneratedCards((prev) =>
      prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)),
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12"
      >
        <h1 className="text-5xl font-extrabold text-gradient-cyan mb-4 tracking-tight">
          Transform PDFs into Mastery
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Drop a PDF or paste text. Our AI generates intelligent flashcards with spaced repetition scheduling.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card rounded-2xl p-6 mb-6 neon-border"
      >
        <div className="flex gap-2 mb-5">
          {(["pdf", "text"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setInputMode(mode)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                inputMode === mode
                  ? "bg-primary/15 text-primary border border-primary/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03] border border-transparent"
              }`}
            >
              {mode === "pdf" ? "Upload PDF" : "Paste Text"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5 uppercase tracking-wide font-medium">
              Deck Title
            </label>
            <input
              value={deckTitle}
              onChange={(e) => setDeckTitle(e.target.value)}
              placeholder="e.g. Biology Chapter 6"
              className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground/40"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5 uppercase tracking-wide font-medium">
              Subject (optional)
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Biology, History"
              className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground/40"
            />
          </div>
        </div>

        {inputMode === "pdf" ? (
          <motion.div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            animate={{ borderColor: dragOver ? "rgba(0,200,255,0.6)" : "rgba(255,255,255,0.08)" }}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
              dragOver ? "bg-primary/5 glow-cyan" : "hover:border-white/20 hover:bg-white/[0.01]"
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <div className="text-5xl mb-4 opacity-40">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-foreground font-medium mb-1">Drop your PDF here</p>
            <p className="text-muted-foreground text-sm">or click to browse — up to 20MB</p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste your study material here..."
              rows={8}
              className="w-full bg-input border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground/40 resize-none"
            />
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => processText(rawText)}
              disabled={!rawText.trim() || generating}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm glow-cyan disabled:opacity-40 hover:bg-primary/90 transition-all"
            >
              {generating ? "Generating..." : "Generate Flashcards"}
            </motion.button>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {generating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-12"
          >
            <div className="inline-flex items-center gap-3 text-primary">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium">Generating intelligent flashcards...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {generatedCards.length > 0 && !generating && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {generatedCards.length} cards generated — review before saving
              </h2>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSave}
                disabled={saving || !deckTitle}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm glow-cyan disabled:opacity-40 hover:bg-primary/90 transition-all"
              >
                {saving ? "Saving..." : "Save Deck"}
              </motion.button>
            </div>

            <div className="space-y-3">
              {generatedCards.map((card, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="glass-card rounded-xl p-4 border border-white/[0.06] hover:border-primary/20 transition-all"
                >
                  {editingCard === i ? (
                    <div className="space-y-2">
                      <input
                        value={card.question}
                        onChange={(e) => updateCard(i, "question", e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                      />
                      <input
                        value={card.answer}
                        onChange={(e) => updateCard(i, "answer", e.target.value)}
                        className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                      />
                      <div className="flex gap-2">
                        <input
                          value={card.hint}
                          onChange={(e) => updateCard(i, "hint", e.target.value)}
                          placeholder="Hint (optional)"
                          className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                        />
                        <select
                          value={card.difficulty}
                          onChange={(e) => updateCard(i, "difficulty", parseInt(e.target.value))}
                          className="bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                        >
                          {[1,2,3,4,5].map(d => <option key={d} value={d}>Level {d}</option>)}
                        </select>
                        <button onClick={() => setEditingCard(null)} className="px-3 py-2 bg-primary/15 text-primary rounded-lg text-sm">Done</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-sm font-medium mb-1">{card.question}</p>
                        <p className="text-muted-foreground text-xs">{card.answer}</p>
                        {card.hint && (
                          <span className="mt-1.5 inline-block text-xs text-primary/60 bg-primary/5 px-2 py-0.5 rounded-full">
                            {card.hint}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          card.difficulty <= 2 ? "bg-green-500/10 text-green-400" :
                          card.difficulty === 3 ? "bg-amber-500/10 text-amber-400" :
                          "bg-red-500/10 text-red-400"
                        }`}>
                          {card.difficulty <= 2 ? "Easy" : card.difficulty === 3 ? "Medium" : "Hard"}
                        </span>
                        <button onClick={() => setEditingCard(i)} className="text-muted-foreground hover:text-foreground transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button onClick={() => removeCard(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
