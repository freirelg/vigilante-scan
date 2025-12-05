import { useState } from "react";
import { motion } from "framer-motion";
import { Cpu, HardDrive, Trash2, Zap, RefreshCw, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface OptimizationItem {
  id: string;
  name: string;
  icon: React.ReactNode;
  value: number;
  maxValue: number;
  unit: string;
  canOptimize: boolean;
  optimized: boolean;
}

export function DeviceOptimizer() {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [items, setItems] = useState<OptimizationItem[]>([
    {
      id: "ram",
      name: "Memória RAM",
      icon: <Cpu className="w-5 h-5" />,
      value: 2.8,
      maxValue: 4,
      unit: "GB",
      canOptimize: true,
      optimized: false,
    },
    {
      id: "storage",
      name: "Armazenamento",
      icon: <HardDrive className="w-5 h-5" />,
      value: 45,
      maxValue: 64,
      unit: "GB",
      canOptimize: true,
      optimized: false,
    },
    {
      id: "cache",
      name: "Cache do Sistema",
      icon: <Trash2 className="w-5 h-5" />,
      value: 1.2,
      maxValue: 5,
      unit: "GB",
      canOptimize: true,
      optimized: false,
    },
  ]);

  const [freedSpace, setFreedSpace] = useState(0);

  const getUsagePercentage = (item: OptimizationItem) => {
    return (item.value / item.maxValue) * 100;
  };

  const getUsageColor = (percentage: number) => {
    if (percentage > 80) return "bg-destructive";
    if (percentage > 60) return "bg-warning";
    return "bg-success";
  };

  const optimizeDevice = async () => {
    setIsOptimizing(true);
    
    // Simulate optimization
    for (let i = 0; i < items.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      setItems((prev) =>
        prev.map((item, index) => {
          if (index === i && item.canOptimize) {
            const reduction = item.id === "cache" ? item.value * 0.8 : item.value * 0.2;
            setFreedSpace((prev) => prev + reduction);
            return {
              ...item,
              value: item.value - reduction,
              optimized: true,
            };
          }
          return item;
        })
      );
    }
    
    setIsOptimizing(false);
  };

  const totalOptimized = items.filter((i) => i.optimized).length;

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <motion.div
        className="glass-card p-6 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <motion.div
          className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${
            totalOptimized === items.length ? "gradient-success glow-success" : "gradient-primary glow-primary"
          }`}
          animate={isOptimizing ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 0.5, repeat: isOptimizing ? Infinity : 0 }}
        >
          {totalOptimized === items.length ? (
            <CheckCircle className="w-10 h-10 text-success-foreground" />
          ) : (
            <Zap className="w-10 h-10 text-primary-foreground" />
          )}
        </motion.div>
        
        {freedSpace > 0 ? (
          <>
            <h3 className="text-2xl font-bold text-foreground mb-1">
              {freedSpace.toFixed(1)} GB
            </h3>
            <p className="text-muted-foreground">Espaço liberado</p>
          </>
        ) : (
          <>
            <h3 className="text-2xl font-bold text-foreground mb-1">
              Otimização Disponível
            </h3>
            <p className="text-muted-foreground">Libere memória e espaço</p>
          </>
        )}
      </motion.div>

      {/* Optimization Items */}
      <div className="space-y-4">
        {items.map((item, index) => {
          const percentage = getUsagePercentage(item);
          const colorClass = getUsageColor(percentage);
          
          return (
            <motion.div
              key={item.id}
              className="glass-card p-4"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="flex items-center gap-4 mb-3">
                <div className={`p-2 rounded-lg ${item.optimized ? "bg-success/20 text-success" : "bg-primary/20 text-primary"}`}>
                  {item.optimized ? <CheckCircle className="w-5 h-5" /> : item.icon}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.value.toFixed(1)} / {item.maxValue} {item.unit}
                  </p>
                </div>
                <span className={`text-sm font-mono ${item.optimized ? "text-success" : "text-muted-foreground"}`}>
                  {percentage.toFixed(0)}%
                </span>
              </div>
              
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className={`h-full ${item.optimized ? "bg-success" : colorClass}`}
                  initial={{ width: `${percentage}%` }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Action Button */}
      <Button
        onClick={optimizeDevice}
        disabled={isOptimizing || totalOptimized === items.length}
        size="xl"
        className="w-full"
        variant={totalOptimized === items.length ? "success" : "default"}
      >
        {isOptimizing ? (
          <>
            <RefreshCw className="w-5 h-5 animate-spin" />
            Otimizando...
          </>
        ) : totalOptimized === items.length ? (
          <>
            <CheckCircle className="w-5 h-5" />
            Dispositivo Otimizado
          </>
        ) : (
          <>
            <Zap className="w-5 h-5" />
            Otimizar Dispositivo
          </>
        )}
      </Button>
    </div>
  );
}
