import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logo from "@/assets/logo.png";

export function SplashScreen() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    return !sessionStorage.getItem("freirenet_splash_seen");
  });

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      sessionStorage.setItem("freirenet_splash_seen", "1");
      setVisible(false);
    }, 1800);
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background"
        >
          {/* Ambient glows */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-accent/15 rounded-full blur-3xl" />
          </div>

          <motion.div
            initial={{ scale: 0.6, opacity: 0, rotate: -10 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 14 }}
            className="relative"
          >
            {/* pulse ring */}
            <div className="absolute inset-0 rounded-3xl bg-primary/20 blur-2xl animate-pulse" />
            <img
              src={logo}
              alt="Freirenet-SecureGuard"
              width={128}
              height={128}
              className="relative w-32 h-32 drop-shadow-[0_0_30px_hsl(var(--primary)/0.5)]"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="mt-8 text-center"
          >
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
              Freirenet
            </h1>
            <p className="mt-1 text-sm font-medium text-primary tracking-widest uppercase">
              SecureGuard
            </p>
            <p className="mt-4 text-xs text-muted-foreground max-w-[260px] mx-auto leading-relaxed">
              Inteligência em Segurança Digital na Palma da Sua Mão
            </p>
          </motion.div>

          {/* loading bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-10 h-0.5 w-40 overflow-hidden rounded-full bg-muted"
          >
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              className="h-full w-1/2 gradient-primary rounded-full"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
