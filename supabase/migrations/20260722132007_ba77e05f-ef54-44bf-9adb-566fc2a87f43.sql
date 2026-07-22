GRANT INSERT, UPDATE, DELETE ON public.imoveis TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.imoveis_id_seq TO authenticated;

CREATE POLICY imoveis_insert_admin ON public.imoveis
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin(auth.uid()));

CREATE POLICY imoveis_update_admin ON public.imoveis
  FOR UPDATE TO authenticated
  USING (private.is_admin(auth.uid()))
  WITH CHECK (private.is_admin(auth.uid()));

CREATE POLICY imoveis_delete_admin ON public.imoveis
  FOR DELETE TO authenticated
  USING (private.is_admin(auth.uid()));