import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";


import { IntrusionDetection } from "@/components/IntrusionDetection";
import { DeviceOptimizer } from "@/components/DeviceOptimizer";
import { PasswordAnalyzer } from "@/components/PasswordAnalyzer";
import { NetworkSecurity } from "@/components/NetworkSecurity";
import { VulnerabilityScore } from "@/components/VulnerabilityScore";
import { ScanHistory } from "@/components/ScanHistory";
import { BottomNav } from "@/components/BottomNav";
import { InstallPrompt } from "@/components/InstallPrompt";
import { InstallBanner } from "@/components/InstallBanner";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { SplashScreen } from "@/components/SplashScreen";
import { HeaderStatus } from "@/components/HeaderStatus";
import { UpgradeBlock } from "@/components/UpgradeBlock";
import { isPremiumTab } from "@/lib/edition";
import { startBehaviorMonitor } from "@/lib/behavioralSignals";
import logoAsset from "@/assets/freirenet-logo.png.asset.json";

const Index = () => {
  const [activeTab, setActiveTab] = useState("score");

  useEffect(() => {
    startBehaviorMonitor();
  }, []);

  const premiumLabel: Record<string, string> = {
    intrusion: "Detecção de Intrusão",
    optimize: "Otimização do Dispositivo",
    password: "Análise avançada de Senhas",
    network: "Segurança de Rede avançada",
  };

  const renderContent = () => {
    if (isPremiumTab(activeTab)) {
      return (
        <UpgradeBlock reason="premium" featureName={premiumLabel[activeTab]} />
      );
    }
    switch (activeTab) {
      case "score":
        return <VulnerabilityScore />;
      case "intrusion":
        return <IntrusionDetection />;
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
      case "intrusion":
        return "Detecção de Intrusão";
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
        <header className="sticky top-0 z-40 border-b border-primary/10 overflow-hidden">
          {/* Circuit pattern background */}
          <div className="absolute inset-0 bg-[#0a1628]">
            <div
              className="absolute inset-0 opacity-[0.15]"
              style={{
                backgroundImage: `
                  linear-gradient(hsl(var(--primary) / 0.4) 1px, transparent 1px),
                  linear-gradient(90deg, hsl(var(--primary) / 0.4) 1px, transparent 1px),
                  radial-gradient(circle at 20% 30%, hsl(var(--primary) / 0.5) 1.5px, transparent 2px),
                  radial-gradient(circle at 70% 60%, hsl(var(--accent) / 0.5) 1.5px, transparent 2px),
                  radial-gradient(circle at 85% 20%, hsl(var(--primary) / 0.5) 1.5px, transparent 2px)
                `,
                backgroundSize: "28px 28px, 28px 28px, 120px 120px, 140px 140px, 100px 100px",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a1628]/80 via-transparent to-[#0a1628]/80" />
          </div>

          <div className="relative flex items-center justify-between px-4 h-20 max-w-md mx-auto">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/40 blur-xl rounded-full" />
                <img
                  src={logoAsset.url}
                  alt="FreireNet SecureGuard"
                  width={48}
                  height={48}
                  className="relative w-12 h-12 drop-shadow-[0_0_10px_hsl(var(--primary)/0.6)]"
                />
              </div>
              <div className="leading-tight">
                <h1 className="font-display font-bold text-xl text-white tracking-tight">
                  FreireNet
                </h1>
                <p className="text-xs text-white/60 font-medium tracking-wide">
                  Scan Security
                </p>
              </div>
            </div>

            <HeaderStatus />
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
        <InstallBanner />
        <UpdatePrompt />

      </div>
    </>
  );
};

export default Index;
