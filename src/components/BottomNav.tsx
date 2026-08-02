import { motion } from "framer-motion";
import { Zap, Wifi, Gauge, History, ShieldAlert, Lock as LockIcon } from "lucide-react";
import { isPremiumTab } from "@/lib/edition";

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: "score", label: "Análise", icon: Gauge },
  { id: "intrusion", label: "Intrusão", icon: ShieldAlert },
  { id: "optimize", label: "Otimizar", icon: Zap },
  { id: "network", label: "Rede", icon: Wifi },
  { id: "history", label: "Histórico", icon: History },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border safe-area-pb z-50">
      <div className="flex items-center justify-around h-20 max-w-md mx-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          const locked = isPremiumTab(tab.id);

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="relative flex flex-col items-center justify-center w-full h-full"
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute top-1 w-12 h-12 gradient-primary rounded-2xl"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <div className="relative z-10">
                <Icon
                  className={`w-6 h-6 transition-colors duration-200 ${
                    isActive ? "text-primary-foreground" : "text-muted-foreground"
                  }`}
                />
                {locked && (
                  <span className="absolute -top-1 -right-2 bg-card border border-primary/40 rounded-full p-0.5">
                    <LockIcon className="w-2.5 h-2.5 text-primary" />
                  </span>
                )}
              </div>
              <span
                className={`text-xs mt-1 z-10 transition-colors duration-200 ${
                  isActive ? "text-primary font-medium" : "text-muted-foreground"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

