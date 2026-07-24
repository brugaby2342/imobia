
SELECT setval(
  pg_get_serial_sequence('public.imovel_fotos', 'id'),
  COALESCE((SELECT MAX(id) FROM public.imovel_fotos), 0) + 1,
  false
);

SELECT setval(
  pg_get_serial_sequence('public.documentos', 'id'),
  COALESCE((SELECT MAX(id) FROM public.documentos), 0) + 1,
  false
);
