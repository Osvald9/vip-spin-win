
CREATE TABLE public.prizes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'gift',
  total_quantity INTEGER NOT NULL DEFAULT 0,
  remaining_quantity INTEGER NOT NULL DEFAULT 0,
  weight INTEGER NOT NULL DEFAULT 10,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.prizes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prizes TO authenticated;
GRANT ALL ON public.prizes TO service_role;
ALTER TABLE public.prizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active prizes" ON public.prizes FOR SELECT USING (true);

CREATE TABLE public.participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  whatsapp TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  accepted_terms BOOLEAN NOT NULL DEFAULT false,
  prize_id UUID REFERENCES public.prizes(id) ON DELETE SET NULL,
  prize_name TEXT,
  redemption_code TEXT,
  won BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.participants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.participants TO authenticated;
GRANT ALL ON public.participants TO service_role;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert participants" ON public.participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read participants" ON public.participants FOR SELECT USING (true);

INSERT INTO public.prizes (name, icon, total_quantity, remaining_quantity, weight) VALUES
  ('Kit Conexão VIP', 'gift', 20, 20, 10),
  ('Camiseta VIP', 'shirt', 30, 30, 20),
  ('Adesivo VIP', 'sticker', 100, 100, 40),
  ('1 Mês de Internet Grátis', 'wifi', 3, 3, 2),
  ('Caneca Conexão VIP', 'coffee', 15, 15, 8);
