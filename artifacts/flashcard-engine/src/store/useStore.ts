import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface UserState {
  id: string;
  email: string;
  name: string;
  streakDays: number;
}

export interface GuestCard {
  id: string;
  deckId: string;
  question: string;
  answer: string;
  hint: string;
  difficulty: number;
  ef: number;
  intervalDays: number;
  repetitions: number;
  nextReview: string | null;
  createdAt: string;
}

export interface GuestDeck {
  id: string;
  userId: string;
  title: string;
  description: string;
  totalCards: number;
  masteryPct: number;
  createdAt: string;
  dueToday: number;
}

function getDeckMetrics(cards: GuestCard[]) {
  const today = new Date().toISOString().split("T")[0];
  const reviewedCards = cards.filter((card) => card.repetitions > 0 || card.ef > 2.5).length;
  const totalCards = cards.length;

  return {
    totalCards,
    masteryPct: totalCards > 0 ? (reviewedCards / totalCards) * 100 : 0,
    dueToday: cards.filter((card) => !card.nextReview || card.nextReview <= today).length,
  };
}

function buildGuestRetentionCurve(retentionRate: number, cardsReviewedToday: number) {
  const baseRetention = retentionRate > 0 ? retentionRate : 85;
  const stability = Math.max(2, Math.min(8, 2 + cardsReviewedToday / 4));

  return Array.from({ length: 7 }, (_, index) => {
    const dayIndex = index + 1;
    return {
      day: `D${dayIndex}`,
      retention: Number((baseRetention * Math.exp(-(dayIndex - 1) / stability)).toFixed(2)),
    };
  });
}

interface AppState {
  user: UserState | null;
  isGuest: boolean;
  guestDecks: GuestDeck[];
  guestCards: GuestCard[];
  guestReviews: Array<{ cardId: string; rating: number; reviewedAt: string }>;

  setUser: (user: UserState) => void;
  clearUser: () => void;
  setGuest: () => void;

  addGuestDeck: (deck: GuestDeck, cards: GuestCard[]) => void;
  deleteGuestDeck: (deckId: string) => void;
  updateGuestCard: (cardId: string, updates: Partial<GuestCard>) => void;
  deleteGuestCard: (cardId: string) => void;
  addGuestReview: (cardId: string, rating: number) => void;
  getGuestDueCards: (deckId: string) => GuestCard[];
  getGuestStats: () => {
    totalDecks: number;
    totalCards: number;
    masteredCards: number;
    streakDays: number;
    cardsReviewedToday: number;
    dueToday: number;
    averageMastery: number;
    retentionRate: number;
    retentionCurve: Array<{ day: string; retention: number }>;
  };
}

function computeSM2(card: GuestCard, rating: number): Partial<GuestCard> {
  let { ef, intervalDays, repetitions } = card;

  if (rating < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 6;
    } else {
      if (rating === 3) intervalDays = Math.round(intervalDays * ef);
      else if (rating === 4) intervalDays = Math.round(intervalDays * ef * 1.3);
      else intervalDays = Math.round(intervalDays * ef * 1.5);
    }
    repetitions += 1;
  }

  const efDelta: Record<number, number> = { 0: -0.2, 1: -0.16, 2: -0.14, 3: 0, 4: 0.1, 5: 0.1 };
  ef = Math.max(1.3, ef + (efDelta[rating] ?? 0));

  const next = new Date();
  next.setDate(next.getDate() + intervalDays);
  const nextReview = next.toISOString().split("T")[0];

  return { ef, intervalDays, repetitions, nextReview };
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      isGuest: false,
      guestDecks: [],
      guestCards: [],
      guestReviews: [],

      setUser: (user) => set({ user, isGuest: false }),
      clearUser: () => set({ user: null, isGuest: false }),
      setGuest: () => set({ isGuest: true, user: null }),

      addGuestDeck: (deck, cards) =>
        set((s) => ({
          guestDecks: [...s.guestDecks, deck],
          guestCards: [...s.guestCards, ...cards],
        })),

      deleteGuestDeck: (deckId) =>
        set((s) => ({
          guestDecks: s.guestDecks.filter((d) => d.id !== deckId),
          guestCards: s.guestCards.filter((c) => c.deckId !== deckId),
        })),

      updateGuestCard: (cardId, updates) =>
        set((s) => ({
          guestCards: s.guestCards.map((c) =>
            c.id === cardId ? { ...c, ...updates } : c,
          ),
        })),

      deleteGuestCard: (cardId) =>
        set((s) => {
          const removedCard = s.guestCards.find((card) => card.id === cardId);
          const nextCards = s.guestCards.filter((card) => card.id !== cardId);

          return {
            guestCards: nextCards,
            guestDecks: removedCard
              ? s.guestDecks.map((deck) => {
                  if (deck.id !== removedCard.deckId) return deck;
                  const deckCards = nextCards.filter((deckCard) => deckCard.deckId === deck.id);
                  const metrics = getDeckMetrics(deckCards);
                  return { ...deck, ...metrics };
                })
              : s.guestDecks,
          };
        }),

      addGuestReview: (cardId, rating) => {
        const card = get().guestCards.find((c) => c.id === cardId);
        if (!card) return;
        const updated = computeSM2(card, rating);
        set((s) => {
          const nextCards = s.guestCards.map((c) =>
            c.id === cardId ? { ...c, ...updated } : c,
          );
          const deckCards = nextCards.filter((deckCard) => deckCard.deckId === card.deckId);
          const metrics = getDeckMetrics(deckCards);

          return {
            guestCards: nextCards,
            guestDecks: s.guestDecks.map((deck) =>
              deck.id === card.deckId ? { ...deck, ...metrics } : deck,
            ),
            guestReviews: [
              ...s.guestReviews,
              { cardId, rating, reviewedAt: new Date().toISOString() },
            ],
          };
        });
      },

      getGuestDueCards: (deckId) => {
        const today = new Date().toISOString().split("T")[0];
        return get().guestCards.filter(
          (c) =>
            c.deckId === deckId &&
            (!c.nextReview || c.nextReview <= today),
        );
      },

      getGuestStats: () => {
        const { guestDecks, guestCards, guestReviews } = get();
        const today = new Date().toISOString().split("T")[0];
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const totalDecks = guestDecks.length;
        const totalCards = guestCards.length;
        const masteredCards = guestCards.filter((c) => c.repetitions >= 3).length;
        const dueToday = guestCards.filter((c) => !c.nextReview || c.nextReview <= today).length;
        const cardsReviewedToday = guestReviews.filter(
          (r) => new Date(r.reviewedAt) >= todayStart,
        ).length;
        const averageMastery =
          totalCards > 0
            ? (guestCards.filter((c) => c.repetitions > 0 || c.ef > 2.5).length / totalCards) * 100
            : 0;
        const retentionRate = totalCards > 0 ? (masteredCards / totalCards) * 100 : 0;
        const retentionCurve = buildGuestRetentionCurve(retentionRate, cardsReviewedToday);

        return {
          totalDecks,
          totalCards,
          masteredCards,
          streakDays: 0,
          cardsReviewedToday,
          dueToday,
          averageMastery,
          retentionRate,
          retentionCurve,
        };
      },
    }),
    {
      name: "flashcard-engine-session",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
