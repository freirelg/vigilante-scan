import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Sun, Moon, Leaf, Video, Fullscreen, EyeOff, Play, Pause, Battery, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  getWakeLockStatus, requestWakeLock, releaseWakeLock, subscribeWakeLock,
  getPowerSaverState, setPowerSaverMode, subscribePowerSaverState,
  type WakeLockStatus, type PowerSaverState, type PowerSaverMode,
} from "@/lib/powerSaver";

export function PowerCards() {
  const [wl, setWl] = useState<WakeLockStatus>(() => getWakeLockStatus());
  const [ps, setPs] = useState<PowerSaverState>(() => getPowerSaverState());

  const refreshWl = useCallback(() => setWl(getWakeLockStatus()), []);
  const refreshPs = useCallback(() => setPs(getPowerSaverState()), []);

  useEffect(() => {
    const offWl = subscribeWakeLock(refreshWl);
    const offPs = subscribePowerSaverState(refreshPs);
    const onVis = () => refreshWl();
    document.addEventListener("visibilitychange", onVis);
    document.addEventListener("fullscreenchange", refreshWl);
    // Poll for media state (no reliable global event)
    const id = window.setInterval(refreshWl, 2000);
    return () => {
      offWl(); offPs();
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("fullscreenchange", refreshWl);
      clearInterval(id);
    };
  }, [refreshWl, refreshPs]);

  const onToggleLock = async () => {
    if (wl.held) {
      localStorage.removeItem("wake-lock-desired");
      await releaseWakeLock();
      toast.success("A tela pode apagar normalmente");
    } else {
      const r = await requestWakeLock();
      if (r.ok) {
        localStorage.setItem("wake-lock-desired", "1");
        toast.success("A tela vai ficar ligada enquanto o app estiver aberto");
      } else {
        toast.error(r.error ?? "Falha ao ativar");
      }
    }
    refreshWl();
  };

  const onMode = (m: PowerSaverMode) => {
    setPowerSaverMode(m);
    toast.success(
      m === "on" ? "Modo economia ativado" :
      m === "off" ? "Modo economia desativado" :
      "Modo automático — liga sozinho com bateria baixa"
    );
  };

  const tone = (t: "success" | "warning" | "destructive") =>
    t === "success" ? "text-success bg-success/10 border-success/30"
    : t === "warning" ? "text-warning bg-warning/10 border-warning/30"
    : "text-destructive bg-destructive/10 border-destructive/30";

  const wlTone: "success" | "warning" | "destructive" =
    !wl.supported ? "warning"
    : wl.held ? "success"
    : (wl.playingMedia || wl.fullscreen) ? "warning"
    : "success";

  const wlLabel =
    !wl.supported ? "Não disponível"
    : wl.held ? "Tela sempre ligada"
    : wl.playingMedia ? "Vídeo segurando a tela"
    : wl.fullscreen ? "Tela cheia"
    : "Normal";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {/* WAKE LOCK */}
      <motion.div className="glass-card p-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-start gap-3 mb-3">
          <div className={`p-2 rounded-lg border ${tone(wlTone)}`}>
            {wl.held ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-foreground">Tela sempre ligada</p>
              <Badge variant="outline" className={`text-[10px] ${tone(wlTone)}`}>
                {wlLabel}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground/80 mt-1">
              O que está impedindo a tela de apagar agora.
            </p>
          </div>
        </div>

        <div className="space-y-1.5 mb-3">
          <SignalRow icon={<EyeOff className="w-3.5 h-3.5" />} label="App em segundo plano" val={wl.visibilityBlocked} invert />
          <SignalRow icon={<Video className="w-3.5 h-3.5" />} label="Vídeo ou áudio tocando" val={wl.playingMedia} />
          <SignalRow icon={<Fullscreen className="w-3.5 h-3.5" />} label="Tela cheia" val={wl.fullscreen} />
          <SignalRow icon={<Sun className="w-3.5 h-3.5" />} label="Tela travada ligada" val={wl.held} />
        </div>

        {wl.reason && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 mb-3 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-primary mt-0.5" />
            <p className="text-[11px] text-muted-foreground">{wl.reason}</p>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onToggleLock}
          disabled={!wl.supported || wl.visibilityBlocked}
        >
          {wl.held ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {wl.held ? "Liberar tela" : "Manter tela ligada"}
        </Button>

        {!wl.supported && (
          <p className="text-[10px] text-muted-foreground/70 mt-2">
            Este navegador não permite manter a tela ligada.
          </p>
        )}
      </motion.div>

      {/* SMART POWER SAVER */}
      <motion.div
        className="glass-card p-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <div className="flex items-start gap-3 mb-3">
          <div className={`p-2 rounded-lg border ${tone(ps.active ? "success" : "warning")}`}>
            <Leaf className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-foreground">Economia inteligente</p>
              <Badge variant="outline" className={`text-[10px] ${tone(ps.active ? "success" : "warning")}`}>
                {ps.active ? "Ativa" : "Inativa"}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground/80 mt-1">
              Diminui animações para gastar menos bateria.
            </p>
          </div>
        </div>

        <div className="space-y-1 text-[11px] mb-3">
          <div className="flex items-center justify-between bg-muted/30 rounded px-2 py-1 border border-border/30">
            <span className="text-muted-foreground flex items-center gap-1">
              <Battery className="w-3.5 h-3.5" /> Bateria
            </span>
            <span className="font-mono text-foreground">
              {ps.batteryLevel != null ? `${ps.batteryLevel}%` : "—"}
              {ps.charging ? " ⚡" : ""}
            </span>
          </div>
          <div className="flex items-center justify-between bg-muted/30 rounded px-2 py-1 border border-border/30">
            <span className="text-muted-foreground">Economia de dados</span>
            <span className={"font-mono " + (ps.saveDataHint ? "text-warning" : "text-foreground")}>
              {ps.saveDataHint ? "sim" : "não"}
            </span>
          </div>
          <div className="flex items-center justify-between bg-muted/30 rounded px-2 py-1 border border-border/30">
            <span className="text-muted-foreground">Menos animação</span>
            <span className={"font-mono " + (ps.reducedMotion ? "text-warning" : "text-foreground")}>
              {ps.reducedMotion ? "sim" : "não"}
            </span>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground mb-2">
          Modo: <strong className="text-foreground">{ps.mode === "auto" ? "AUTOMÁTICO" : ps.mode === "on" ? "LIGADO" : "DESLIGADO"}</strong> — {ps.reason}
        </p>

        <div className="grid grid-cols-3 gap-1.5">
          <Button
            size="sm"
            variant={ps.mode === "auto" ? "default" : "outline"}
            onClick={() => onMode("auto")}
            className="text-xs h-8"
          >
            Auto
          </Button>
          <Button
            size="sm"
            variant={ps.mode === "on" ? "default" : "outline"}
            onClick={() => onMode("on")}
            className="text-xs h-8"
          >
            Ligar
          </Button>
          <Button
            size="sm"
            variant={ps.mode === "off" ? "default" : "outline"}
            onClick={() => onMode("off")}
            className="text-xs h-8"
          >
            Desligar
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground/70 mt-3 leading-relaxed">
          No modo <strong>automático</strong>, a economia liga sozinha quando a bateria cai de 20%, quando o celular
          está economizando dados ou quando você pediu menos animação nas configurações.
        </p>
      </motion.div>
    </div>
  );
}

function SignalRow({
  icon, label, val, invert,
}: { icon: React.ReactNode; label: string; val: boolean; invert?: boolean }) {
  const bad = invert ? val : val;
  const _ = invert;
  return (
    <div className="flex items-center justify-between bg-muted/20 rounded px-2 py-1 border border-border/30 text-[11px]">
      <span className="text-muted-foreground flex items-center gap-1.5">{icon}{label}</span>
      <span className={"font-mono " + (val ? "text-warning" : "text-muted-foreground")}>
        {val ? "sim" : "não"}
      </span>
    </div>
  );
}
