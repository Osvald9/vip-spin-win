import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LOSS_WEIGHT = 100;

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

async function loadAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const registerParticipant = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => registerSchema.parse(data))
  .handler(async ({ data }) => {
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
    if (error || !created) {
      return { ok: false as const, error: "Não foi possível cadastrar. Tente novamente." };
    }
    return { ok: true as const, participantId: created.id };
  });

export const listActivePrizes = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = await loadAdmin();
  const { data } = await supabase
    .from("prizes")
    .select("id,name,icon,remaining_quantity,active")
    .eq("active", true)
    .order("name");
  return { prizes: data ?? [] };
});

export const spinSlot = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ participantId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const supabase = await loadAdmin();
    const { data: participant } = await supabase
      .from("participants")
      .select("id, won, prize_id")
      .eq("id", data.participantId)
      .maybeSingle();
    if (!participant) return { ok: false as const, error: "Participante não encontrado" };
    if (participant.prize_id || participant.won) {
      return { ok: false as const, error: "Você já jogou nesta ativação." };
    }

    const { data: prizes } = await supabase
      .from("prizes")
      .select("id,name,icon,remaining_quantity,weight,active")
      .eq("active", true)
      .gt("remaining_quantity", 0);

    const pool = prizes ?? [];
    const totalWeight = pool.reduce((s, p) => s + Math.max(1, p.weight), 0);
    const totalWithLoss = totalWeight + LOSS_WEIGHT;

    let winner: (typeof pool)[number] | null = null;
    if (pool.length > 0) {
      const roll = Math.random() * totalWithLoss;
      let acc = 0;
      for (const p of pool) {
        acc += Math.max(1, p.weight);
        if (roll <= acc) {
          winner = p;
          break;
        }
      }
    }

    if (winner) {
      // Atomic decrement guard
      const { data: dec } = await supabase
        .from("prizes")
        .update({ remaining_quantity: winner.remaining_quantity - 1 })
        .eq("id", winner.id)
        .gt("remaining_quantity", 0)
        .select()
        .maybeSingle();
      if (!dec) winner = null;
      else if (dec.remaining_quantity <= 0) {
        // auto-close prize
        await supabase.from("prizes").update({ active: false }).eq("id", winner.id);
      }
    }

    if (winner) {
      const code = generateCode();
      await supabase
        .from("participants")
        .update({
          prize_id: winner.id,
          prize_name: winner.name,
          redemption_code: code,
          won: true,
        })
        .eq("id", data.participantId);
      return {
        ok: true as const,
        won: true as const,
        prize: { id: winner.id, name: winner.name, icon: winner.icon },
        code,
      };
    }

    await supabase.from("participants").update({ won: false }).eq("id", data.participantId);
    return { ok: true as const, won: false as const };
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
    const supabase = await loadAdmin();
    const [{ data: prizes }, { data: participants }] = await Promise.all([
      supabase.from("prizes").select("*").order("created_at"),
      supabase.from("participants").select("*").order("created_at", { ascending: false }),
    ]);
    return { prizes: prizes ?? [], participants: participants ?? [] };
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
      await supabase.from("prizes").update(payload).eq("id", data.id);
    } else {
      await supabase.from("prizes").insert(payload);
    }
    return { ok: true };
  });

export const adminDeletePrize = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => adminAuth.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    checkPin(data.pin);
    const supabase = await loadAdmin();
    await supabase.from("prizes").delete().eq("id", data.id);
    return { ok: true };
  });
