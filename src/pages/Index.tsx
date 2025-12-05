import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, ShieldCheck } from "lucide-react";
import { SecurityScanner } from "@/components/SecurityScanner";
import { DeviceOptimizer } from "@/components/DeviceOptimizer";
import { PasswordAnalyzer } from "@/components/PasswordAnalyzer";
import { BottomNav } from "@/components/BottomNav";
import { InstallPrompt } from "@/components/InstallPrompt";

const Index = () => {
  const [activeTab, setActiveTab] = useState("scan");

  const renderContent = () => {
    switch (activeTab) {
      case "scan":
        return <SecurityScanner />;
      case "optimize":
        return <DeviceOptimizer />;
      case "password":
        return <PasswordAnalyzer />;
      case "install":
        return <InstallPrompt />;
      default:
        return <SecurityScanner />;
    }
  };

  const getTitle = () => {
    switch (activeTab) {
      case "scan":
        return "Scanner de Segurança";
      case "optimize":
        return "Otimização";
      case "password":
        return "Analisador de Senhas";
      case "install":
        return "Instalar App";
      default:
        return "Freirenet-SecureGuard";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Background Glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-accent/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between px-4 h-16 max-w-md mx-auto">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl gradient-primary">
              <ShieldCheck className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-foreground">Freirenet</h1>
              <p className="text-xs text-muted-foreground">SecureGuard</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10">
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
          className="text-2xl font-bold text-foreground mb-6"
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
