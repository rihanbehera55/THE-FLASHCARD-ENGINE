export interface SM2Card {
  ef: number;
  intervalDays: number;
  repetitions: number;
}

export function computeSM2(card: SM2Card, rating: number): SM2Card {
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
      if (rating === 3) {
        intervalDays = Math.round(intervalDays * ef);
      } else if (rating === 4) {
        intervalDays = Math.round(intervalDays * ef * 1.3);
      } else {
        intervalDays = Math.round(intervalDays * ef * 1.5);
      }
    }
    repetitions += 1;
  }

  const efDelta: Record<number, number> = {
    0: -0.20,
    1: -0.16,
    2: -0.14,
    3: 0,
    4: 0.10,
    5: 0.10,
  };

  ef = Math.max(1.3, ef + (efDelta[rating] ?? 0));

  return { ef, intervalDays, repetitions };
}

export function nextReviewDate(intervalDays: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + intervalDays);
  return d;
}
