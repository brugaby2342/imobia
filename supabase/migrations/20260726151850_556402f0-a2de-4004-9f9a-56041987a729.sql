ALTER TABLE public.imovel_fotos DROP CONSTRAINT IF EXISTS imovel_fotos_imovel_id_fkey;
ALTER TABLE public.imovel_fotos
  ADD CONSTRAINT imovel_fotos_imovel_id_fkey
  FOREIGN KEY (imovel_id) REFERENCES public.imoveis(id) ON DELETE CASCADE;

ALTER TABLE public.documentos DROP CONSTRAINT IF EXISTS documentos_imovel_id_fkey;
ALTER TABLE public.documentos
  ADD CONSTRAINT documentos_imovel_id_fkey
  FOREIGN KEY (imovel_id) REFERENCES public.imoveis(id) ON DELETE SET NULL;