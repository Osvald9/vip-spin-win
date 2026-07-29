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

function getInitialPrizes() {
  return [
    {
      id: "1647a8fb-0863-49d6-b8db-bd4f6a7d8bb1",
      name: "Copo Térmico",
      icon: "zap",
      total_quantity: 50,
      remaining_quantity: 50,
      weight: 30,
      active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: "2747a8fb-0863-49d6-b8db-bd4f6a7d8bb2",
      name: "Copo Plástico",
      icon: "heart",
      total_quantity: 100,
      remaining_quantity: 100,
      weight: 50,
      active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: "3847a8fb-0863-49d6-b8db-bd4f6a7d8bb3",
      name: "Boné",
      icon: "robot",
      total_quantity: 30,
      remaining_quantity: 30,
      weight: 20,
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
        .select("id,name,icon,remaining_quantity,active")
        .eq("active", true)
        .order("name");
      if (!error && data && data.length > 0) {
        return { prizes: data };
      }
    } catch (e) {
      console.warn("[Supabase] Fallback to local DB on listActivePrizes:", e);
    }
  } else {
    const db = await getLocalDatabase();
    const prizes = await db.readPrizes();
    const activePrizes = prizes
      .filter((p: any) => p.active)
      .map((p: any) => ({
        id: p.id,
        name: p.name,
        icon: p.icon,
        remaining_quantity: p.remaining_quantity,
        active: p.active,
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
    return { prizes: activePrizes };
  }
});

export const spinSlot = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ participantId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    if (shouldUseSupabase()) {
      try {
        const supabase = await loadAdmin();
        const { data: participant } = await supabase
          .from("participants")
          .select("id, won, prize_id")
          .eq("id", data.participantId)
          .maybeSingle();
        if (participant) {
          if (participant.prize_id || participant.won) {
            return { ok: false as const, error: "Você já jogou nesta ativação." };
          }

          const pool = [
            { name: "Copo Térmico", icon: "zap", weight: 30 },
            { name: "Copo Plástico", icon: "heart", weight: 50 },
            { name: "Boné", icon: "robot", weight: 20 },
          ];

          const totalWeight = pool.reduce((s, p) => s + p.weight, 0);
          const roll = Math.random() * totalWeight;
          let acc = 0;
          let winner = pool[0];
          
          for (const p of pool) {
            acc += p.weight;
            if (roll <= acc) {
              winner = p;
              break;
            }
          }

          const code = generateCode();
          
          const { error: updateError } = await supabase
            .from("participants")
            .update({
              prize_id: null,
              prize_name: winner.name,
              redemption_code: code,
              won: true,
            })
            .eq("id", data.participantId);
            
          if (!updateError) {
            return {
              ok: true as const,
              won: true as const,
              prize: { id: "temp-" + Date.now(), name: winner.name, icon: winner.icon },
              code,
            };
          }
        }
      } catch (e) {
        console.warn("[Supabase] Fallback to local DB on spinSlot:", e);
      }
    } else {
      const db = await getLocalDatabase();
      const participants = await db.readParticipants();
      const participant = participants.find((p: any) => p.id === data.participantId);
      if (!participant) return { ok: false as const, error: "Participante não encontrado" };
      if (participant.prize_id || participant.won) {
        return { ok: false as const, error: "Você já jogou nesta ativação." };
      }

      const pool = [
        { id: "1", name: "Copo Térmico", icon: "zap", weight: 30 },
        { id: "2", name: "Copo Plástico", icon: "heart", weight: 50 },
        { id: "3", name: "Boné", icon: "robot", weight: 20 },
      ];
      const totalWeight = pool.reduce((s: number, p: any) => s + p.weight, 0);

      const roll = Math.random() * totalWeight;
      let acc = 0;
      let winner = pool[0];
      for (const p of pool) {
        acc += p.weight;
        if (roll <= acc) {
          winner = p;
          break;
        }
      }

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
    if (shouldUseSupabase()) {
      try {
        const supabase = await loadAdmin();
        const [{ data: prizes, error: prizesError }, { data: participants, error: partsError }] = await Promise.all([
          supabase.from("prizes").select("*").order("created_at"),
          supabase.from("participants").select("*").order("created_at", { ascending: false }),
        ]);
        if (!prizesError && !partsError) {
          return { prizes: prizes ?? [], participants: participants ?? [] };
        }
      } catch (e) {
        console.warn("[Supabase] Fallback to local DB on adminListAll:", e);
      }
    } else {
      const db = await getLocalDatabase();
      const prizes = await db.readPrizes();
      const participants = await db.readParticipants();
      
      // Sort prizes by created_at ascending
      const sortedPrizes = [...prizes].sort(
        (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      
      // Sort participants by created_at descending
      const sortedParticipants = [...participants].sort(
        (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      return { prizes: sortedPrizes, participants: sortedParticipants };
    }
  });

const upsertPrizeSchema = adminAuth.extend({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  icon: z.string().min(1).max(40),
  total_quantity: z.number().int().min(0).max(100000),
  remaining_quantity: z.number().int().min(0).max(100000),
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
    } else {
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
          weight: data.weight,
          active: data.active,
          created_at: new Date().toISOString(),
        });
      }
      
      await db.writePrizes(prizes);
      return { ok: true };
    }
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
