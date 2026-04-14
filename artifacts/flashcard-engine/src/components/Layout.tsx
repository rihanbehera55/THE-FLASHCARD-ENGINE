import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@/store/useStore";

const navItems = [
  { path: "/", label: "Upload" },
  { path: "/library", label: "Library" },
  { path: "/progress", label: "Progress" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, isGuest } = useStore();
  const isPracticePage = location.startsWith("/practice");

  return (
    <div className="min-h-screen flex flex-col">
      {!isPracticePage && (
        <header className="sticky top-0 z-50 glass border-b border-white/[0.06]">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/">
              <span className="text-gradient-cyan font-bold text-lg tracking-tight cursor-pointer">
                FlashCard Engine
              </span>
            </Link>
            <nav className="flex items-center gap-1">
              {navItems.map((item) => (
                <Link key={item.path} href={item.path}>
                  <span
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all cursor-pointer ${
                      location === item.path
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              ))}
              {user || isGuest ? (
                <Link href="/auth">
                  <span className="ml-2 px-3 py-1.5 rounded-md text-sm font-medium border border-white/10 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all cursor-pointer">
                    {user ? user.name : "Sign In"}
                  </span>
                </Link>
              ) : (
                <Link href="/auth">
                  <span className="ml-2 px-3 py-1.5 rounded-md text-sm font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all cursor-pointer">
                    Sign In
                  </span>
                </Link>
              )}
            </nav>
          </div>
        </header>
      )}

      {isGuest && !isPracticePage && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center text-xs text-amber-400">
          Guest mode — your data will be lost when you close this tab.{" "}
          <Link href="/auth">
            <span className="underline cursor-pointer hover:text-amber-300">Sign in to save</span>
          </Link>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.main
          key={location}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="flex-1"
        >
          {children}
        </motion.main>
      </AnimatePresence>
    </div>
  );
}
