# Notas de Desenvolvimento - ImobIA

## Estado Confirmado em 26/07/2026

- Auth + RBAC (admin/corretor) com gate nas rotas `_authenticated`.
- CRUD de imóveis.
- Busca em linguagem natural via Gemini 2.5 Flash em `/api/chat`, com cards.
- Upload de fotos no bucket `imovel_fotos`, público, com nomenclatura `imovel_{id 3 dígitos}_{sequencial}.{extensao}` na raiz do bucket.
- Campo de upload de fotos sempre visível na edição, com estado vazio.
- Estado de sucesso após cadastro, sem redirecionar para o chat.
- Toasts de sucesso e erro.
- Sanitização de nome de arquivo com `decodeURIComponent` -> `normalize('NFD')` removendo diacríticos -> regex `[\w.-]`.
- Foto de capa exibida no card do resultado da pesquisa, trazida na mesma consulta da tool `buscar_imoveis`.
- Módulo independente de documentos, com vínculo opcional a imóvel.
- RLS nas tabelas `imoveis`, `imovel_fotos`, `documentos`, `profiles` e nos buckets.

## Pendências Ativas

### Alta prioridade

1. Corrigir a exclusão de imóvel que hoje falha por FK em `imovel_fotos` sem `ON DELETE CASCADE`.
2. Remover o bloco de upload de documentos do formulário de cadastro de imóvel.
3. Implementar consulta da IA ao conteúdo de documentos via coluna `conteudo text`, com tool que filtre por palavra-chave e/ou `imovel_id` e devolva o texto ao modelo.

### Prioridade média

6. Abrir modal de detalhe do imóvel com galeria das demais fotos e descrição integral.
7. Após cadastrar foto na edição, oferecer também `Cadastrar outro imóvel` e `Voltar à listagem`.
8. Omitir itens com valor 0, sem mostrar `0 quartos` ou `0 suítes`.

### Prioridade baixa

9. No cadastro de documento, manter só a ação de cadastrar novo e remover o botão `Voltar à listagem`.
10. Substituir as perguntas de exemplo do chat por três novas que demonstrem melhor as capacidades da aplicação.

## Item Condicional

- Agentes especializados: decisão postergada com portão de decisão. Hoje a especialização existe em nível de tools, não de agentes. A arquitetura atual segue com uma única chamada ao Gemini 2.5 Flash em `/api/chat`, com as tools `buscar_imoveis` e busca em documentos, e o modelo decide qual chamar.
- Escopo mínimo previsto, mas não tratado como nova arquitetura: descritivos de tool delimitando explicitamente o domínio de cada uma e prompt de sistema com seções separadas por especialidade, incluindo regras de resposta para imóveis e para documentos, com citação do documento de origem.
- Escopo multiagente não aprovado: orquestrador com dois agentes, prompts separados e chamadas separadas ao modelo.
- Portão de decisão em 28/07/2026: só considerar orquestração real se as prioridades altas 1 a 5 estiverem fechadas e testadas e se README mais parte teórica já tiverem rascunho. Se qualquer uma falhar, congelar o escopo e mover para trabalhos futuros.
- Nomenclatura considerada, caso venha a existir a implementação: `pesquisador_imovel` e `pesquisador_documento`.
- Registro para a parte teórica: a opção por tools em vez de multiagente é decisão de engenharia baseada em volume de dados e prazo, no mesmo raciocínio de `conteudo text` em vez de `pgvector`.

## Incidentes Encerrados

- Exclusão de foto no Storage: a causa raiz era a ausência de política de `SELECT` em `storage.objects` para o bucket `imovel_fotos`, o que fazia `remove()` e `list()` não localizarem o objeto. O `CREATE POLICY` foi aplicado manualmente, restrito a `authenticated`, e o aviso do Supabase foi aceito por necessidade operacional.
- Colisão de nome no upload: o problema de raiz foi encerrado junto com a política de `SELECT`, porque `list()` deixava de retornar arquivos e o sequencial era calculado errado.

## Pendências Residuais Lovable

- Tratar no cliente o retorno vazio de `remove()` para evitar falso negativo de `arquivo não encontrado`.
- Calcular o sequencial do nome por `maior+1` em vez de contagem, para evitar colisões após exclusões intermediárias.

## Decisões de Arquitetura Registradas

- Upload de fotos só é liberado depois que o imóvel existe, porque o `id` é necessário para a nomenclatura e para o vínculo em `imovel_fotos`.
- Não há retenção de arquivos em memória antes do save; essa abordagem foi descartada por decisão deliberada.
- Documentos continuam sendo independentes, com vínculo opcional a imóvel.
- Respostas da IA sobre documentos devem citar explicitamente o documento de origem.

## Observações

- Executar as pendências apenas via Lovable, não via Copilot/VS Code, para manter uma única fonte de mudança no código publicado.
- Este arquivo deve permanecer consistente com [docs/memoria-projeto.json](/Users/brunagabrielaribeirosartor/imobia/docs/memoria-projeto.json) para evitar divergência de estado.
