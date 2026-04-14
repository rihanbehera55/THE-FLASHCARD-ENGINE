interface DeckProgressInput {
  reviewedCards: number;
  sm2ReviewedCards: number;
  totalCards: number;
}

export interface RetentionPoint {
  day: string;
  retention: number;
}

export function computeDeckProgressPct({
  reviewedCards,
  sm2ReviewedCards,
  totalCards,
}: DeckProgressInput): number {
  if (!totalCards || totalCards <= 0) {
    return 0;
  }

  const progressedCards = Math.max(reviewedCards, sm2ReviewedCards);
  return Math.min(100, Math.max(0, (progressedCards / totalCards) * 100));
}

export function buildRetentionCurve(
  retentionRate: number,
  stability: number,
  days = 7,
): RetentionPoint[] {
  const safeBase = Math.min(100, Math.max(0, retentionRate));
  const safeStability = Math.max(1, stability);

  return Array.from({ length: days }, (_, index) => {
    const dayNumber = index + 1;
    const retention = safeBase * Math.exp(-(dayNumber - 1) / safeStability);

    return {
      day: `D${dayNumber}`,
      retention: Number(retention.toFixed(2)),
    };
  });
}
