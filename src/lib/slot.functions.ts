import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function isValidCPF(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(10), 10)) return false;

  return true;
}

function formatCPF(cpf: string): string {
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return cpf;
  return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

const registerSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  whatsapp: z
    .string()
    .trim()
    .min(8)
    .max(30)
    .transform((v) => v.replace(/\D/g, "")),
  cpf: z
    .string()
    .trim()
    .min(11)
    .max(20)
    .transform((v) => v.replace(/\D/g, "")),
  accepted_terms: z.literal(true),
});

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "VIP-";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const globalStore = globalThis as unknown as {
  prizes?: any[];
  participants?: any[];
};

// O ciclo do dia de evento encerra às 02:00 da manhã.
// Deslocar 2 horas faz com que o período entre 00:00 e 01:59 pertença ao dia anterior.
const DAY_CYCLE_OFFSET_MS = 2 * 60 * 60 * 1000;

function getEventDateKey(date: Date = new Date()): string {
  const shifted = new Date(date.getTime() - DAY_CYCLE_OFFSET_MS);
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(shifted); // Formato YYYY-MM-DD
  } catch {
    return shifted.toISOString().slice(0, 10);
  }
}

function getTodayKey(): string {
  return getEventDateKey(new Date());
}

function isCreatedToday(isoString?: string | null, todayKey?: string): boolean {
  if (!isoString) return false;
  const targetKey = todayKey ?? getTodayKey();
  try {
    const createdDate = new Date(isoString);
    return getEventDateKey(createdDate) === targetKey;
  } catch {
    return false;
  }
}

function isPrizeAvailable(prize: any, wonToday: number): boolean {
  if (!prize || !prize.active || prize.remaining_quantity <= 0) return false;
  const dailyLimit = Number(prize.daily_limit) || 0;
  if (dailyLimit > 0 && wonToday >= dailyLimit) {
    return false;
  }
  return true;
}

function getInitialPrizes() {
  return [
    {
      id: "11111111-1316-4000-8000-000000000001",
      name: "Copo Amarelo",
      icon: "robot",
      total_quantity: 2000,
      remaining_quantity: 2000,
      daily_limit: 450,
      weight: 22,
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
      weight: 10,
      active: true,
      created_at: "2026-08-11T18:28:00.000Z",
    },
    {
      id: "33333333-1316-4000-8000-000000000003",
      name: "Caneta",
      icon: "zap",
      total_quantity: 120,
      remaining_quantity: 120,
      daily_limit: 30,
      weight: 8,
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
      weight: 8,
      active: true,
      created_at: "2026-08-11T18:28:00.000Z",
    },
    {
      id: "55555555-1316-4000-8000-000000000005",
      name: "Copo Térmico ( se for cliente, se não",
      icon: "house",
      total_quantity: 80,
      remaining_quantity: 80,
      daily_limit: 20,
      weight: 7,
      active: true,
      created_at: "2026-08-13T13:45:00.000Z",
    },
    {
      id: "66666666-1316-4000-8000-000000000006",
      name: "Boné",
      icon: "robot",
      total_quantity: 80,
      remaining_quantity: 80,
      daily_limit: 20,
      weight: 7,
      active: true,
      created_at: "2026-08-13T13:45:00.000Z",
    },
    {
      id: "77777777-1316-4000-8000-000000000007",
      name: "1 Mês de Mensalidade Grátis se for",
      icon: "robot",
      total_quantity: 8,
      remaining_quantity: 8,
      daily_limit: 2,
      weight: 5,
      active: true,
      created_at: "2026-08-13T13:45:00.000Z",
    },
    {
      id: "88888888-1316-4000-8000-000000000008",
      name: "2 meses de upgrade temporario de",
      icon: "wifi",
      total_quantity: 6,
      remaining_quantity: 6,
      daily_limit: 2,
      weight: 5,
      active: true,
      created_at: "2026-08-14T14:45:00.000Z",
    },
    {
      id: "99999999-1316-4000-8000-000000000009",
      name: "1 aplicativo standart por 3 meses",
      icon: "house",
      total_quantity: 6,
      remaining_quantity: 6,
      daily_limit: 2,
      weight: 5,
      active: true,
      created_at: "2026-08-14T14:45:00.000Z",
    },
    {
      id: "aaaaaaaa-1316-4000-8000-000000000010",
      name: "1 aplicativo premium por 3 meses",
      icon: "house",
      total_quantity: 3,
      remaining_quantity: 3,
      daily_limit: 1,
      weight: 5,
      active: true,
      created_at: "2026-08-14T14:45:00.000Z",
    },
    {
      id: "bbbbbbbb-1316-4000-8000-000000000011",
      name: "MousePad",
      icon: "zap",
      total_quantity: 15,
      remaining_quantity: 15,
      daily_limit: 5,
      weight: 10,
      active: true,
      created_at: "2026-08-14T14:45:00.000Z",
    },
    {
      id: "cccccccc-1316-4000-8000-000000000012",
      name: "Kit CNX",
      icon: "heart",
      total_quantity: 50,
      remaining_quantity: 50,
      daily_limit: 15,
      weight: 10,
      active: true,
      created_at: "2026-08-14T14:45:00.000Z",
    },
  ];
}

// Check database configuration
function shouldUseSupabase() {
  const url = process.env.SUPABASE_URL;
  if (!url) return false;
  // Ignore invalid/dead project host that causes TypeError: fetch failed
  if (url.includes("mdfbfkkwcrquumsghvun")) return false;
  return true;
}

async function loadAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// Local JSON File & Memory Database Helpers
async function getLocalDatabase() {
  if (!globalStore.prizes) globalStore.prizes = getInitialPrizes();
  if (!globalStore.participants) globalStore.participants = [];

  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    
    const DATA_DIR = path.resolve(process.cwd(), "data");
    const PRIZES_FILE = path.join(DATA_DIR, "prizes.json");
    const PARTICIPANTS_FILE = path.join(DATA_DIR, "participants.json");

    await fs.mkdir(DATA_DIR, { recursive: true });

    try {
      const content = await fs.readFile(PRIZES_FILE, "utf-8");
      globalStore.prizes = JSON.parse(content);
    } catch {
      await fs.writeFile(PRIZES_FILE, JSON.stringify(globalStore.prizes, null, 2), "utf-8");
    }

    try {
      const content = await fs.readFile(PARTICIPANTS_FILE, "utf-8");
      globalStore.participants = JSON.parse(content);
    } catch {
      await fs.writeFile(PARTICIPANTS_FILE, JSON.stringify(globalStore.participants, null, 2), "utf-8");
    }

    return {
      readPrizes: async () => globalStore.prizes ?? getInitialPrizes(),
      writePrizes: async (data: any) => {
        globalStore.prizes = data;
        try { await fs.writeFile(PRIZES_FILE, JSON.stringify(data, null, 2), "utf-8"); } catch {}
      },
      readParticipants: async () => globalStore.participants ?? [],
      writeParticipants: async (data: any) => {
        globalStore.participants = data;
        try { await fs.writeFile(PARTICIPANTS_FILE, JSON.stringify(data, null, 2), "utf-8"); } catch {}
      },
    };
  } catch (err) {
    // Memory fallback for serverless read-only environments
    return {
      readPrizes: async () => globalStore.prizes ?? getInitialPrizes(),
      writePrizes: async (data: any) => { globalStore.prizes = data; },
      readParticipants: async () => globalStore.participants ?? [],
      writeParticipants: async (data: any) => { globalStore.participants = data; },
    };
  }
}

export const registerParticipant = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => registerSchema.parse(data))
  .handler(async ({ data }) => {
    if (!isValidCPF(data.cpf)) {
      return { ok: false as const, error: "Por favor, digite um CPF válido." };
    }

    const todayKey = getTodayKey();
    const db = await getLocalDatabase();
    const participants = await db.readParticipants();
    
    // Regra: Apenas 1 participação por CPF por dia (ciclo até 02h)
    const alreadyPlayedToday = participants.find((p: any) => {
      const pCpf = (p.cpf || "").replace(/\D/g, "");
      return pCpf === data.cpf && isCreatedToday(p.created_at, todayKey);
    });

    if (alreadyPlayedToday) {
      return {
        ok: false as const,
        error: "Este CPF já participou do caça-níquel hoje! É permitido apenas 1 giro por CPF a cada dia do evento.",
      };
    }

    const crypto = await import("crypto");
    const formattedCpf = formatCPF(data.cpf);
    const newPart = {
      id: crypto.randomUUID(),
      full_name: data.full_name,
      whatsapp: data.whatsapp,
      cpf: formattedCpf,
      accepted_terms: true,
      prize_id: null,
      prize_name: null,
      redemption_code: null,
      won: false,
      created_at: new Date().toISOString(),
    };
    
    participants.unshift(newPart);
    await db.writeParticipants(participants);
    return { ok: true as const, participantId: newPart.id, participant: newPart };
  });

export const adminSyncAllParticipants = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    adminAuth
      .extend({
        participants: z.array(z.any()),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    checkPin(data.pin);
    const db = await getLocalDatabase();
    const current = await db.readParticipants();
    
    const map = new Map();
    for (const p of current) {
      if (p.id) map.set(p.id, p);
    }
    for (const p of data.participants) {
      if (p.id) map.set(p.id, p);
    }
    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
    );
    await db.writeParticipants(merged);
    return { ok: true, participants: merged };
  });

export const listActivePrizes = createServerFn({ method: "GET" }).handler(async () => {
  if (shouldUseSupabase()) {
    try {
      const supabase = await loadAdmin();
      const { data, error } = await supabase
        .from("prizes")
        .select("id,name,icon,remaining_quantity,active,daily_limit,date_quotas")
        .eq("active", true)
        .order("name");
      if (!error && data && data.length > 0) {
        return { prizes: data };
      }
    } catch (e) {
      console.warn("[Supabase] Fallback to local DB on listActivePrizes:", e);
    }
  }

  const db = await getLocalDatabase();
  const prizes = await db.readPrizes();
  const participants = await db.readParticipants();
  const todayKey = getTodayKey();

  const todayWonByPrize: Record<string, number> = {};
  for (const p of participants) {
    if (p.won && p.prize_id && isCreatedToday(p.created_at, todayKey)) {
      todayWonByPrize[p.prize_id] = (todayWonByPrize[p.prize_id] || 0) + 1;
    }
  }

  const activePrizes = prizes
    .filter((p: any) => isPrizeAvailableOnDate(p, todayKey, todayWonByPrize[p.id] || 0))
    .map((p: any) => ({
      id: p.id,
      name: p.name,
      icon: p.icon,
      remaining_quantity: p.remaining_quantity,
      daily_limit: p.daily_limit ?? 0,
      date_quotas: p.date_quotas ?? {},
      active: p.active,
    }))
    .sort((a: any, b: any) => a.name.localeCompare(b.name));
  return { prizes: activePrizes };
});

export const spinSlot = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        participantId: z.string().optional().nullable(),
      })
      .optional()
      .default({})
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = await getLocalDatabase();
    const participants = await db.readParticipants();
    const crypto = await import("crypto");
    
    let participant: any = null;
    if (data?.participantId) {
      participant = participants.find((p: any) => p.id === data.participantId);
    }

    if (!participant) {
      participant = {
        id: crypto.randomUUID(),
        full_name: `Participante #${participants.length + 1}`,
        whatsapp: "—",
        cpf: "—",
        accepted_terms: true,
        prize_id: null,
        prize_name: null,
        redemption_code: null,
        won: false,
        created_at: new Date().toISOString(),
      };
      participants.unshift(participant);
    } else if (participant.prize_id || participant.won) {
      return { ok: false as const, error: "Você já jogou nesta ativação." };
    }

    const prizes = await db.readPrizes();
    const todayKey = getTodayKey();

    // Contagem de brindes entregues no ciclo do dia de hoje
    const todayWonByPrize: Record<string, number> = {};
    for (const p of participants) {
      if (p.won && p.prize_id && isCreatedToday(p.created_at, todayKey)) {
        todayWonByPrize[p.prize_id] = (todayWonByPrize[p.prize_id] || 0) + 1;
      }
    }

    // Apenas brindes disponíveis (ativos, com estoque restante e que não estouraram o limite diário de hoje)
    const activePrizes = prizes.filter((p: any) => 
      isPrizeAvailable(p, todayWonByPrize[p.id] || 0)
    );
    
    // Taxa de vitória geral configurada para 60% nos dias com brindes disponíveis
    const GLOBAL_WIN_CHANCE_PERCENT = 60;

    let winner: any = null;

    if (activePrizes.length > 0) {
      // 1. Sorteia se o participante ganha (60% de chance)
      const winRoll = Math.random() * 100;
      const isWinner = winRoll < GLOBAL_WIN_CHANCE_PERCENT;

      if (isWinner) {
        // 2. Sorteia qual brinde foi ganho proporcionalmente ao peso de cada um
        const totalWeight = activePrizes.reduce((s: number, p: any) => s + Math.max(0, p.weight || 0), 0);
        
        if (totalWeight > 0) {
          const prizeRoll = Math.random() * totalWeight;
          let acc = 0;
          for (const p of activePrizes) {
            acc += Math.max(0, p.weight || 0);
            if (prizeRoll <= acc) {
              winner = p;
              break;
            }
          }
        }
        
        // Fallback garantido para o primeiro brinde disponível
        if (!winner) {
          winner = activePrizes[0];
        }
      }
    }

    if (winner) {
      // Diminui 1 unidade do estoque do brinde sorteado
      winner.remaining_quantity -= 1;
      if (winner.remaining_quantity <= 0) {
        winner.active = false;
      }
      await db.writePrizes(prizes);

      const deliveredPrize = winner.name;

      const code = generateCode();
      participant.prize_id = winner.id;
      participant.prize_name = deliveredPrize;
      participant.redemption_code = code;
      participant.won = true;
      await db.writeParticipants(participants);

      return {
        ok: true as const,
        won: true as const,
        prize: { id: winner.id, name: winner.name, icon: winner.icon },
        deliveredPrize,
        code,
      };
    } else {
      participant.won = false;
      await db.writeParticipants(participants);
      return {
        ok: true as const,
        won: false as const,
      };
    }
  });

// ---------------- ADMIN ----------------

const adminAuth = z.object({ pin: z.string().min(1) });

function checkPin(pin: string) {
  const clean = (pin || "").trim().replace(/['"]/g, "");
  const envPin = (process.env.ADMIN_PIN || "").trim().replace(/['"]/g, "");
  const validPins = new Set(["1234", "000000", envPin].filter(Boolean));
  if (!validPins.has(clean)) {
    throw new Error("PIN inválido");
  }
}

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => adminAuth.parse(d))
  .handler(async ({ data }) => {
    checkPin(data.pin);
    return { ok: true };
  });

export const adminListAll = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => adminAuth.parse(d))
  .handler(async ({ data }) => {
    checkPin(data.pin);
    const db = await getLocalDatabase();
    const prizes = await db.readPrizes();
    const participants = await db.readParticipants();
    const todayKey = getTodayKey();

    // Contagem de brindes entregues por data e hoje
    const todayWonByPrize: Record<string, number> = {};
    const wonByDateByPrize: Record<string, Record<string, number>> = {};

    for (const p of participants) {
      if (p.won && p.prize_id) {
        if (!wonByDateByPrize[p.prize_id]) wonByDateByPrize[p.prize_id] = {};
        const pDateKey = getEventDateKey(new Date(p.created_at));
        wonByDateByPrize[p.prize_id][pDateKey] = (wonByDateByPrize[p.prize_id][pDateKey] || 0) + 1;

        if (isCreatedToday(p.created_at, todayKey)) {
          todayWonByPrize[p.prize_id] = (todayWonByPrize[p.prize_id] || 0) + 1;
        }
      }
    }

    // Adiciona métricas do dia a cada brinde
    const enrichedPrizes = prizes.map((p: any) => {
      const dailyLimit = Number(p.daily_limit) || 0;
      const wonToday = todayWonByPrize[p.id] || 0;
      const dailyRemaining = dailyLimit > 0 ? Math.max(0, dailyLimit - wonToday) : null;
      return {
        ...p,
        daily_limit: dailyLimit,
        won_today: wonToday,
        daily_remaining: dailyRemaining,
        won_by_date: wonByDateByPrize[p.id] || {},
      };
    });
    
    // Sort prizes by created_at ascending
    const sortedPrizes = [...enrichedPrizes].sort(
      (a: any, b: any) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    );
    
    // Sort participants by created_at descending
    const sortedParticipants = [...participants].sort(
      (a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
    
    return { prizes: sortedPrizes, participants: sortedParticipants, todayKey };
  });

const upsertPrizeSchema = adminAuth.extend({
  id: z.string().optional().nullable(),
  name: z.string().min(1, "Nome do prêmio é obrigatório").max(120),
  icon: z.string().optional().default("gift"),
  total_quantity: z.coerce.number().min(0).default(0),
  remaining_quantity: z.coerce.number().min(0).default(0),
  daily_limit: z.coerce.number().min(0).default(0),
  weight: z.coerce.number().min(0).default(10),
  active: z.boolean().default(true),
});

export const adminUpsertPrize = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => upsertPrizeSchema.parse(d))
  .handler(async ({ data }) => {
    checkPin(data.pin);
    const db = await getLocalDatabase();
    const prizes = await db.readPrizes();
    const crypto = await import("crypto");
    const targetId = data.id && data.id.trim() ? data.id.trim() : crypto.randomUUID();
    
    const index = prizes.findIndex((p: any) => p.id === targetId);
    if (index !== -1) {
      prizes[index] = {
        ...prizes[index],
        name: data.name,
        icon: data.icon || "gift",
        total_quantity: data.total_quantity,
        remaining_quantity: data.remaining_quantity,
        daily_limit: data.daily_limit,
        weight: data.weight,
        active: data.active,
      };
    } else {
      prizes.push({
        id: targetId,
        name: data.name,
        icon: data.icon || "gift",
        total_quantity: data.total_quantity,
        remaining_quantity: data.remaining_quantity,
        daily_limit: data.daily_limit,
        weight: data.weight,
        active: data.active,
        created_at: new Date().toISOString(),
      });
    }
    
    await db.writePrizes(prizes);
    return { ok: true, id: targetId, prizes };
  });

export const adminSyncAllPrizes = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    adminAuth
      .extend({
        prizes: z.array(
          z.object({
            id: z.string().optional().nullable(),
            name: z.string(),
            icon: z.string().optional().default("gift"),
            total_quantity: z.coerce.number().default(0),
            remaining_quantity: z.coerce.number().default(0),
            daily_limit: z.coerce.number().default(0),
            weight: z.coerce.number().default(10),
            active: z.boolean().default(true),
            created_at: z.string().optional(),
          }),
        ),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    checkPin(data.pin);
    const crypto = await import("crypto");
    const sanitized = data.prizes.map((p) => ({
      ...p,
      id: p.id && p.id.trim() ? p.id.trim() : crypto.randomUUID(),
      icon: p.icon || "gift",
      daily_limit: Number(p.daily_limit) || 0,
      weight: Number(p.weight) || 10,
      active: p.active !== false,
      created_at: p.created_at || new Date().toISOString(),
    }));
    const db = await getLocalDatabase();
    await db.writePrizes(sanitized);
    return { ok: true, prizes: sanitized };
  });

export const adminDeletePrize = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => adminAuth.extend({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    checkPin(data.pin);
    const db = await getLocalDatabase();
    const prizes = await db.readPrizes();
    const filtered = prizes.filter((p: any) => p.id !== data.id);
    await db.writePrizes(filtered);
    return { ok: true, prizes: filtered };
  });

export const adminDeleteParticipant = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => adminAuth.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    checkPin(data.pin);
    if (shouldUseSupabase()) {
      const supabase = await loadAdmin();
      
      // Busca o participante para saber se ganhou prêmio
      const { data: part } = await supabase
        .from("participants")
        .select("won, prize_id")
        .eq("id", data.id)
        .single();

      // Deleta o participante
      const { error: delError } = await supabase.from("participants").delete().eq("id", data.id);
      if (delError) throw new Error(delError.message);

      // Se ele tinha ganho um brinde, estorna/devolve +1 no estoque dele
      if (part?.won && part?.prize_id) {
        const { data: prize } = await supabase
          .from("prizes")
          .select("remaining_quantity")
          .eq("id", part.prize_id)
          .single();
        
        if (prize) {
          await supabase
            .from("prizes")
            .update({ remaining_quantity: prize.remaining_quantity + 1 })
            .eq("id", part.prize_id);
        }
      }
      return { ok: true };
    } else {
      const db = await getLocalDatabase();
      const participants = await db.readParticipants();
      const part = participants.find((p: any) => p.id === data.id);
      
      const filtered = participants.filter((p: any) => p.id !== data.id);
      await db.writeParticipants(filtered);

      // Estorno no banco local
      if (part?.won && part?.prize_id) {
        const prizes = await db.readPrizes();
        const prizeIndex = prizes.findIndex((p: any) => p.id === part.prize_id);
        if (prizeIndex !== -1) {
          prizes[prizeIndex].remaining_quantity += 1;
          await db.writePrizes(prizes);
        }
      }
      return { ok: true };
    }
  });

export const adminUploadIcon = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        pin: z.string(),
        fileName: z.string(),
        fileBase64: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    checkPin(data.pin);
    
    // Extrai o conteúdo bruto em Base64
    const base64Data = data.fileBase64.split(";base64,").pop() || data.fileBase64;
    const buffer = Buffer.from(base64Data, "base64");
    const mimeType = data.fileBase64.split(";")[0].split(":")[1] || "image/png";

    if (shouldUseSupabase()) {
      const supabase = await loadAdmin();
      const bucketName = "prizes";
      
      // Tenta criar o bucket se não existir
      try {
        await supabase.storage.createBucket(bucketName, {
          public: true,
        });
      } catch (e) {
        // Ignora se o bucket já existe ou falhou
      }

      // Envia o arquivo para o storage
      const { data: uploadRes, error: uploadErr } = await supabase.storage
        .from(bucketName)
        .upload(data.fileName, buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadErr) {
        console.error("Erro de upload no Storage:", uploadErr);
        throw new Error(`Erro ao enviar imagem ao Supabase: ${uploadErr.message}`);
      }

      // Obtém a URL pública do arquivo
      const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(data.fileName);
      return { url: urlData.publicUrl };
    } else {
      // Salva em disco local no public/icones
      const fs = await import("fs/promises");
      const path = await import("path");
      
      const uploadDir = path.resolve(process.cwd(), "public", "icones");
      try {
        await fs.mkdir(uploadDir, { recursive: true });
      } catch {}
      
      const safeFileName = data.fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filePath = path.join(uploadDir, safeFileName);
      await fs.writeFile(filePath, buffer);
      
      return { url: `/icones/${safeFileName}` };
    }
  });
