import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  applyPwaUpdate,
  dismissPwaUpdate,
  subscribePwaUpdate,
  type PwaUpdateState,
} from "@/lib/pwaUpdate";

export function UpdatePrompt() {
  const currentVersion = "1.0.4"; // Versão atual hardcoded para exibição
  const latestVersion = "1.1.0";  // Versão detectada simulada/vinda do SW
  
  const [state, setState] = useState<PwaUpdateState>({
    needRefresh: false,
    offlineReady: false,
    updating: false,
    lastCheck: null,
  });

  useEffect(() => {
    const unsub = subscribePwaUpdate(setState);
    return () => {
      unsub();
    };
  }, []);

  return (
    <AnimatePresence>
      {state.needRefresh && (
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed top-3 left-3 right-3 z-[70] max-w-md mx-auto"
        >
          <div className="rounded-2xl border border-accent/30 bg-card/95 backdrop-blur-xl shadow-2xl p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-foreground leading-tight">
                Uma nova versão do sistema está disponível com melhorias de segurança.
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-[10px] text-primary font-medium">
                  Atual: v{currentVersion}
                </div>
                <div className="px-2 py-0.5 rounded bg-accent/20 border border-accent/30 text-[10px] text-accent font-bold animate-pulse">
                  Nova: v{latestVersion}
                </div>
              </div>
            </div>
            <Button
              size="sm"
              className="gap-1"
              disabled={state.updating}
              onClick={() => void applyPwaUpdate()}
            >
              <RefreshCw className={`w-4 h-4 ${state.updating ? "animate-spin" : ""}`} />
              {state.updating ? "Atualizando" : "Atualizar"}
            </Button>
            <button
              onClick={dismissPwaUpdate}
              aria-label="Fechar"
              className="p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
