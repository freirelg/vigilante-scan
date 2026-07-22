import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Download, Smartphone, Share, Plus, CheckCircle, Monitor, Apple } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Detect device type
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    setIsAndroid(/android/.test(userAgent));

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
      toast.success("App instalado com sucesso!");
    }

    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="space-y-6">
        <motion.div
          className="glass-card p-8 text-center"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.div
            className="w-24 h-24 mx-auto rounded-full gradient-success flex items-center justify-center mb-6 glow-success"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
          >
            <CheckCircle className="w-12 h-12 text-success-foreground" />
          </motion.div>
          <h2 className="text-2xl font-bold text-foreground mb-2">App Instalado!</h2>
          <p className="text-muted-foreground">
            O SecureGuard está instalado no seu dispositivo
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <motion.div
        className="glass-card p-8 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <motion.div
          className="w-24 h-24 mx-auto rounded-full gradient-primary flex items-center justify-center mb-6 glow-primary"
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Smartphone className="w-12 h-12 text-primary-foreground" />
        </motion.div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Instale o SecureGuard
        </h2>
        <p className="text-muted-foreground">
          Tenha acesso rápido e offline às ferramentas de segurança
        </p>
      </motion.div>

      {/* Install Methods */}
      <div className="space-y-4">
        {/* Android / Chrome */}
        {(deferredPrompt || isAndroid) && (
          <motion.div
            className="glass-card p-6"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-xl bg-success/20">
                <Download className="w-6 h-6 text-success" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Android / Chrome</h3>
                <p className="text-sm text-muted-foreground">Instalação direta</p>
              </div>
            </div>
            <Button onClick={handleInstall} size="lg" className="w-full">
              <Download className="w-5 h-5" />
              Instalar Agora
            </Button>
          </motion.div>
        )}

        {/* iOS Instructions */}
        {isIOS && (
          <motion.div
            className="glass-card p-6"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-xl bg-primary/20">
                <Apple className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">iPhone / iPad</h3>
                <p className="text-sm text-muted-foreground">Via Safari</p>
              </div>
            </div>
            
            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                  1
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-foreground">Toque em</span>
                  <Share className="w-5 h-5 text-primary" />
                  <span className="text-sm text-foreground">(Compartilhar)</span>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                  2
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-foreground">Toque em</span>
                  <Plus className="w-5 h-5 text-primary" />
                  <span className="text-sm text-foreground">"Adicionar à Tela de Início"</span>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                  3
                </div>
                <span className="text-sm text-foreground">Confirme tocando em "Adicionar"</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Desktop Instructions */}
        {!isIOS && !isAndroid && (
          <motion.div
            className="glass-card p-6"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-xl bg-secondary">
                <Monitor className="w-6 h-6 text-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Desktop</h3>
                <p className="text-sm text-muted-foreground">Chrome / Edge</p>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Clique no ícone de instalação na barra de endereços do navegador ou acesse este site pelo celular para a melhor experiência.
            </p>
          </motion.div>
        )}
      </div>

      {/* Features */}
      <motion.div
        className="glass-card p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h4 className="font-semibold text-foreground mb-4">Benefícios da Instalação</h4>
        <ul className="space-y-3">
          <li className="flex items-center gap-3 text-sm text-muted-foreground">
            <CheckCircle className="w-5 h-5 text-success" />
            Acesso rápido pela tela inicial
          </li>
          <li className="flex items-center gap-3 text-sm text-muted-foreground">
            <CheckCircle className="w-5 h-5 text-success" />
            Funciona mesmo sem internet
          </li>
          <li className="flex items-center gap-3 text-sm text-muted-foreground">
            <CheckCircle className="w-5 h-5 text-success" />
            Experiência em tela cheia
          </li>
          <li className="flex items-center gap-3 text-sm text-muted-foreground">
            <CheckCircle className="w-5 h-5 text-success" />
            Não ocupa muito espaço
          </li>
        </ul>
      </motion.div>
    </div>
  );
}
