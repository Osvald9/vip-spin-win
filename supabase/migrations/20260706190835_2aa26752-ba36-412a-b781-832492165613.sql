
DROP POLICY IF EXISTS "Anyone can insert participants" ON public.participants;
CREATE POLICY "Insert only with terms accepted" ON public.participants
  FOR INSERT WITH CHECK (accepted_terms = true AND length(full_name) > 0 AND length(whatsapp) > 0);
