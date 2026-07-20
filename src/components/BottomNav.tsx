import { motion } from "framer-motion";
import { Shield, Zap, Lock, Wifi, Gauge, History } from "lucide-react";

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: "score", label: "Score", icon: Gauge },
  { id: "scan", label: "Scanner", icon: Shield },
  { id: "optimize", label: "Otimizar", icon: Zap },
  { id: "password", label: "Senhas", icon: Lock },
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
              <Icon
                className={`w-6 h-6 z-10 transition-colors duration-200 ${
                  isActive ? "text-primary-foreground" : "text-muted-foreground"
                }`}
              />
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
