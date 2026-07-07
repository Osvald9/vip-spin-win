-- Grant full permissions to anon for prizes and participants
GRANT ALL ON public.prizes TO anon;
GRANT ALL ON public.participants TO anon;

-- Update RLS policies to allow anon read/write operations
DROP POLICY IF EXISTS "Anyone can view active prizes" ON public.prizes;
CREATE POLICY "Anyone can do everything on prizes" ON public.prizes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can insert participants" ON public.participants;
DROP POLICY IF EXISTS "Anyone can read participants" ON public.participants;
CREATE POLICY "Anyone can do everything on participants" ON public.participants FOR ALL USING (true) WITH CHECK (true);
