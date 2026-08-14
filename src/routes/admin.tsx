import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Download,
  LogOut,
  Plus,
  Save,
  Trash2,
  Loader2,
  Lock,
  Calendar,
  Gift,
  Users,
  CheckCircle2,
  AlertCircle,
  Filter,
  CalendarDays,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import {
  adminLogin,
  adminListAll,
  adminUpsertPrize,
  adminDeletePrize,
  adminSyncAllPrizes,
  adminUploadIcon,
  adminDeleteParticipant,
} from "@/lib/slot.functions";
import { SlotIcon, ICON_KEYS } from "@/components/slot/SlotIcon";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Painel Admin — Conexão VIP" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

interface Prize {
  id: string;
  name: string;
  icon: string;
  total_quantity: number;
  remaining_quantity: number;
  daily_limit?: number;
  date_quotas?: Record<string, number>;
  effective_limit_today?: number;
  won_today?: number;
  daily_remaining?: number | null;
  won_by_date?: Record<string, number>;
  weight: number;
  active: boolean;
  created_at?: string;
}

interface Participant {
  id: string;
  full_name: string;
  whatsapp: string;
  city: string;
  is_client?: boolean;
  prize_name: string | null;
  redemption_code: string | null;
  won: boolean;
  created_at: string;
}

const PIN_KEY = "vip_admin_pin";

// O ciclo do dia do evento vai de 02:00 até 01:59:59 do dia seguinte
const DAY_CYCLE_OFFSET_MS = 2 * 60 * 60 * 1000;

function getEventDateKey(dateOrIso: string | Date = new Date()): string {
  const d = typeof dateOrIso === "string" ? new Date(dateOrIso) : dateOrIso;
  const shifted = new Date(d.getTime() - DAY_CYCLE_OFFSET_MS);
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(shifted); // Retorna YYYY-MM-DD
  } catch {
    return shifted.toISOString().slice(0, 10);
  }
}

function formatBRDateFromKey(dateKey: string) {
  try {
    const [year, month, day] = dateKey.split("-");
    if (year && month && day) {
      return `${day}/${month}/${year}`;
    }
    return dateKey;
  } catch {
    return dateKey;
  }
}

function formatBRDate(isoStringOrDate: string | Date) {
  try {
    const d = typeof isoStringOrDate === "string" ? new Date(isoStringOrDate) : isoStringOrDate;
    const shifted = new Date(d.getTime() - DAY_CYCLE_OFFSET_MS);
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(shifted);
  } catch {
    return typeof isoStringOrDate === "string" ? isoStringOrDate.slice(0, 10) : "";
  }
}

function getTodayFormatted() {
  return formatBRDate(new Date());
}

function Admin() {
  const [pin, setPin] = useState<string>("");
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const login = useServerFn(adminLogin);

  useEffect(() => {
    const stored = sessionStorage.getItem(PIN_KEY);
    if (stored) {
      login({ data: { pin: stored } })
        .then(() => {
          setPin(stored);
          setAuthed(true);
        })
        .catch(() => sessionStorage.removeItem(PIN_KEY));
    }
  }, [login]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login({ data: { pin } });
      sessionStorage.setItem(PIN_KEY, pin);
      setAuthed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PIN inválido");
    } finally {
      setLoading(false);
    }
  }

  if (!authed) {
    return (
      <div className="bg-kiosk grid min-h-screen place-items-center px-6">
        <form
          onSubmit={submit}
          className="w-full max-w-sm rounded-3xl border border-border bg-card/70 p-8 backdrop-blur"
        >
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/20 text-primary">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-black">Painel Administrativo</h1>
          <p className="mt-1 text-sm text-muted-foreground">Digite o PIN para continuar.</p>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="mt-6 w-full rounded-xl border-2 border-border bg-input px-4 py-3 text-center text-2xl tracking-widest focus:border-primary focus:outline-none"
            placeholder="••••"
            inputMode="numeric"
          />
          {error && <div className="mt-3 text-sm text-destructive">{error}</div>}
          <button className="btn-vip btn-vip-hover mt-6 w-full rounded-2xl py-3 text-base">
            {loading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "Entrar"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <AdminDashboard
      pin={pin}
      onLogout={() => {
        sessionStorage.removeItem(PIN_KEY);
        window.location.href = "/";
      }}
    />
  );
}

const LOCAL_STORAGE_PRIZES_KEY = "vip_custom_prizes_v4";

function AdminDashboard({ pin, onLogout }: { pin: string; onLogout: () => void }) {
  const listAll = useServerFn(adminListAll);
  const upsert = useServerFn(adminUpsertPrize);
  const syncAll = useServerFn(adminSyncAllPrizes);
  const del = useServerFn(adminDeletePrize);
  const delParticipant = useServerFn(adminDeleteParticipant);
  
  const [prizes, setPrizes] = useState<Prize[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(LOCAL_STORAGE_PRIZES_KEY);
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return [];
  });
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"prizes" | "participants">("prizes");

  const todayStr = getTodayFormatted();
  const todayKey = getEventDateKey(new Date());

  async function refresh(silent = false) {
    if (!silent) setLoading(true);
    try {
      // 1. Verifica se há cache local persistido
      const cached = typeof window !== "undefined" ? localStorage.getItem(LOCAL_STORAGE_PRIZES_KEY) : null;
      if (cached) {
        try {
          const localPrizes = JSON.parse(cached);
          if (Array.isArray(localPrizes) && localPrizes.length > 0) {
            setPrizes(localPrizes);
            // Sincroniza o worker em segundo plano com a versão local
            await syncAll({ data: { pin, prizes: localPrizes } }).catch(() => {});
          }
        } catch {}
      }

      const res = await listAll({ data: { pin } });
      
      if (!cached && res.prizes && res.prizes.length > 0) {
        localStorage.setItem(LOCAL_STORAGE_PRIZES_KEY, JSON.stringify(res.prizes));
        setPrizes(res.prizes as Prize[]);
      } else if (cached && res.prizes) {
        // Mescla quantidades consumidas no servidor mantendo as edições locais
        const localPrizes: Prize[] = JSON.parse(cached);
        const merged = localPrizes.map((lp) => {
          const sp: any = res.prizes.find((p: any) => p.id === lp.id);
          return sp
            ? {
                ...lp,
                won_today: sp.won_today,
                won_by_date: sp.won_by_date,
                remaining_quantity: sp.remaining_quantity,
                effective_limit_today: sp.effective_limit_today,
              }
            : lp;
        });
        setPrizes(merged);
        localStorage.setItem(LOCAL_STORAGE_PRIZES_KEY, JSON.stringify(merged));
      } else {
        setPrizes(res.prizes as Prize[]);
      }

      setParticipants(res.participants as Participant[]);
    } catch (e: any) {
      console.error("Erro ao carregar dados:", e);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(p: Partial<Prize> & { id?: string }) {
    try {
      const nextPrizes = [...prizes];
      const targetId = p.id && p.id.trim() ? p.id.trim() : (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "prize-" + Date.now());
      const idx = nextPrizes.findIndex((x) => x.id === targetId);
      
      const updatedItem: Prize = {
        id: targetId,
        name: p.name ?? "Novo Prêmio",
        icon: p.icon ?? "gift",
        total_quantity: p.total_quantity ?? 50,
        remaining_quantity: p.remaining_quantity ?? (p.total_quantity ?? 50),
        daily_limit: p.daily_limit ?? 0,
        date_quotas: p.date_quotas ?? {},
        weight: p.weight ?? 10,
        active: p.active ?? true,
        created_at: p.created_at ?? new Date().toISOString(),
      };

      if (idx !== -1) {
        nextPrizes[idx] = updatedItem;
      } else {
        nextPrizes.push(updatedItem);
      }

      // Persistência Imediata Local + Sync com o Worker
      setPrizes(nextPrizes);
      localStorage.setItem(LOCAL_STORAGE_PRIZES_KEY, JSON.stringify(nextPrizes));

      await syncAll({ data: { pin, prizes: nextPrizes } });
      await upsert({ data: { pin, ...updatedItem } });
      alert(`✅ Prêmio "${updatedItem.name}" salvo com sucesso!`);
    } catch (e: any) {
      alert("Erro ao salvar prêmio: " + e.message);
    }
  }

  async function remove(id: string) {
    if (!confirm("Tem certeza que deseja excluir este prêmio?")) return;
    try {
      const filtered = prizes.filter((p) => p.id !== id);
      setPrizes(filtered);
      localStorage.setItem(LOCAL_STORAGE_PRIZES_KEY, JSON.stringify(filtered));

      await del({ data: { pin, id } });
      await syncAll({ data: { pin, prizes: filtered } });
      alert("✅ Prêmio excluído com sucesso!");
    } catch (e: any) {
      alert("Erro ao excluir prêmio: " + e.message);
    }
  }

  async function resetToEventDefaults() {
    if (
      !confirm(
        "Deseja restaurar a configuração padrão do evento de 13 a 16 de Agosto (Copo Amarelo 500/dia, Chaveiros 75/dia, Canetas 30/dia, Lixeiras 25/24, Copo Térmico 20/dia, Bonés 20/dia, Mensalidade 2/dia)? Isso substituirá as edições atuais.",
      )
    )
      return;
    
    const defaultPrizes: Prize[] = [
      {
        id: "11111111-1316-4000-8000-000000000001",
        name: "Copo Amarelo",
        icon: "zap",
        total_quantity: 2000,
        remaining_quantity: 2000,
        daily_limit: 500,
        date_quotas: {
          "2026-08-13": 500,
          "2026-08-14": 500,
          "2026-08-15": 500,
          "2026-08-16": 500,
        },
        weight: 73,
        active: true,
        created_at: "2026-08-11T18:28:00.000Z",
      },
      {
        id: "22222222-1316-4000-8000-000000000002",
        name: "Chaveiro",
        icon: "heart",
        total_quantity: 300,
        remaining_quantity: 300,
        daily_limit: 75,
        date_quotas: {
          "2026-08-13": 75,
          "2026-08-14": 75,
          "2026-08-15": 75,
          "2026-08-16": 75,
        },
        weight: 11,
        active: true,
        created_at: "2026-08-11T18:28:00.000Z",
      },
      {
        id: "33333333-1316-4000-8000-000000000003",
        name: "Caneta",
        icon: "robot",
        total_quantity: 120,
        remaining_quantity: 120,
        daily_limit: 30,
        date_quotas: {
          "2026-08-13": 30,
          "2026-08-14": 30,
          "2026-08-15": 30,
          "2026-08-16": 30,
        },
        weight: 5,
        active: true,
        created_at: "2026-08-11T18:28:00.000Z",
      },
      {
        id: "44444444-1316-4000-8000-000000000004",
        name: "Lixeira de Carro",
        icon: "wifi",
        total_quantity: 97,
        remaining_quantity: 97,
        daily_limit: 25,
        date_quotas: {
          "2026-08-13": 25,
          "2026-08-14": 24,
          "2026-08-15": 24,
          "2026-08-16": 24,
        },
        weight: 4,
        active: true,
        created_at: "2026-08-11T18:28:00.000Z",
      },
      {
        id: "55555555-1316-4000-8000-000000000005",
        name: "Copo Térmico",
        icon: "house",
        total_quantity: 80,
        remaining_quantity: 80,
        daily_limit: 20,
        date_quotas: {
          "2026-08-13": 20,
          "2026-08-14": 20,
          "2026-08-15": 20,
          "2026-08-16": 20,
        },
        weight: 3,
        active: true,
        created_at: "2026-08-13T13:45:00.000Z",
      },
      {
        id: "66666666-1316-4000-8000-000000000006",
        name: "Boné",
        icon: "camera",
        total_quantity: 80,
        remaining_quantity: 80,
        daily_limit: 20,
        date_quotas: {
          "2026-08-13": 20,
          "2026-08-14": 20,
          "2026-08-15": 20,
          "2026-08-16": 20,
        },
        weight: 3,
        active: true,
        created_at: "2026-08-13T13:45:00.000Z",
      },
      {
        id: "77777777-1316-4000-8000-000000000007",
        name: "1 Mês de Mensalidade Grátis",
        icon: "zap",
        total_quantity: 8,
        remaining_quantity: 8,
        daily_limit: 2,
        date_quotas: {
          "2026-08-13": 2,
          "2026-08-14": 2,
          "2026-08-15": 2,
          "2026-08-16": 2,
        },
        weight: 1,
        active: true,
        created_at: "2026-08-13T13:45:00.000Z",
      },
    ];

    setPrizes(defaultPrizes);
    localStorage.setItem(LOCAL_STORAGE_PRIZES_KEY, JSON.stringify(defaultPrizes));
    await syncAll({ data: { pin, prizes: defaultPrizes } });
    alert("✅ Configuração padrão do evento restaurada!");
  }

  function exportBackupJSON() {
    const data = {
      prizes,
      participants,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-caca-niquel-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importBackupJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (parsed.prizes && Array.isArray(parsed.prizes)) {
          setPrizes(parsed.prizes);
          localStorage.setItem(LOCAL_STORAGE_PRIZES_KEY, JSON.stringify(parsed.prizes));
          await syncAll({ data: { pin, prizes: parsed.prizes } });
          alert("✅ Backup de prêmios restaurado com sucesso!");
        }
      } catch (err: any) {
        alert("Erro ao importar backup: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  async function deleteSelectedParticipants(ids: string[]) {
    if (
      !confirm(
        `Tem certeza que deseja excluir ${ids.length} participante(s)? Os prêmios deles serão estornados no estoque.`,
      )
    )
      return;
    setLoading(true);
    try {
      for (const id of ids) {
        await delParticipant({ data: { pin, id } });
      }
    } catch (e: any) {
      alert("Erro ao excluir participante(s): " + e.message);
    }
    await refresh();
  }

  // Estatísticas calculadas
  const stats = useMemo(() => {
    const todayParts = participants.filter((p) => formatBRDate(p.created_at) === todayStr);
    const todayWins = todayParts.filter((p) => p.won).length;
    const totalWins = participants.filter((p) => p.won).length;
    const totalRemaining = prizes.reduce((s, p) => s + p.remaining_quantity, 0);
    const totalDailyLimit = prizes
      .filter((p) => p.active)
      .reduce((s, p) => {
        const quotas = p.date_quotas;
        const hasSpecificDates = quotas && typeof quotas === "object" && Object.keys(quotas).length > 0;
        if (hasSpecificDates) {
          const customLimit = quotas[todayKey];
          return s + (typeof customLimit === "number" ? customLimit : 0);
        }
        return s + (p.daily_limit || 0);
      }, 0);

    return {
      todayParticipants: todayParts.length,
      todayWins,
      totalParticipants: participants.length,
      totalWins,
      totalRemaining,
      totalDailyLimit,
    };
  }, [participants, prizes, todayStr, todayKey]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-primary font-bold">
              Conexão VIP · Admin
            </div>
            <h1 className="text-xl font-black">Painel do Caça-Níquel</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-semibold text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 text-primary" /> Ciclo de Hoje: {todayStr} (encerra às 02:00)
            </span>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-muted font-semibold transition"
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </div>

        {/* Resumo do dia no Header */}
        <div className="mx-auto max-w-6xl px-6 pb-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <Users className="h-3.5 w-3.5 text-primary" /> Cadastros Hoje
              </div>
              <div className="mt-1 text-xl font-black">
                {stats.todayParticipants}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  ({stats.totalParticipants} total)
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <Gift className="h-3.5 w-3.5 text-primary" /> Brindes Hoje
              </div>
              <div className="mt-1 text-xl font-black">
                {stats.todayWins}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  ({stats.totalWins} total)
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <Calendar className="h-3.5 w-3.5 text-primary" /> Cota Total de Hoje
              </div>
              <div className="mt-1 text-xl font-black">
                {stats.totalDailyLimit > 0 ? (
                  <>
                    {stats.todayWins} / {stats.totalDailyLimit}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({Math.max(0, stats.totalDailyLimit - stats.todayWins)} restam)
                    </span>
                  </>
                ) : (
                  <span className="text-sm font-semibold text-muted-foreground">Livre / Sem limite</span>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-3 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Estoque Geral
              </div>
              <div className="mt-1 text-xl font-black">
                {stats.totalRemaining}{" "}
                <span className="text-xs font-normal text-muted-foreground">unidades</span>
              </div>
            </div>
          </div>
        </div>

        {/* Abas */}
        <div className="mx-auto flex max-w-6xl gap-2 px-6 pb-3">
          {(["prizes", "participants"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-5 py-2 text-sm font-bold transition ${
                tab === t
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {t === "prizes" ? "🎁 Prêmios & Cotas por Data" : `👥 Participantes (${participants.length})`}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : tab === "prizes" ? (
          <PrizesTab
            pin={pin}
            prizes={prizes}
            onSave={save}
            onDelete={remove}
            onResetDefaults={resetToEventDefaults}
            onExportBackup={exportBackupJSON}
            onImportBackup={importBackupJSON}
            todayKey={todayKey}
          />
        ) : (
          <ParticipantsTab
            participants={participants}
            onDeleteSelected={deleteSelectedParticipants}
          />
        )}
      </main>
    </div>
  );
}

function chooseRandomIcon(existingPrizes: Prize[]) {
  const usedIcons = existingPrizes.map((p) => p.icon);
  const unusedIcons = ICON_KEYS.filter((k) => !usedIcons.includes(k));
  const pool = unusedIcons.length > 0 ? unusedIcons : ICON_KEYS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function PrizesTab({
  pin,
  prizes,
  onSave,
  onDelete,
  onResetDefaults,
  onExportBackup,
  onImportBackup,
  todayKey,
}: {
  pin: string;
  prizes: Prize[];
  onSave: (p: Partial<Prize>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onResetDefaults: () => Promise<void>;
  onExportBackup: () => void;
  onImportBackup: (e: React.ChangeEvent<HTMLInputElement>) => void;
  todayKey: string;
}) {
  const [drafts, setDrafts] = useState<Record<string, Prize>>(() =>
    Object.fromEntries(prizes.map((p) => [p.id, p])),
  );

  useEffect(() => {
    setDrafts(Object.fromEntries(prizes.map((p) => [p.id, p])));
  }, [prizes]);

  const [newPrize, setNewPrize] = useState<Partial<Prize>>({
    name: "",
    icon: "gift",
    total_quantity: 50,
    remaining_quantity: 50,
    daily_limit: 10,
    date_quotas: {},
    weight: 10,
    active: true,
  });

  return (
    <div className="space-y-6">
      {/* Barra de Ferramentas de Backup e Reset */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 p-4 rounded-2xl border border-border">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onResetDefaults}
            className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold hover:bg-muted transition"
            title="Restaura os brindes e cotas oficiais dos dias 13 a 16"
          >
            🔄 Restaurar Padrão do Evento (13 a 16/08)
          </button>
          <button
            type="button"
            onClick={onExportBackup}
            className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold hover:bg-muted transition flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5 text-primary" /> Baixar Backup JSON
          </button>
          <label className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold hover:bg-muted transition cursor-pointer flex items-center gap-1.5">
            <span>📤 Importar Backup</span>
            <input type="file" accept=".json" onChange={onImportBackup} className="hidden" />
          </label>
        </div>
        <span className="text-xs text-muted-foreground font-semibold">
          💡 Todas as alterações ficam salvas de forma permanente.
        </span>
      </div>

      {/* Box de Informações sobre o Limite Diário e por Data */}
      <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 text-sm flex items-start gap-3">
        <Gift className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <strong className="font-bold text-base">Separação de Brindes por Dia & Cotas por Data:</strong>
          <div className="text-xs text-muted-foreground leading-relaxed">
            • <strong>Chance Geral de Vitória:</strong> Fixada em <strong>60% de chance</strong> nos dias com brindes disponíveis (e 0% em dias sem brindes ou com cotas esgotadas).<br />
            • <strong>Limite/Dia Padrão:</strong> Quantidade liberada por dia para dias normais (ex: 10 un/dia).<br />
            • <strong>Cotas Específicas por Data:</strong> Clique no botão <span className="font-bold text-primary">📅 Cotas por Data</span> em qualquer prêmio para definir valores personalizados para datas específicas (ex: 13 a 16 de Agosto).<br />
            • <strong>Ciclo de 24h:</strong> O ciclo encerra às <strong>02:00 da manhã</strong> para acompanhar eventos noturnos.
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card/60 p-5 shadow-xs">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
          <Plus className="h-5 w-5 text-primary" /> Adicionar Novo Prêmio
        </h2>
        <PrizeRow
          pin={pin}
          prize={newPrize as Prize}
          allPrizes={prizes}
          todayKey={todayKey}
          onChange={(p) => setNewPrize((prev) => ({ ...prev, ...p }))}
          onSave={async () => {
            if (!newPrize.name || !newPrize.name.trim()) return alert("Informe o nome do prêmio.");
            const chosenIcon =
              newPrize.icon && newPrize.icon !== "gift"
                ? newPrize.icon
                : chooseRandomIcon(prizes);
            await onSave({ ...newPrize, icon: chosenIcon });
            setNewPrize({
              name: "",
              icon: "gift",
              total_quantity: 50,
              remaining_quantity: 50,
              daily_limit: 10,
              date_quotas: {},
              weight: 10,
              active: true,
            });
          }}
          isNew
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold">Prêmios Cadastrados ({prizes.length})</h2>
        {prizes.map((p) => {
          const rare = p.icon === "thermos";
          return (
            <div
              key={p.id}
              className={`rounded-2xl border ${
                rare ? "border-primary ring-2 ring-primary/40" : "border-border"
              } bg-card/60 p-5 transition hover:border-border/80 shadow-xs`}
            >
              {rare && (
                <div className="mb-2 inline-block rounded-full bg-primary px-3 py-0.5 text-xs font-black uppercase tracking-widest text-primary-foreground">
                  ★ Prêmio raro
                </div>
              )}
              <PrizeRow
                pin={pin}
                prize={drafts[p.id] ?? p}
                allPrizes={prizes}
                todayKey={todayKey}
                onChange={(x) =>
                  setDrafts((d) => ({
                    ...d,
                    [p.id]: { ...(d[p.id] ?? p), ...x } as Prize,
                  }))
                }
                onSave={() => onSave(drafts[p.id] ?? p)}
                onDelete={() => onDelete(p.id)}
              />
            </div>
          );
        })}
      </section>
    </div>
  );
}

function PrizeRow({
  pin,
  prize,
  allPrizes,
  todayKey,
  onChange,
  onSave,
  onDelete,
  isNew,
}: {
  pin: string;
  prize: Prize;
  allPrizes: Prize[];
  todayKey: string;
  onChange: (p: Partial<Prize>) => void;
  onSave: () => void | Promise<void>;
  onDelete?: () => void;
  isNew?: boolean;
}) {
  const [showDates, setShowDates] = useState(false);
  const [inputDate, setInputDate] = useState("");
  const [inputQty, setInputQty] = useState(20);

  const dateQuotas = prize.date_quotas || {};
  const dateEntries = Object.entries(dateQuotas).sort(([a], [b]) => a.localeCompare(b));
  const customCount = dateEntries.length;

  const hasCustomToday = typeof dateQuotas[todayKey] === "number";
  const effectiveLimit = hasCustomToday ? dateQuotas[todayKey] : (Number(prize.daily_limit) || 0);
  const wonToday = prize.won_today || 0;
  const isDailyExhausted = effectiveLimit > 0 && wonToday >= effectiveLimit;
  const isTotalExhausted = prize.remaining_quantity <= 0;

  // Cálculo de Porcentagens
  const activePrizes = allPrizes.filter((p) => p.active);
  const totalWeight = activePrizes.reduce((s, p) => s + (p.weight || 0), 0);
  const winShare = totalWeight > 0 && prize.active ? ((prize.weight / totalWeight) * 100).toFixed(1) : "0";
  const spinChance = totalWeight > 0 && prize.active ? ((prize.weight / totalWeight) * 60).toFixed(1) : "0";

  function addOrUpdateDate(dateKey: string, qty: number) {
    if (!dateKey) return;
    const nextQuotas = { ...dateQuotas, [dateKey]: qty };
    onChange({ date_quotas: nextQuotas });
  }

  function removeDate(dateKey: string) {
    const nextQuotas = { ...dateQuotas };
    delete nextQuotas[dateKey];
    onChange({ date_quotas: nextQuotas });
  }

  return (
    <div className="flex flex-col gap-4 border-b border-border/20 pb-4 sm:border-0 sm:pb-0">
      <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto_auto_auto_auto_auto_auto]">
        {/* Preview do Ícone */}
        <div className="flex items-center justify-center">
          <div className="relative grid h-12 w-12 place-items-center rounded-lg border border-border bg-muted overflow-hidden">
            <SlotIcon name={prize.icon ?? "gift"} className="h-10 w-10 object-contain mx-auto" />
          </div>
        </div>

        {/* Nome do prêmio */}
        <div className="flex flex-col gap-1 w-full justify-center">
          <input
            type="text"
            placeholder="Nome do prêmio"
            value={prize.name ?? ""}
            onChange={(e) => onChange({ name: e.target.value })}
            className="rounded-lg border border-border bg-input px-3 py-2 w-full text-sm font-semibold focus:border-primary focus:outline-none"
          />
        </div>

        {/* Quantidades e % */}
        <NumberField
          label="Estoque Total"
          value={prize.total_quantity}
          onChange={(v) =>
            onChange({
              total_quantity: v,
              ...(isNew ? { remaining_quantity: v } : {}),
            })
          }
        />
        <NumberField
          label="Restante Geral"
          value={prize.remaining_quantity}
          onChange={(v) => onChange({ remaining_quantity: v })}
        />
        <NumberField
          label="Limite/Dia (Padrão)"
          helper="0 = livre"
          value={prize.daily_limit ?? 0}
          onChange={(v) => onChange({ daily_limit: v })}
        />
        <NumberField
          label="Peso / Chance"
          helper={prize.active ? `${winShare}% dos ganhadores (${spinChance}% no giro)` : "Inativo"}
          value={prize.weight}
          onChange={(v) => onChange({ weight: v })}
        />

        {/* Ativo */}
        <div className="flex items-center justify-start sm:justify-center">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={prize.active ?? true}
              onChange={(e) => onChange({ active: e.target.checked })}
              className="h-5 w-5 rounded border-border text-primary focus:ring-primary"
            />
            Ativo
          </label>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSave()}
            className="btn-vip btn-vip-hover flex-1 sm:flex-none flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm"
          >
            <Save className="h-4 w-4" /> Salvar
          </button>
          {onDelete && (
            <button
              onClick={onDelete}
              className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-destructive hover:bg-destructive/20"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Badges de Status e Botão de Cotas por Data */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          {customCount > 0 && !hasCustomToday ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">
              <Calendar className="h-3.5 w-3.5" />
              Não agendado para hoje (liberado em {dateEntries.map(([k]) => formatBRDateFromKey(k)).join(", ")})
            </span>
          ) : effectiveLimit > 0 ? (
            isDailyExhausted ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-3 py-1 text-xs font-bold text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                {hasCustomToday ? "Cota de hoje esgotada (específica da data)" : "Cota diária de hoje esgotada"} ({wonToday}/{effectiveLimit} saíram)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Hoje: {wonToday} de {effectiveLimit} saíram ({Math.max(0, effectiveLimit - wonToday)} disponíveis hoje)
                {hasCustomToday && " [Cota da data ativa]"}
              </span>
            )
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              Sem limite diário · {wonToday} saíram hoje
            </span>
          )}

          <span className="text-xs text-muted-foreground">
            · Total do evento: {prize.remaining_quantity} de {prize.total_quantity}
            {isTotalExhausted && " (Zerado)"}
          </span>
        </div>

        {/* Botão para Expandir Configuração por Data */}
        <button
          type="button"
          onClick={() => setShowDates(!showDates)}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
            showDates
              ? "bg-primary text-primary-foreground border-primary"
              : customCount > 0
              ? "border-primary/60 bg-primary/10 text-foreground hover:bg-primary/20"
              : "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
          }`}
        >
          <CalendarDays className="h-4 w-4 text-primary" />
          {customCount > 0 ? (
            <span>📅 {customCount} data(s) personalizada(s)</span>
          ) : (
            <span>📅 Editar Cotas por Data</span>
          )}
          {showDates ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Painel Expansível de Cotas por Data Específica */}
      {showDates && (
        <div className="mt-2 rounded-2xl border-2 border-primary/40 bg-card p-4 space-y-4 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div>
              <h4 className="font-bold text-sm flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-primary" /> Cotas Específicas por Data para "{prize.name || "este prêmio"}"
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Defina quantidades exatas para cada dia do evento (ex: 20 un no dia 11/08, 40 un no dia 12/08).
              </p>
            </div>
            <span className="text-xs text-muted-foreground">
              Limite padrão para outros dias: <strong>{prize.daily_limit || 0} un/dia</strong>
            </span>
          </div>

          {/* Formulário de Inclusão de Data */}
          <div className="flex flex-wrap items-end gap-3 bg-muted/40 p-3 rounded-xl border border-border">
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-bold text-foreground">Escolher Data:</span>
              <input
                type="date"
                value={inputDate}
                onChange={(e) => setInputDate(e.target.value)}
                className="rounded-lg border border-border bg-input px-3 py-2 text-xs font-semibold focus:border-primary focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs">
              <span className="font-bold text-foreground">Quantidade de Brindes:</span>
              <input
                type="number"
                min={0}
                value={inputQty}
                onChange={(e) => setInputQty(Number(e.target.value))}
                className="w-28 rounded-lg border border-border bg-input px-3 py-2 text-xs font-bold focus:border-primary focus:outline-none"
              />
            </label>

            <button
              type="button"
              onClick={() => {
                if (!inputDate) return alert("Selecione uma data no calendário.");
                addOrUpdateDate(inputDate, inputQty);
                setInputDate("");
              }}
              className="btn-vip btn-vip-hover flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar / Definir Data
            </button>

            {/* Botões Rápidos */}
            <div className="flex items-center gap-1.5 ml-auto text-xs">
              <span className="text-muted-foreground font-semibold">Atalhos:</span>
              <button
                type="button"
                onClick={() => addOrUpdateDate(getQuickDateKey(0), inputQty)}
                className="rounded-lg border border-border bg-card px-2 py-1 hover:bg-muted font-bold"
              >
                Hoje ({formatBRDateFromKey(getQuickDateKey(0))})
              </button>
              <button
                type="button"
                onClick={() => addOrUpdateDate(getQuickDateKey(1), inputQty)}
                className="rounded-lg border border-border bg-card px-2 py-1 hover:bg-muted font-bold"
              >
                Amanhã ({formatBRDateFromKey(getQuickDateKey(1))})
              </button>
              <button
                type="button"
                onClick={() => addOrUpdateDate(getQuickDateKey(2), inputQty)}
                className="rounded-lg border border-border bg-card px-2 py-1 hover:bg-muted font-bold"
              >
                +2 Dias ({formatBRDateFromKey(getQuickDateKey(2))})
              </button>
            </div>
          </div>

          {/* Tabela de Datas Configuradas */}
          {dateEntries.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground uppercase tracking-wider text-[11px] text-left">
                  <tr>
                    <th className="px-4 py-2.5">Data do Evento</th>
                    <th className="px-4 py-2.5">Cota Definida</th>
                    <th className="px-4 py-2.5">Entregues neste Dia</th>
                    <th className="px-4 py-2.5">Restantes no Dia</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {dateEntries.map(([dateKey, quota]) => {
                    const isToday = dateKey === todayKey;
                    const wonOnDate = prize.won_by_date?.[dateKey] || 0;
                    const remainingOnDate = Math.max(0, quota - wonOnDate);
                    const isExhausted = wonOnDate >= quota;

                    return (
                      <tr key={dateKey} className={`border-t border-border ${isToday ? "bg-primary/5 font-semibold" : ""}`}>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">{formatBRDateFromKey(dateKey)}</span>
                            {isToday && (
                              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-black uppercase text-primary-foreground">
                                Hoje
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono">{dateKey}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number"
                            min={0}
                            value={quota}
                            onChange={(e) => addOrUpdateDate(dateKey, Number(e.target.value))}
                            className="w-20 rounded-md border border-border bg-input px-2 py-1 text-xs font-bold focus:border-primary focus:outline-none"
                          />{" "}
                          <span className="text-muted-foreground">un</span>
                        </td>
                        <td className="px-4 py-2.5 font-bold">
                          {wonOnDate} un
                        </td>
                        <td className="px-4 py-2.5 font-bold">
                          {remainingOnDate} un
                        </td>
                        <td className="px-4 py-2.5">
                          {isExhausted ? (
                            <span className="rounded-full bg-destructive/15 px-2 py-0.5 font-bold text-destructive">
                              🔴 Esgotado
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-bold text-emerald-700 dark:text-emerald-400">
                              🟢 Disponível ({remainingOnDate} restam)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => removeDate(dateKey)}
                            className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-destructive hover:bg-destructive/20 font-semibold"
                            title="Remover data personalizada"
                          >
                            <Trash2 className="h-3.5 w-3.5 inline" /> Remover
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
              Nenhuma data personalizada configurada ainda. Este brinde usará o limite diário padrão (<strong>{prize.daily_limit || 0} un/dia</strong>).
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
            <span>💡 <em>Lembre-se de clicar no botão "Salvar" do prêmio acima para persistir as alterações de datas.</em></span>
            <button
              type="button"
              onClick={() => onSave()}
              className="btn-vip btn-vip-hover flex items-center gap-1 rounded-lg px-4 py-1.5 font-bold"
            >
              <Save className="h-3.5 w-3.5" /> Salvar Prêmio e Datas
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  helper,
  onChange,
}: {
  label: string;
  value: number;
  helper?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5 text-xs">
      <span className="text-muted-foreground font-semibold flex items-center justify-between">
        {label}
      </span>
      <input
        type="number"
        value={value}
        min={0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 rounded-lg border border-border bg-input px-2 py-2 text-base font-bold focus:border-primary focus:outline-none"
      />
      {helper && <span className="text-[10px] text-muted-foreground">{helper}</span>}
    </label>
  );
}

function ParticipantsTab({
  participants,
  onDeleteSelected,
}: {
  participants: Participant[];
  onDeleteSelected: (ids: string[]) => void | Promise<void>;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  const todayStr = getTodayFormatted();

  // Lista única de datas disponíveis
  const availableDates = useMemo(() => {
    const dates = Array.from(new Set(participants.map((p) => formatBRDate(p.created_at))));
    return dates;
  }, [participants]);

  // Participantes filtrados
  const filtered = useMemo(() => {
    return participants.filter((p) => {
      const pDate = formatBRDate(p.created_at);
      if (dateFilter === "today" && pDate !== todayStr) return false;
      if (dateFilter !== "all" && dateFilter !== "today" && pDate !== dateFilter) return false;

      if (search.trim()) {
        const query = search.toLowerCase();
        const matchName = p.full_name?.toLowerCase().includes(query);
        const matchWhats = p.whatsapp?.includes(query);
        const matchPrize = p.prize_name?.toLowerCase().includes(query);
        const matchCode = p.redemption_code?.toLowerCase().includes(query);
        if (!matchName && !matchWhats && !matchPrize && !matchCode) return false;
      }
      return true;
    });
  }, [participants, dateFilter, todayStr, search]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((p) => p.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleDelete = async () => {
    if (selectedIds.length === 0) return;
    await onDeleteSelected(selectedIds);
    setSelectedIds([]);
  };

  function exportCSV() {
    const header = ["Nome", "WhatsApp", "Cidade", "Cliente VIP", "Ganhou", "Prêmio", "Código", "Data"];
    const rows = filtered.map((p) => [
      p.full_name,
      p.whatsapp,
      p.city,
      p.is_client ? "Sim" : "Não",
      p.won ? "Sim" : "Não",
      p.prize_name ?? "",
      p.redemption_code ?? "",
      new Date(p.created_at).toLocaleString("pt-BR"),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `participantes-conexaovip-${dateFilter}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Barra de Filtros e Ações */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card/60 p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Filter className="h-3.5 w-3.5 text-primary" /> Filtrar por Dia:
          </div>

          <button
            onClick={() => setDateFilter("all")}
            className={`rounded-full px-3 py-1 text-xs font-bold transition ${
              dateFilter === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Todos ({participants.length})
          </button>

          <button
            onClick={() => setDateFilter("today")}
            className={`rounded-full px-3 py-1 text-xs font-bold transition ${
              dateFilter === "today"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Hoje ({participants.filter((p) => formatBRDate(p.created_at) === todayStr).length})
          </button>

          {availableDates
            .filter((d) => d !== todayStr)
            .map((d) => (
              <button
                key={d}
                onClick={() => setDateFilter(d)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                  dateFilter === d
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {d} ({participants.filter((p) => formatBRDate(p.created_at) === d).length})
              </button>
            ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Buscar nome, fone, prêmio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-border bg-input px-3 py-1.5 text-xs font-semibold focus:border-primary focus:outline-none w-48 sm:w-64"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          Exibindo <strong>{filtered.length}</strong> participante(s) ·{" "}
          <strong>{filtered.filter((p) => p.won).length}</strong> ganhadores
          {selectedIds.length > 0 && (
            <span className="ml-2 font-bold text-destructive">
              ({selectedIds.length} selecionado(s))
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white hover:bg-destructive/90 transition"
            >
              <Trash2 className="h-4 w-4" /> Excluir Selecionados
            </button>
          )}
          <button
            onClick={exportCSV}
            className="btn-vip btn-vip-hover flex items-center gap-2 rounded-lg px-4 py-2 text-sm"
          >
            <Download className="h-4 w-4" /> Exportar CSV ({filtered.length})
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border shadow-xs">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selectedIds.length === filtered.length}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                />
              </th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">WhatsApp</th>
              <th className="px-4 py-3">Cidade</th>
              <th className="px-4 py-3">Status VIP</th>
              <th className="px-4 py-3">Prêmio</th>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Data / Hora</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-border hover:bg-muted/20 transition">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(p.id)}
                    onChange={() => toggleSelectOne(p.id)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                </td>
                <td className="px-4 py-3 font-medium">{p.full_name}</td>
                <td className="px-4 py-3 font-mono text-xs">{p.whatsapp}</td>
                <td className="px-4 py-3">{p.city}</td>
                <td className="px-4 py-3">
                  {p.is_client ? (
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                      ★ Cliente VIP
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      Não Cliente
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {p.won ? (
                    <span className="rounded-full bg-primary/20 px-2.5 py-1 text-xs font-bold text-primary inline-flex items-center gap-1">
                      🎁 {p.prize_name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono font-bold text-xs">
                  {p.redemption_code ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {new Date(p.created_at).toLocaleString("pt-BR")}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhum participante encontrado para este filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
