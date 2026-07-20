import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Database, Cookie, Trash2, RefreshCw, ShieldCheck, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  listIndexedDbs, deleteIndexedDb,
  getCookieInfo, deleteCookie, clearNonEssentialCookies,
  formatBytes,
  type IdbDbInfo, type CookieInfo,
} from "@/lib/deviceStorage";

export function StorageGranular() {
  const [idbSupported, setIdbSupported] = useState<boolean>(true);
  const [dbs, setDbs] = useState<IdbDbInfo[]>([]);
  const [cookies, setCookies] = useState<CookieInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyName, setBusyName] = useState<string | null>(null);
  const [showCookieList, setShowCookieList] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const idb = await listIndexedDbs();
    setIdbSupported(idb.supported);
    setDbs(idb.dbs);
    setCookies(getCookieInfo());
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const onDeleteDb = async (name: string) => {
    setBusyName(name);
    const ok = await deleteIndexedDb(name);
    setBusyName(null);
    if (ok) {
      toast.success(`Base "${name}" removida`);
      refresh();
    } else {
      toast.error(`Falha ao remover "${name}" — pode estar em uso`);
    }
  };

  const onDeleteCookie = (name: string) => {
    deleteCookie(name);
    toast.success(`Cookie "${name}" removido`);
    refresh();
  };

  const onClearNonEssential = () => {
    const { removed, freed } = clearNonEssentialCookies();
    if (removed === 0) {
      toast.info("Nenhum cookie não-essencial encontrado");
    } else {
      toast.success(`${removed} cookie(s) removido(s) — ${formatBytes(freed)} liberados`);
    }
    refresh();
  };

  return (
    <div className="space-y-3">
      {/* IndexedDB */}
      <motion.div className="glass-card p-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-start gap-3 mb-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/30 text-primary">
            <Database className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-foreground">IndexedDB</p>
              <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                {dbs.length} base(s)
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground/80 mt-1">
              Bases locais criadas por este site. Remova individualmente.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={refresh} disabled={loading} className="h-8 w-8">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {!idbSupported ? (
          <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
            API <code>indexedDB.databases()</code> não suportada neste navegador (Safari/Firefox).
          </p>
        ) : dbs.length === 0 ? (
          <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-success" />
            Nenhuma base IndexedDB encontrada.
          </p>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {dbs.map((db) => (
                <motion.div
                  key={db.name}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  className="flex items-center justify-between gap-3 bg-muted/30 hover:bg-muted/50 rounded-lg px-3 py-2 border border-border/40"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-mono text-foreground truncate">{db.name}</p>
                    <p className="text-[10px] text-muted-foreground">versão {db.version ?? "—"}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteDb(db.name)}
                    disabled={busyName === db.name}
                    className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    {busyName === db.name ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    <span className="ml-1 text-xs">Excluir</span>
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* Cookies */}
      <motion.div className="glass-card p-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="flex items-start gap-3 mb-3">
          <div className="p-2 rounded-lg bg-warning/10 border border-warning/30 text-warning">
            <Cookie className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-foreground">Cookies (1ª parte)</p>
              <Badge variant="outline" className="text-[10px] border-warning/40 text-warning">
                {cookies?.count ?? 0} • {cookies ? formatBytes(cookies.totalSize) : "—"}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground/80 mt-1">
              Apenas cookies acessíveis via JS (sem <code>HttpOnly</code>).
            </p>
          </div>
        </div>

        {cookies && cookies.count > 0 && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-success/10 border border-success/30 rounded-lg p-2">
              <p className="text-[10px] text-muted-foreground">Essenciais</p>
              <p className="text-sm font-semibold text-success flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> {cookies.essentialCount}
              </p>
            </div>
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-2">
              <p className="text-[10px] text-muted-foreground">Não-essenciais</p>
              <p className="text-sm font-semibold text-warning flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {cookies.nonEssentialCount} • {formatBytes(cookies.nonEssentialSize)}
              </p>
            </div>
          </div>
        )}

        {cookies && cookies.count === 0 ? (
          <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-success" />
            Nenhum cookie acessível encontrado.
          </p>
        ) : (
          <>
            <div className="flex gap-2 mb-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setShowCookieList((s) => !s)}
                disabled={!cookies || cookies.count === 0}
              >
                {showCookieList ? "Ocultar" : "Ver"} lista
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-warning border-warning/40 hover:bg-warning/10"
                onClick={onClearNonEssential}
                disabled={!cookies || cookies.nonEssentialCount === 0}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Limpar não-essenciais
              </Button>
            </div>

            <AnimatePresence>
              {showCookieList && cookies && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-1.5 overflow-hidden"
                >
                  {cookies.items.map((c) => (
                    <div
                      key={c.name}
                      className="flex items-center justify-between gap-2 bg-muted/30 rounded-lg px-3 py-1.5 border border-border/40"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-mono text-foreground truncate">{c.name}</p>
                          {c.essential && (
                            <Badge variant="outline" className="text-[9px] border-success/40 text-success h-4 px-1">
                              essencial
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{formatBytes(c.size)}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => onDeleteCookie(c.name)}
                        disabled={c.essential}
                        title={c.essential ? "Cookie essencial — não removido" : "Remover"}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        <p className="text-[10px] text-muted-foreground/70 mt-3 leading-relaxed">
          <strong>Nota:</strong> cookies <code>HttpOnly</code> (sessão do servidor) não são
          visíveis via JavaScript e não aparecem aqui — por design de segurança.
        </p>
      </motion.div>
    </div>
  );
}
