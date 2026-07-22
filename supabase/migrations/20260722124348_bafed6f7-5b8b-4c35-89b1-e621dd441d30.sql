CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.is_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND role = 'admin')
$$;

REVOKE EXECUTE ON FUNCTION private.is_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_admin(uuid) TO postgres, service_role;

DROP POLICY IF EXISTS profiles_select_own_or_admin ON public.profiles;
CREATE POLICY profiles_select_own_or_admin ON public.profiles
  FOR SELECT TO authenticated
  USING ((id = auth.uid()) OR private.is_admin(auth.uid()));

DROP FUNCTION IF EXISTS public.is_admin(uuid);