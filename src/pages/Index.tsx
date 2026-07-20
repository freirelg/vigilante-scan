import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SecurityScanner } from "@/components/SecurityScanner";
import { DeviceOptimizer } from "@/components/DeviceOptimizer";
import { PasswordAnalyzer } from "@/components/PasswordAnalyzer";
import { NetworkSecurity } from "@/components/NetworkSecurity";
import { VulnerabilityScore } from "@/components/VulnerabilityScore";
import { ScanHistory } from "@/components/ScanHistory";
import { BottomNav } from "@/components/BottomNav";
import { InstallPrompt } from "@/components/InstallPrompt";
import { SplashScreen } from "@/components/SplashScreen";
import logo from "@/assets/logo.png";

const Index = () => {
  const [activeTab, setActiveTab] = useState("score");

  const renderContent = () => {
    switch (activeTab) {
      case "score":
        return <VulnerabilityScore />;
      case "scan":
        return <SecurityScanner />;
      case "optimize":
        return <DeviceOptimizer />;
      case "password":
        return <PasswordAnalyzer />;
      case "network":
        return <NetworkSecurity />;
      case "history":
        return <ScanHistory />;
      case "install":
        return <InstallPrompt />;
      default:
        return <VulnerabilityScore />;
    }
  };

  const getTitle = () => {
    switch (activeTab) {
      case "score":
        return "Score de Vulnerabilidade";
      case "scan":
        return "Scanner de Segurança";
      case "optimize":
        return "Otimização";
      case "password":
        return "Analisador de Senhas";
      case "network":
        return "Segurança de Rede";
      case "history":
        return "Histórico de Scans";
      case "install":
        return "Instalar App";
      default:
        return "Freirenet-SecureGuard";
    }
  };

  return (
    <>
      <SplashScreen />
      <div className="min-h-screen bg-background">
        {/* Background Glow */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-accent/5 rounded-full blur-3xl" />
        </div>

        {/* Header */}
        <header className="sticky top-0 z-40 bg-background/70 backdrop-blur-xl border-b border-border/60">
          <div className="flex items-center justify-between px-4 h-16 max-w-md mx-auto">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/30 blur-lg rounded-full" />
                <img
                  src={logo}
                  alt="Freirenet-SecureGuard"
                  width={40}
                  height={40}
                  className="relative w-10 h-10 drop-shadow-[0_0_8px_hsl(var(--primary)/0.4)]"
                />
              </div>
              <div className="leading-tight">
                <h1 className="font-display font-bold text-foreground tracking-tight">
                  Freirenet
                </h1>
                <p className="text-[10px] uppercase tracking-[0.18em] text-primary/80 font-medium">
                  SecureGuard
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs text-success font-medium">Protegido</span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="px-4 py-6 pb-28 max-w-md mx-auto">
          {/* Page Title */}
          <motion.h2
            key={activeTab}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-2xl font-bold text-foreground mb-6 tracking-tight"
          >
            {getTitle()}
        </motion.h2>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
