
-- profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  nome text,
  role text NOT NULL DEFAULT 'corretor' CHECK (role IN ('corretor','admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- security-definer admin check (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND role = 'admin')
$$;

CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()));

-- Users can update their own name but cannot change their role
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()));

-- Trigger: auto-create profile on new auth user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', NULL));
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Lock down existing tables to authenticated users only
DROP POLICY IF EXISTS "Leitura publica de imoveis" ON public.imoveis;
CREATE POLICY "imoveis_select_authenticated" ON public.imoveis
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.imoveis FROM anon;

DROP POLICY IF EXISTS "Leitura publica de fotos" ON public.imovel_fotos;
CREATE POLICY "imovel_fotos_select_authenticated" ON public.imovel_fotos
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.imovel_fotos FROM anon;

DROP POLICY IF EXISTS "Leitura publica de documentos" ON public.documentos;
CREATE POLICY "documentos_select_authenticated" ON public.documentos
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.documentos FROM anon;
