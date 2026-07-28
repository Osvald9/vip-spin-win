import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, LogOut, Plus, Save, Trash2, Loader2, Lock } from "lucide-react";

import {
  adminLogin,
  adminListAll,
  adminUpsertPrize,
  adminDeletePrize,
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
  weight: number;
  active: boolean;
}
interface Participant {
  id: string;
  full_name: string;
  whatsapp: string;
  city: string;
  prize_name: string | null;
  redemption_code: string | null;
  won: boolean;
  created_at: string;
}

const PIN_KEY = "vip_admin_pin";

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

  return <AdminDashboard pin={pin} onLogout={() => { sessionStorage.removeItem(PIN_KEY); window.location.href = "/"; }} />;
}

function AdminDashboard({ pin, onLogout }: { pin: string; onLogout: () => void }) {
  const listAll = useServerFn(adminListAll);
  const upsert = useServerFn(adminUpsertPrize);
  const del = useServerFn(adminDeletePrize);
  const delParticipant = useServerFn(adminDeleteParticipant);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"prizes" | "participants">("prizes");

  async function refresh() {
    setLoading(true);
    try {
      const res = await listAll({ data: { pin } });
      setPrizes(res.prizes as Prize[]);
      setParticipants(res.participants as Participant[]);
    } catch (e: any) {
      alert("Erro ao carregar dados: " + e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(p: Partial<Prize> & { id?: string }) {
    try {
      await upsert({
        data: {
          pin,
          id: p.id,
          name: p.name ?? "",
          icon: p.icon ?? "gift",
          total_quantity: p.total_quantity ?? 0,
          remaining_quantity: p.remaining_quantity ?? 0,
          weight: p.weight ?? 10,
          active: p.active ?? true,
        },
      });
      await refresh();
    } catch (e: any) {
      alert("Erro ao salvar prêmio: " + e.message);
    }
  }
  async function remove(id: string) {
    if (!confirm("Excluir este prêmio?")) return;
    await del({ data: { pin, id } });
    await refresh();
  }
  async function deleteSelectedParticipants(ids: string[]) {
    if (!confirm(`Tem certeza que deseja excluir ${ids.length} participante(s)? Os prêmios deles serão estornados no estoque.`)) return;
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

  function exportCSV() {
    const header = ["Nome", "WhatsApp", "Cidade", "Ganhou", "Prêmio", "Código", "Data"];
    const rows = participants.map((p) => [
      p.full_name,
      p.whatsapp,
      p.city,
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
    a.download = `participantes-conexaovip-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-primary">Conexão VIP · Admin</div>
            <h1 className="text-xl font-black">Painel do Caça-Níquel</h1>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
        <div className="mx-auto flex max-w-6xl gap-2 px-6 pb-3">
          {(["prizes", "participants"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                tab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {t === "prizes" ? "Prêmios" : `Participantes (${participants.length})`}
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
          <PrizesTab pin={pin} prizes={prizes} onSave={save} onDelete={remove} />
        ) : (
          <ParticipantsTab 
            participants={participants} 
            onExport={exportCSV} 
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
}: {
  pin: string;
  prizes: Prize[];
  onSave: (p: Partial<Prize>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [drafts, setDrafts] = useState<Record<string, Prize>>(() =>
    Object.fromEntries(prizes.map((p) => [p.id, p])),
  );
  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      prizes.forEach((p) => {
        const existingDraft = prev[p.id];
        if (!existingDraft) {
          next[p.id] = p;
        } else {
          // Check if user has unsaved edits in this draft
          const isEdited =
            existingDraft.name !== p.name ||
            existingDraft.total_quantity !== p.total_quantity ||
            existingDraft.weight !== p.weight ||
            existingDraft.active !== p.active;

          if (!isEdited) {
            next[p.id] = p;
          } else {
            next[p.id] = {
              ...existingDraft,
              remaining_quantity: p.remaining_quantity,
            };
          }
        }
      });
      return next;
    });
  }, [prizes]);

  const [newPrize, setNewPrize] = useState<Partial<Prize>>({
    name: "",
    icon: "gift",
    total_quantity: 10,
    remaining_quantity: 10,
    weight: 10,
    active: true,
  });

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card/60 p-5">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
          <Plus className="h-5 w-5 text-primary" /> Novo prêmio
        </h2>
        <PrizeRow
          pin={pin}
          prize={newPrize as Prize}
          onChange={(p) => setNewPrize((prev) => ({ ...prev, ...p }))}
          onSave={async () => {
            if (!newPrize.name) return;
            const chosenIcon = (newPrize.icon && newPrize.icon !== "gift")
              ? newPrize.icon
              : chooseRandomIcon(prizes);
            await onSave({ ...newPrize, icon: chosenIcon });
            setNewPrize({
              name: "",
              icon: "gift",
              total_quantity: 10,
              remaining_quantity: 10,
              weight: 10,
              active: true,
            });
          }}
          isNew
        />
      </section>

      <section className="space-y-3">
        {prizes.map((p) => {
          const rare = p.icon === "thermos";
          return (
            <div
              key={p.id}
              className={`rounded-2xl border ${rare ? "border-primary ring-2 ring-primary/40" : "border-border"} bg-card/60 p-5`}
            >
              {rare && (
                <div className="mb-2 inline-block rounded-full bg-primary px-3 py-0.5 text-xs font-black uppercase tracking-widest text-primary-foreground">
                  ★ Prêmio raro
                </div>
              )}
              <PrizeRow
                pin={pin}
                prize={drafts[p.id] ?? p}
                onChange={(x) => setDrafts((d) => ({ ...d, [p.id]: { ...(d[p.id] ?? p), ...x } as Prize }))}
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
  onChange,
  onSave,
  onDelete,
  isNew,
}: {
  pin: string;
  prize: Prize;
  onChange: (p: Partial<Prize>) => void;
  onSave: () => void | Promise<void>;
  onDelete?: () => void;
  isNew?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-border/20 pb-4 sm:border-0 sm:pb-0">
      <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto_auto_auto_auto_auto]">
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
            className="rounded-lg border border-border bg-input px-3 py-2 w-full text-sm font-semibold"
          />
        </div>

        {/* Quantidades e % */}
        <NumberField label="Total" value={prize.total_quantity} onChange={(v) => onChange({ total_quantity: v, ...(isNew ? { remaining_quantity: v } : {}) })} />
        <NumberField label="Restante" value={prize.remaining_quantity} onChange={(v) => onChange({ remaining_quantity: v })} />
        <NumberField label="%" value={prize.weight} onChange={(v) => onChange({ weight: v })} />
        
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
      
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>
          Chance de ganhar: {prize.weight}% · {prize.remaining_quantity} de {prize.total_quantity} disponíveis
          {prize.remaining_quantity === 0 && " · esgotado"}
        </span>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="number"
        value={value}
        min={0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 rounded-lg border border-border bg-input px-2 py-2 text-base"
      />
    </label>
  );
}

function ParticipantsTab({
  participants,
  onExport,
  onDeleteSelected,
}: {
  participants: Participant[];
  onExport: () => void;
  onDeleteSelected: (ids: string[]) => void | Promise<void>;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelectAll = () => {
    if (selectedIds.length === participants.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(participants.map((p) => p.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleDelete = async () => {
    if (selectedIds.length === 0) return;
    await onDeleteSelected(selectedIds);
    setSelectedIds([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          {participants.length} participante(s) · {participants.filter((p) => p.won).length} ganhadores
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
              className="flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4" /> Excluir Selecionados
            </button>
          )}
          <button
            onClick={onExport}
            className="btn-vip btn-vip-hover flex items-center gap-2 rounded-lg px-4 py-2 text-sm"
          >
            <Download className="h-4 w-4" /> Exportar CSV
          </button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={participants.length > 0 && selectedIds.length === participants.length}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                />
              </th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">WhatsApp</th>
              <th className="px-4 py-3">Cidade</th>
              <th className="px-4 py-3">Prêmio</th>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Data</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(p.id)}
                    onChange={() => toggleSelectOne(p.id)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                </td>
                <td className="px-4 py-3 font-medium">{p.full_name}</td>
                <td className="px-4 py-3">{p.whatsapp}</td>
                <td className="px-4 py-3">{p.city}</td>
                <td className="px-4 py-3">
                  {p.won ? (
                    <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-bold text-primary">
                      {p.prize_name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono">{p.redemption_code ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(p.created_at).toLocaleString("pt-BR")}
                </td>
              </tr>
            ))}
            {participants.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhum participante ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
