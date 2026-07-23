import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, X, Share, Plus, Apple, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "freirenet_install_dismissed_at";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    // @ts-ignore
    window.navigator.standalone === true
  );
}

export function InstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua) && !/crios|fxios/.test(ua);
    setIsIos(ios);

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    const recentlyDismissed = dismissedAt && Date.now() - dismissedAt < DISMISS_TTL_MS;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      if (!recentlyDismissed) setVisible(true);
    };

    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    // iOS never fires beforeinstallprompt — show guide banner if not dismissed
    if (ios && !recentlyDismissed) {
      const t = setTimeout(() => setVisible(true), 1500);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onBeforeInstall);
        window.removeEventListener("appinstalled", onInstalled);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
    setShowIosGuide(false);
  };

  const install = async () => {
    if (isIos) {
      setShowIosGuide(true);
      return;
    }
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
  };

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-24 left-3 right-3 z-50 max-w-md mx-auto"
          >
            <div className="relative rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-xl shadow-2xl p-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground">
                  Instale o FreireNet
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {isIos
                    ? "Adicione à tela de início do iPhone"
                    : "Acesso rápido pelo ícone do celular"}
                </div>
              </div>
              <Button size="sm" onClick={install} className="gap-1">
                <Download className="w-4 h-4" />
                Instalar
              </Button>
              <button
                onClick={dismiss}
                aria-label="Fechar"
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showIosGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowIosGuide(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-5"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Apple className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">
                    Instalar no iPhone / iPad
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Abra este site no Safari
                  </div>
                </div>
                <button
                  onClick={() => setShowIosGuide(false)}
                  className="ml-auto p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <ol className="space-y-3">
                <li className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                  <span className="w-7 h-7 rounded-full bg-primary/20 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span className="text-sm text-foreground flex items-center gap-1.5">
                    Toque em <Share className="w-4 h-4 text-primary" /> Compartilhar
                  </span>
                </li>
                <li className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                  <span className="w-7 h-7 rounded-full bg-primary/20 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span className="text-sm text-foreground flex items-center gap-1.5">
                    Escolha <Plus className="w-4 h-4 text-primary" /> "Adicionar à Tela de Início"
                  </span>
                </li>
                <li className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                  <span className="w-7 h-7 rounded-full bg-primary/20 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                    3
                  </span>
                  <span className="text-sm text-foreground">
                    Confirme em "Adicionar" — o ícone do escudo aparece na tela.
                  </span>
                </li>
              </ol>

              <Button className="w-full mt-4" onClick={dismiss}>
                Entendi
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
