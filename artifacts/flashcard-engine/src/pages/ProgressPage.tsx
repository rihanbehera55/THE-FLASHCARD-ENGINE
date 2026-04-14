import { motion } from "framer-motion";
import { useStore } from "@/store/useStore";
import { useGetUserStats } from "@workspace/api-client-react";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  glowClass?: string;
}

function StatCard({ label, value, sub, glowClass = "" }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-card rounded-2xl p-6 border border-white/[0.06] ${glowClass}`}
    >
      <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2 font-medium">{label}</p>
      <p className="text-3xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </motion.div>
  );
}

function buildRetentionCurve(retentionRate: number, cardsReviewedToday: number) {
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

export default function ProgressPage() {
  const { user, isGuest, getGuestStats } = useStore();

  const { data: apiStats } = useGetUserStats(user?.id ?? "", {
    query: { enabled: !!user && !isGuest },
  });

  const stats = isGuest || !user ? getGuestStats() : apiStats;

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const averageMastery = Math.round(stats.averageMastery);
  const retentionRate = Math.round(stats.retentionRate);
  const retentionData = "retentionCurve" in stats && Array.isArray(stats.retentionCurve)
    ? stats.retentionCurve.map((point) => ({
        day: point.day ?? "D1",
        retention: Number.isFinite(point.retention) ? point.retention : 0,
      }))
    : buildRetentionCurve(stats.retentionRate ?? 0, stats.cardsReviewedToday ?? 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gradient-cyan">Progress</h1>
        <p className="text-muted-foreground text-sm mt-1">Your learning analytics at a glance</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Streak", value: `${stats.streakDays}d`, sub: "days in a row", glowClass: "hover:border-amber-500/20" },
          { label: "Due Today", value: stats.dueToday, sub: "cards to review", glowClass: "hover:border-red-500/20" },
          { label: "Reviewed Today", value: stats.cardsReviewedToday, sub: "sessions", glowClass: "hover:border-primary/20" },
          { label: "Mastered", value: stats.masteredCards, sub: `of ${stats.totalCards} total`, glowClass: "hover:border-secondary/20" },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
          >
            <StatCard {...item} />
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card rounded-2xl p-6 border border-white/[0.06]"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Average Mastery</h2>
            <span className="text-2xl font-bold text-primary">{averageMastery}%</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${averageMastery}%` }}
              transition={{ delay: 0.4, duration: 1, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {stats.totalDecks} deck{stats.totalDecks !== 1 ? "s" : ""} · {stats.totalCards} total cards
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="glass-card rounded-2xl p-6 border border-white/[0.06]"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Retention Rate</h2>
            <span className="text-2xl font-bold text-secondary">{retentionRate}%</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${retentionRate}%` }}
              transition={{ delay: 0.5, duration: 1, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-secondary to-primary rounded-full"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {stats.masteredCards} mastered of {stats.totalCards} cards
          </p>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="glass-card rounded-2xl p-6 border border-white/[0.06]"
      >
        <h2 className="font-semibold text-foreground mb-6">Projected Retention Curve</h2>
        <div className="flex items-end gap-2 h-32">
          {retentionData.map((point, i) => (
            <div key={point.day} className="flex-1 flex flex-col items-center gap-1">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${point.retention}%` }}
                transition={{ delay: i * 0.07 + 0.5, duration: 0.5, ease: "easeOut" }}
                className="w-full rounded-t-lg bg-gradient-to-t from-primary/40 to-primary/80"
                style={{ maxHeight: "100%" }}
              />
              <span className="text-xs text-muted-foreground">{point.day}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Simulated Ebbinghaus forgetting curve with SM-2 spaced repetition
        </p>
      </motion.div>

      {stats.streakDays >= 1 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-6 glass-card rounded-2xl p-5 border border-amber-500/15 flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-amber-400">
              {stats.streakDays} Day Streak
            </p>
            <p className="text-xs text-muted-foreground">Keep it up — consistency is the key to mastery.</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
