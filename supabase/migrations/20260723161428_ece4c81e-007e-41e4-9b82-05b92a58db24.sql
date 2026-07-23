
-- Admin write policies on media tables
CREATE POLICY imovel_fotos_insert_admin ON public.imovel_fotos
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin(auth.uid()));
CREATE POLICY imovel_fotos_update_admin ON public.imovel_fotos
  FOR UPDATE TO authenticated
  USING (private.is_admin(auth.uid()))
  WITH CHECK (private.is_admin(auth.uid()));
CREATE POLICY imovel_fotos_delete_admin ON public.imovel_fotos
  FOR DELETE TO authenticated
  USING (private.is_admin(auth.uid()));

CREATE POLICY documentos_insert_admin ON public.documentos
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin(auth.uid()));
CREATE POLICY documentos_update_admin ON public.documentos
  FOR UPDATE TO authenticated
  USING (private.is_admin(auth.uid()))
  WITH CHECK (private.is_admin(auth.uid()));
CREATE POLICY documentos_delete_admin ON public.documentos
  FOR DELETE TO authenticated
  USING (private.is_admin(auth.uid()));

-- Storage RLS: imovel_fotos (public bucket - SELECT already public via anon; add explicit)
CREATE POLICY "imovel_fotos storage select public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'imovel_fotos');
CREATE POLICY "imovel_fotos storage insert admin"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'imovel_fotos' AND private.is_admin(auth.uid()));
CREATE POLICY "imovel_fotos storage update admin"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'imovel_fotos' AND private.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'imovel_fotos' AND private.is_admin(auth.uid()));
CREATE POLICY "imovel_fotos storage delete admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'imovel_fotos' AND private.is_admin(auth.uid()));

-- Storage RLS: documentos (private bucket)
CREATE POLICY "documentos storage select authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documentos');
CREATE POLICY "documentos storage insert admin"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos' AND private.is_admin(auth.uid()));
CREATE POLICY "documentos storage update admin"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documentos' AND private.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'documentos' AND private.is_admin(auth.uid()));
CREATE POLICY "documentos storage delete admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documentos' AND private.is_admin(auth.uid()));
