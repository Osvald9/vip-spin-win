import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const registerSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  whatsapp: z
    .string()
    .trim()
    .min(8)
    .max(30)
    .transform((v) => v.replace(/\D/g, "")),
  city: z.string().trim().min(2).max(80),
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

function getEffectiveDailyLimit(prize: any, dateKey: string): number {
  const quotas = prize?.date_quotas;
  const hasSpecificDates = quotas && typeof quotas === "object" && Object.keys(quotas).length > 0;

  if (hasSpecificDates) {
    if (typeof quotas[dateKey] === "number") {
      return Number(quotas[dateKey]);
    }
    return 0; // Se possui datas específicas e a data atual não está configurada, cota = 0
  }

  return Number(prize?.daily_limit) || 0;
}

function isPrizeAvailableOnDate(prize: any, dateKey: string, wonToday: number): boolean {
  if (!prize.active || prize.remaining_quantity <= 0) return false;

  const quotas = prize.date_quotas;
  const hasSpecificDates = quotas && typeof quotas === "object" && Object.keys(quotas).length > 0;

  if (hasSpecificDates) {
    // Se possui agendamento por data, só pode sair nas datas configuradas
    const dateQuota = quotas[dateKey];
    if (typeof dateQuota !== "number" || dateQuota <= 0) {
      return false;
    }
    if (wonToday >= dateQuota) {
      return false;
    }
    return true;
  }

  // Sem agendamento por data: usa o limite diário padrão se houver
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
      created_at: new Date().toISOString(),
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
      created_at: new Date().toISOString(),
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
      created_at: new Date().toISOString(),
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
      created_at: new Date().toISOString(),
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
      created_at: new Date().toISOString(),
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
      created_at: new Date().toISOString(),
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
      created_at: new Date().toISOString(),
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
    if (shouldUseSupabase()) {
      try {
        const supabase = await loadAdmin();
        const { data: existing } = await supabase
          .from("participants")
          .select("id")
          .eq("whatsapp", data.whatsapp)
          .maybeSingle();
        if (existing) {
          return { ok: false as const, error: "Este WhatsApp já participou desta ativação." };
        }
        const { data: created, error } = await supabase
          .from("participants")
          .insert({
            full_name: data.full_name,
            whatsapp: data.whatsapp,
            city: data.city,
            accepted_terms: true,
          })
          .select()
          .single();
        if (!error && created) {
          return { ok: true as const, participantId: created.id };
        }
      } catch (e) {
        console.warn("[Supabase] Fallback to local DB on register:", e);
      }
    } else {
      const db = await getLocalDatabase();
      const participants = await db.readParticipants();
      const existing = participants.find((p: any) => p.whatsapp === data.whatsapp);
      if (existing) {
        return { ok: false as const, error: "Este WhatsApp já participou desta ativação." };
      }
      const crypto = await import("crypto");
      const newPart = {
        id: crypto.randomUUID(),
        full_name: data.full_name,
        whatsapp: data.whatsapp,
        city: data.city,
        accepted_terms: true,
        prize_id: null,
        prize_name: null,
        redemption_code: null,
        won: false,
        created_at: new Date().toISOString(),
      };
      participants.push(newPart);
      await db.writeParticipants(participants);
      return { ok: true as const, participantId: newPart.id };
    }
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
  .inputValidator((data: unknown) => z.object({ participantId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const db = await getLocalDatabase();
    const participants = await db.readParticipants();
    const participant = participants.find((p: any) => p.id === data.participantId);
    if (!participant) return { ok: false as const, error: "Participante não encontrado" };
    if (participant.prize_id || participant.won) {
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

    // Apenas brindes disponíveis exatamente na data de hoje
    const activePrizes = prizes.filter((p: any) => 
      isPrizeAvailableOnDate(p, todayKey, todayWonByPrize[p.id] || 0)
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

      const code = generateCode();
      participant.prize_id = winner.id;
      participant.prize_name = winner.name;
      participant.redemption_code = code;
      participant.won = true;
      await db.writeParticipants(participants);

      return {
        ok: true as const,
        won: true as const,
        prize: { id: winner.id, name: winner.name, icon: winner.icon },
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
  const expected = process.env.ADMIN_PIN;
  if (!expected) throw new Error("PIN administrativo não configurado");
  if (pin !== expected) throw new Error("PIN inválido");
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

    // Adiciona métricas do dia e cotas por data a cada brinde
    const enrichedPrizes = prizes.map((p: any) => {
      const effectiveLimitToday = getEffectiveDailyLimit(p, todayKey);
      const wonToday = todayWonByPrize[p.id] || 0;
      const dailyRemaining = effectiveLimitToday > 0 ? Math.max(0, effectiveLimitToday - wonToday) : null;
      return {
        ...p,
        daily_limit: Number(p.daily_limit) || 0,
        date_quotas: p.date_quotas ?? {},
        effective_limit_today: effectiveLimitToday,
        won_today: wonToday,
        daily_remaining: dailyRemaining,
        won_by_date: wonByDateByPrize[p.id] || {},
      };
    });
    
    // Sort prizes by created_at ascending
    const sortedPrizes = [...enrichedPrizes].sort(
      (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    // Sort participants by created_at descending
    const sortedParticipants = [...participants].sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    return { prizes: sortedPrizes, participants: sortedParticipants, todayKey };
  });

const upsertPrizeSchema = adminAuth.extend({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  icon: z.string().min(1).max(40),
  total_quantity: z.number().int().min(0).max(100000),
  remaining_quantity: z.number().int().min(0).max(100000),
  daily_limit: z.number().int().min(0).max(100000).optional().default(0),
  date_quotas: z.record(z.string(), z.number().int().min(0)).optional().default({}),
  weight: z.number().int().min(1).max(1000),
  active: z.boolean(),
});

export const adminUpsertPrize = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => upsertPrizeSchema.parse(d))
  .handler(async ({ data }) => {
    checkPin(data.pin);
    if (shouldUseSupabase()) {
      try {
        const supabase = await loadAdmin();
        const payload = {
          name: data.name,
          icon: data.icon,
          total_quantity: data.total_quantity,
          remaining_quantity: data.remaining_quantity,
          daily_limit: data.daily_limit ?? 0,
          date_quotas: data.date_quotas ?? {},
          weight: data.weight,
          active: data.active,
        };
        if (data.id) {
          const { error } = await supabase.from("prizes").update(payload).eq("id", data.id);
          if (!error) return { ok: true };
        } else {
          const crypto = await import("crypto");
          const insertPayload = { id: crypto.randomUUID(), ...payload };
          const { error } = await supabase.from("prizes").insert(insertPayload);
          if (!error) return { ok: true };
        }
      } catch (e) {
        console.warn("[Supabase] Fallback to local DB on adminUpsertPrize:", e);
      }
    }

    const db = await getLocalDatabase();
    const prizes = await db.readPrizes();
    
    if (data.id) {
      const index = prizes.findIndex((p: any) => p.id === data.id);
      if (index !== -1) {
        prizes[index] = {
          ...prizes[index],
          name: data.name,
          icon: data.icon,
          total_quantity: data.total_quantity,
          remaining_quantity: data.remaining_quantity,
          daily_limit: data.daily_limit ?? 0,
          date_quotas: data.date_quotas ?? {},
          weight: data.weight,
          active: data.active,
        };
      }
    } else {
      const crypto = await import("crypto");
      prizes.push({
        id: crypto.randomUUID(),
        name: data.name,
        icon: data.icon,
        total_quantity: data.total_quantity,
        remaining_quantity: data.remaining_quantity,
        daily_limit: data.daily_limit ?? 0,
        date_quotas: data.date_quotas ?? {},
        weight: data.weight,
        active: data.active,
        created_at: new Date().toISOString(),
      });
    }
    
    await db.writePrizes(prizes);
    return { ok: true };
  });

export const adminDeletePrize = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => adminAuth.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    checkPin(data.pin);
    if (shouldUseSupabase()) {
      try {
        const supabase = await loadAdmin();
        const { error } = await supabase.from("prizes").delete().eq("id", data.id);
        if (!error) return { ok: true };
      } catch (e) {
        console.warn("[Supabase] Fallback to local DB on adminDeletePrize:", e);
      }
    } else {
      const db = await getLocalDatabase();
      const prizes = await db.readPrizes();
      const filtered = prizes.filter((p: any) => p.id !== data.id);
      await db.writePrizes(filtered);
      return { ok: true };
    }
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
