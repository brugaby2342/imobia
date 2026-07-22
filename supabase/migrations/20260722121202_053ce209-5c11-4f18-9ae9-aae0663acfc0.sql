
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
-- authenticated keeps EXECUTE so RLS policies using public.is_admin(auth.uid()) work
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
