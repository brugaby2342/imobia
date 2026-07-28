# Notas de Desenvolvimento - ImobIA

## Estado Confirmado em 28/07/2026

- Auth + RBAC (admin/corretor) com gate de rotas `_authenticated`.
- CRUD de imóveis.
- Busca em linguagem natural via Gemini 2.5 Flash em `/api/chat`, com cards.
- Busca textual na descrição do imóvel com `ilike`, ignorando acentos e caixa, combinável com filtros estruturados na mesma consulta.
- Consulta da IA ao conteúdo dos documentos via coluna de texto, sem exigir que o usuário cite o nome do documento; a resposta indica o documento de origem e cobre documentos institucionais e vinculados a imóvel.
- Upload de fotos com sequencial calculado por maior número + 1, não por contagem, evitando colisão após exclusões no meio da sequência.
- Ordem estável das fotos na galeria, na listagem e nos cards; a primeira foto é a capa.
- Exclusão de foto removendo o arquivo do Storage, com retorno vazio de `remove()` tratado como erro real e não como arquivo inexistente.
- Exclusão de imóvel com FK em cascata (`imovel_fotos`) e `SET NULL` (`documentos`).
- Toasts de sucesso e erro.
- Sanitização de nome de arquivo com `decodeURIComponent` -> `normalize NFD` -> regex.
- Campo de upload de fotos sempre visível na edição, com estado vazio.
- Estado de sucesso após cadastro, sem redirecionar para o chat.
- Foto de capa no card do resultado da pesquisa, trazida na mesma consulta.
- Módulo independente de documentos, com vínculo opcional a imóvel.
- Item de navegação para a listagem de imóveis renderizado também para o perfil corretor.
- Listagem em modo leitura para o corretor, sem botão `Novo imóvel` nem ícones de editar e excluir.
- Modal de detalhe do imóvel reaproveitado na listagem, abrindo o mesmo componente dos cards do chat ao clicar na linha, sem conflito com editar ou excluir.
- RLS nas tabelas e nos buckets.

## Causa Raiz Resolvida

- Faltava política de `SELECT` em `storage.objects` para o bucket `imovel_fotos`.
- Sem ela, a API de Storage não localizava o objeto: `remove()` retornava vazio sem erro e `list()` usado no cálculo do sequencial via zero arquivos, gerando colisão de nome.
- O bucket público mascarava o problema, porque leitura por URL pública não passa por RLS; apenas operações autenticadas falhavam.
- Corrigido manualmente via `CREATE POLICY` para `authenticated`, sem Lovable.
- A política foi mantida apesar do aviso genérico do Supabase sobre "Clients can list all files", porque esse alerta quebraria a exclusão e o upload se aplicado ao pé da letra.
- A listagem ficou restrita a `authenticated` (corretor e admin); a escrita segue restrita a admin via `private.is_admin()`.

## Pendências Ativas

### Alta prioridade

1. Card expansível: ao clicar, abrir modal com galeria navegável das demais fotos, todas as informações e a descrição completa, hoje truncada no card, mais documentos vinculados com ícone de download.

### Prioridade média

2. Bloco de documentos ainda presente na rota `/imoveis/novo`: remover por completo upload, lista e estado vazio.
3. Após upload de foto na tela de edição, a única ação oferecida é voltar ao chat: incluir `Cadastrar outro imóvel` e `Voltar à listagem`.
4. Campo de conteúdo (`textarea`) no formulário de cadastro e edição de documento: hoje o texto que a IA consulta só pode ser preenchido direto no banco. Sem extração automática de PDF, fora de escopo.

### Prioridade baixa

5. Tela de cadastro de documento: manter apenas cadastrar novo, remover o botão `Voltar à listagem`.
6. Substituir as perguntas de exemplo do chat por três que cubram capacidades distintas: filtro estruturado, busca na descrição e consulta a conteúdo de documento.

## Fora do Lovable

- Verificar RBAC pela interface com usuário de perfil corretor: confirmar que a busca e as fotos funcionam e que as telas de cadastro/edição estão bloqueadas.
- Excluir os imóveis de teste, com descrição iniciando em `TESTE`, removendo antes os arquivos do Storage.

## Decisão de Ferramenta Registrada

- Enquanto o Lovable teve créditos disponíveis, ele foi a única ferramenta a editar código para evitar duas fontes concorrentes de alteração sobre a mesma base; ele auto-commita no repositório a cada prompt aprovado.
- Esgotado o limite, alterações restritas ao frontend, sem migrations e sem mudança de políticas RLS, passaram a ser feitas localmente via Copilot.
- O critério foi o raio de alcance da mudança, não a dificuldade; alterações de esquema permanecem concentradas no Lovable.

## Verificação Relevante

- Confirmado que o corretor já alcançava a rota da listagem digitando a URL mesmo com o link de navegação oculto, sem falha de segurança, porque as políticas de RLS continuavam aplicáveis.
- Registro prático de que ocultar elemento de interface não constitui controle de acesso.

## Observação de Ambiente Local

- O arquivo `src/routeTree.gen.ts` é regerado pelo plugin do TanStack Router a cada execução e aparece como modificado por reordenação de imports; não commitar, salvo quando houver rota nova de fato.

## Encerrado sem Correção

- `Fotos do seed não aparecem`: verificado por SQL; a integridade está confirmada, todo `caminho_arquivo` aponta para arquivo existente e o número do arquivo corresponde ao `imovel_id`. Os imóveis sem foto eram apenas os de teste. Não havia bug.

## Decisões Arquiteturais Registradas

- Upload de fotos só é liberado depois que o imóvel existe, porque o `id` é necessário para a nomenclatura e para o vínculo.
- Consulta a documentos usa coluna de texto, não embeddings; `pgvector` fica como evolução futura, justificada pelo volume de documentos.
- Especialização por tools (`buscar_imoveis` e busca em documentos) com uma única chamada ao modelo; orquestração multiagente permanece condicional ao portão de decisão de 28/07 já registrado.

## Observações

- Este arquivo deve permanecer consistente com [docs/memoria-projeto.json](/Users/brunagabrielaribeirosartor/imobia/docs/memoria-projeto.json) para evitar divergência de estado.
