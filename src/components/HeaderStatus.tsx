import { useEffect, useState } from "react";
import { Battery, BatteryCharging, BatteryLow, BatteryMedium, BatteryFull } from "lucide-react";

interface BatteryManager extends EventTarget {
  level: number;
  charging: boolean;
}

export const HeaderStatus = () => {
  const [now, setNow] = useState(new Date());
  const [level, setLevel] = useState<number | null>(null);
  const [charging, setCharging] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManager> };
    if (!nav.getBattery) {
      setSupported(false);
      return;
    }
    let battery: BatteryManager | null = null;
    const update = () => {
      if (!battery) return;
      setLevel(Math.round(battery.level * 100));
      setCharging(battery.charging);
    };
    nav.getBattery().then((b) => {
      battery = b;
      update();
      b.addEventListener("levelchange", update);
      b.addEventListener("chargingchange", update);
    });
    return () => {
      if (!battery) return;
      battery.removeEventListener("levelchange", update);
      battery.removeEventListener("chargingchange", update);
    };
  }, []);

  const time = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const date = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

  const BatteryIcon = charging
    ? BatteryCharging
    : level === null
    ? Battery
    : level > 75
    ? BatteryFull
    : level > 40
    ? BatteryMedium
    : level > 15
    ? Battery
    : BatteryLow;

  const batteryColor =
    level === null
      ? "text-white/60"
      : charging
      ? "text-success"
      : level > 40
      ? "text-white"
      : level > 15
      ? "text-warning"
      : "text-destructive";

  return (
    <div className="flex flex-col items-end gap-1 text-right">
      <div className="leading-none">
        <div className="font-display font-semibold text-sm text-white tabular-nums">{time}</div>
        <div className="text-[10px] text-white/60 tabular-nums mt-0.5">{date}</div>
      </div>
      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
        <BatteryIcon className={`w-3.5 h-3.5 ${batteryColor}`} />
        <span className={`text-[10px] font-medium tabular-nums ${batteryColor}`}>
          {supported && level !== null ? `${level}%` : "—"}
        </span>
      </div>
    </div>
  );
};
