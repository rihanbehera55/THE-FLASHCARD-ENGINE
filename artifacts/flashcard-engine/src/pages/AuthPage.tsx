import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useStore } from "@/store/useStore";
import { useCreateUser } from "@workspace/api-client-react";

export default function AuthPage() {
  const [, navigate] = useLocation();
  const { setUser, setGuest } = useStore();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const createUser = useCreateUser();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await createUser.mutateAsync({
        data: {
          email,
          name: tab === "signup" ? name : email.split("@")[0],
          password,
        },
      });
      setUser({
        id: result.id,
        email: result.email,
        name: result.name,
        streakDays: result.streakDays,
      });
      navigate("/library");
    } catch {
      setError("Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleSkip() {
    setGuest();
    navigate("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 grid-bg">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[300px] rounded-full bg-secondary/5 blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gradient-cyan mb-2">
            FlashCard Engine
          </h1>
          <p className="text-muted-foreground text-sm">
            AI-powered spaced repetition for serious learners
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSkip}
          className="w-full mb-6 py-3 rounded-xl border border-dashed border-primary/30 text-primary/80 hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all text-sm font-medium"
        >
          Skip — Continue as Guest
        </motion.button>

        <div className="glass-card rounded-2xl p-6 neon-border">
          <div className="flex rounded-xl bg-muted/50 p-1 mb-6">
            {(["signin", "signup"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === t
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "signin" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === "signup" && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  className="w-full bg-input border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/50"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-input border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/50"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-input border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/50"
              />
            </div>

            {error && (
              <p className="text-destructive text-sm text-center">{error}</p>
            )}

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all glow-cyan disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Loading..." : tab === "signin" ? "Sign In" : "Create Account"}
            </motion.button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-4">
            By continuing, you agree to our Terms of Service.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
