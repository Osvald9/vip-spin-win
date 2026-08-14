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
  adminSyncAllParticipants,
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
  daily_limit: number;
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
  cpf?: string;
  city?: string;
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
const LOCAL_STORAGE_PARTICIPANTS_KEY = "vip_participants_master_v1";

function AdminDashboard({ pin, onLogout }: { pin: string; onLogout: () => void }) {
  const listAll = useServerFn(adminListAll);
  const upsert = useServerFn(adminUpsertPrize);
  const syncAll = useServerFn(adminSyncAllPrizes);
  const syncParticipants = useServerFn(adminSyncAllParticipants);
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
  const [participants, setParticipants] = useState<Participant[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(LOCAL_STORAGE_PARTICIPANTS_KEY);
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return [];
  });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"prizes" | "participants">("prizes");

  const todayStr = getTodayFormatted();
  const todayKey = getEventDateKey(new Date());

  async function refresh(silent = false) {
    if (!silent) setLoading(true);
    try {
      // 1. Sincroniza prêmios locais persistidos
      const cached = typeof window !== "undefined" ? localStorage.getItem(LOCAL_STORAGE_PRIZES_KEY) : null;
      if (cached) {
        try {
          const localPrizes = JSON.parse(cached);
          if (Array.isArray(localPrizes) && localPrizes.length > 0) {
            setPrizes(localPrizes);
            await syncAll({ data: { pin, prizes: localPrizes } }).catch(() => {});
          }
        } catch {}
      }

      // 2. Sincroniza participantes locais persistidos
      const cachedParts = typeof window !== "undefined" ? localStorage.getItem(LOCAL_STORAGE_PARTICIPANTS_KEY) : null;
      if (cachedParts) {
        try {
          const localParts = JSON.parse(cachedParts);
          if (Array.isArray(localParts) && localParts.length > 0) {
            await syncParticipants({ data: { pin, participants: localParts } }).catch(() => {});
            setParticipants(localParts);
          }
        } catch {}
      }

      const res = await listAll({ data: { pin } });
      
      if (!cached && res.prizes && res.prizes.length > 0) {
        localStorage.setItem(LOCAL_STORAGE_PRIZES_KEY, JSON.stringify(res.prizes));
        setPrizes(res.prizes as Prize[]);
      } else if (cached && res.prizes) {
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

      // Mescla participantes do servidor com participantes locais
      const localList: Participant[] = cachedParts ? JSON.parse(cachedParts) : [];
      const pMap = new Map<string, Participant>();
      for (const p of localList) {
        if (p.id) pMap.set(p.id, p);
      }
      for (const p of (res.participants as Participant[] || [])) {
        if (p.id) pMap.set(p.id, p);
      }
      const mergedParts = Array.from(pMap.values()).sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
      );
      setParticipants(mergedParts);
      if (typeof window !== "undefined") {
        localStorage.setItem(LOCAL_STORAGE_PARTICIPANTS_KEY, JSON.stringify(mergedParts));
      }
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
        total_quantity: Number(p.total_quantity) || 0,
        remaining_quantity: Number(p.remaining_quantity) || 0,
        daily_limit: Number(p.daily_limit) || 0,
        weight: Number(p.weight) || 10,
        active: p.active !== false,
        created_at: p.created_at ?? new Date().toISOString(),
      };

      if (idx !== -1) {
        nextPrizes[idx] = updatedItem;
      } else {
        nextPrizes.push(updatedItem);
      }

      setPrizes(nextPrizes);
      if (typeof window !== "undefined") {
        localStorage.setItem(LOCAL_STORAGE_PRIZES_KEY, JSON.stringify(nextPrizes));
      }

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
      if (typeof window !== "undefined") {
        localStorage.setItem(LOCAL_STORAGE_PRIZES_KEY, JSON.stringify(filtered));
      }

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
        "Deseja restaurar a configuração padrão do evento (Copo Amarelo 500/dia, Chaveiro 75/dia, Caneta 30/dia, Lixeira 25/dia, Copo Térmico 20/dia, Boné 20/dia, Mensalidade 2/dia)? Isso substituirá as edições atuais.",
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
        weight: 1,
        active: true,
        created_at: "2026-08-13T13:45:00.000Z",
      },
    ];

    setPrizes(defaultPrizes);
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_STORAGE_PRIZES_KEY, JSON.stringify(defaultPrizes));
    }
    await syncAll({ data: { pin, prizes: defaultPrizes } });
    alert("✅ Configuração padrão de brindes restaurada!");
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
      const remaining = participants.filter((p) => !ids.includes(p.id));
      setParticipants(remaining);
      if (typeof window !== "undefined") {
        localStorage.setItem(LOCAL_STORAGE_PARTICIPANTS_KEY, JSON.stringify(remaining));
      }
    } catch (e: any) {
      alert("Erro ao excluir participante(s): " + e.message);
    }
    await refresh();
  }

  const stats = useMemo(() => {
    const todayParts = participants.filter((p) => formatBRDate(p.created_at) === todayStr);
    const todayWins = todayParts.filter((p) => p.won).length;
    const totalWins = participants.filter((p) => p.won).length;
    const totalRemaining = prizes.reduce((s, p) => s + p.remaining_quantity, 0);
    const totalDailyLimit = prizes
      .filter((p) => p.active)
      .reduce((s, p) => s + (Number(p.daily_limit) || 0), 0);

    return {
      todayParticipants: todayParts.length,
      todayWins,
      totalParticipants: participants.length,
      totalWins,
      totalRemaining,
      totalDailyLimit,
    };
  }, [participants, prizes, todayStr]);

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
            <button
              onClick={() => void refresh()}
              disabled={loading}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted transition"
            >
              Atualizar
            </button>
            <button
              onClick={onLogout}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted transition flex items-center gap-1"
            >
              <LogOut className="h-3.5 w-3.5" /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            label="Participantes Hoje"
            value={stats.todayParticipants}
            hint={`Ciclo: ${todayStr}`}
            icon={<Users className="h-4 w-4 text-primary" />}
          />
          <StatCard
            label="Ganhadores Hoje"
            value={stats.todayWins}
            hint={`Total evento: ${stats.totalWins}`}
            icon={<Gift className="h-4 w-4 text-primary" />}
          />
          <StatCard
            label="Cota Diária Total"
            value={stats.totalDailyLimit > 0 ? `${stats.todayWins}/${stats.totalDailyLimit}` : "Livre"}
            hint={stats.totalDailyLimit > 0 ? `${Math.max(0, stats.totalDailyLimit - stats.todayWins)} restantes hoje` : "Sem trava diária"}
            icon={<Calendar className="h-4 w-4 text-primary" />}
          />
          <StatCard
            label="Estoque Geral"
            value={stats.totalRemaining}
            hint={`Restante de todos os brindes`}
            icon={<Package className="h-4 w-4 text-primary" />}
          />
        </div>

        <div className="flex gap-2 border-b border-border pb-2">
          <button
            onClick={() => setTab("prizes")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === "prizes"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <Gift className="h-4 w-4" /> Configurar Brindes ({prizes.length})
          </button>
          <button
            onClick={() => setTab("participants")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === "participants"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <Users className="h-4 w-4" /> Participantes ({participants.length})
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {!loading && tab === "prizes" && (
          <PrizesTab
            pin={pin}
            prizes={prizes}
            onSave={save}
            onDelete={remove}
            onResetDefaults={resetToEventDefaults}
            onExportBackup={exportBackupJSON}
            onImportBackup={importBackupJSON}
          />
        )}

        {!loading && tab === "participants" && (
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
}: {
  pin: string;
  prizes: Prize[];
  onSave: (p: Partial<Prize> & { id?: string }) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onResetDefaults: () => void | Promise<void>;
  onExportBackup: () => void;
  onImportBackup: (e: React.ChangeEvent<HTMLInputElement>) => void;
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
    weight: 10,
    active: true,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 p-4 rounded-2xl border border-border">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onResetDefaults}
            className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold hover:bg-muted transition"
            title="Restaura os brindes padrão com as cotas diárias oficiais"
          >
            🔄 Restaurar Padrão do Evento
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
          💡 A quantidade por dia é automática para todos os dias do evento.
        </span>
      </div>

      <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 text-sm flex items-start gap-3">
        <Gift className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <strong className="font-bold text-base">Controle Diário de Brindes:</strong>
          <div className="text-xs text-muted-foreground leading-relaxed">
            • <strong>Chance Geral de Vitória:</strong> Fixada em <strong>60% de chance</strong> nos dias com brindes disponíveis no estoque do dia.<br />
            • <strong>Qtd por Dia (Limite Diário):</strong> Quantidade liberada por dia (ex: 500/dia, 20/dia). Não precisa selecionar datas — o sistema reseta a cota a cada ciclo de 24h automaticamente!<br />
            • <strong>Ciclo de 24h:</strong> O ciclo diário encerra às <strong>02:00 da manhã</strong>.
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
  onChange,
  onSave,
  onDelete,
  isNew,
}: {
  pin: string;
  prize: Prize;
  allPrizes: Prize[];
  onChange: (p: Partial<Prize>) => void;
  onSave: () => void | Promise<void>;
  onDelete?: () => void;
  isNew?: boolean;
}) {
  const wonToday = prize.won_today || 0;
  const dailyLimit = Number(prize.daily_limit) || 0;
  const isDailyExhausted = dailyLimit > 0 && wonToday >= dailyLimit;
  const isTotalExhausted = prize.remaining_quantity <= 0;

  const activePrizes = allPrizes.filter((p) => p.active);
  const totalWeight = activePrizes.reduce((s, p) => s + (p.weight || 0), 0);
  const winShare = totalWeight > 0 && prize.active ? ((prize.weight / totalWeight) * 100).toFixed(1) : "0";
  const spinChance = totalWeight > 0 && prize.active ? ((prize.weight / totalWeight) * 60).toFixed(1) : "0";

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[auto_1.5fr_auto_auto_auto_auto_auto_auto]">
        <div className="flex items-center justify-center">
          <div className="relative grid h-12 w-12 place-items-center rounded-lg border border-border bg-muted overflow-hidden">
            <SlotIcon name={prize.icon ?? "gift"} className="h-10 w-10 object-contain mx-auto" />
          </div>
        </div>

        <div className="flex flex-col gap-1 w-full justify-center">
          <label className="text-xs text-muted-foreground font-semibold">Nome do Prêmio</label>
          <input
            type="text"
            placeholder="Nome do prêmio"
            value={prize.name ?? ""}
            onChange={(e) => onChange({ name: e.target.value })}
            className="rounded-lg border border-border bg-input px-3 py-2 w-full text-sm font-semibold focus:border-primary focus:outline-none"
          />
        </div>

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
          label="Qtd por Dia"
          helper="0 = livre"
          value={prize.daily_limit ?? 0}
          onChange={(v) => onChange({ daily_limit: v })}
        />
        <NumberField
          label="Peso / Chance"
          helper={prize.active ? `${winShare}% dos brindes (${spinChance}% no giro)` : "Inativo"}
          value={prize.weight ?? 10}
          onChange={(v) => onChange({ weight: v })}
        />

        <div className="flex items-center justify-start sm:justify-center">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none font-bold">
            <input
              type="checkbox"
              checked={prize.active ?? true}
              onChange={(e) => onChange({ active: e.target.checked })}
              className="h-5 w-5 rounded border-border text-primary focus:ring-primary"
            />
            Ativo
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSave()}
            className="btn-vip btn-vip-hover flex-1 sm:flex-none flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm"
          >
            <Save className="h-4 w-4" /> Salvar
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-destructive hover:bg-destructive/20"
              title="Excluir Prêmio"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {!isNew && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40 text-xs">
          {dailyLimit > 0 ? (
            isDailyExhausted ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-3 py-1 font-bold text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                Cota de hoje esgotada ({wonToday}/{dailyLimit} entregues hoje)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 font-bold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Hoje: {wonToday} de {dailyLimit} entregues ({Math.max(0, dailyLimit - wonToday)} disponíveis hoje)
              </span>
            )
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 font-medium text-muted-foreground">
              Sem limite diário · {wonToday} entregues hoje
            </span>
          )}

          <span className="text-muted-foreground">
            · Total do evento: {prize.remaining_quantity} restantes de {prize.total_quantity}
            {isTotalExhausted && " (Estoque Zerado)"}
          </span>
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
        const matchCpf = p.cpf?.includes(query);
        const matchPrize = p.prize_name?.toLowerCase().includes(query);
        const matchCode = p.redemption_code?.toLowerCase().includes(query);
        if (!matchName && !matchWhats && !matchCpf && !matchPrize && !matchCode) return false;
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
    const header = ["Nome", "WhatsApp", "CPF", "Ganhou", "Prêmio", "Código", "Data / Hora"];
    const rows = filtered.map((p) => [
      p.full_name,
      p.whatsapp,
      p.cpf || "",
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
            placeholder="Buscar nome, CPF, fone, prêmio..."
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
              <th className="px-4 py-3">CPF</th>
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
                <td className="px-4 py-3 font-mono text-xs">{p.cpf || "—"}</td>
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
