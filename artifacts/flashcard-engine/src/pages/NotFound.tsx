import { Link } from "wouter";
import { motion } from "framer-motion";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <p className="text-8xl font-extrabold text-gradient-cyan mb-4">404</p>
        <p className="text-xl font-semibold text-foreground mb-2">Page not found</p>
        <p className="text-muted-foreground mb-8">This page doesn't exist in our system.</p>
        <Link href="/">
          <span className="px-6 py-3 rounded-xl bg-primary/10 text-primary border border-primary/25 font-medium hover:bg-primary/20 transition-all cursor-pointer">
            Go Home
          </span>
        </Link>
      </motion.div>
    </div>
  );
}
