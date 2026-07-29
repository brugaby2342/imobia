# ImobIA — Copiloto Corporativo da Litoral Prime

> Assistente corporativo que permite a corretores de imóveis consultar, em linguagem natural, tanto o portfólio de propriedades quanto o conteúdo de documentos normativos internos — com respostas fundamentadas exclusivamente nos dados da empresa.

Projeto acadêmico desenvolvido para a disciplina IA Generativa Aplicada ao Desenvolvimento (UniFECAF), a partir do desafio de construir um copiloto corporativo inteligente utilizando ferramentas modernas de desenvolvimento assistido por IA.


O problema
Empresas em crescimento acumulam informação mais rápido do que conseguem organizá-la. Planilhas, PDFs, procedimentos e políticas internas coexistem em repositórios distintos, e o custo de encontrar a informação certa é alto — profissionais interrompem colegas para obter respostas já documentadas e decisões são tomadas sobre versões desatualizadas.

O cenário escolhido foi uma imobiliária de médio porte no litoral norte de Santa Catarina, porque o setor reúne de forma intensa as duas naturezas de informação que um copiloto corporativo precisa conciliar:

Informação estruturada — características comerciais do imóvel (tipo, bairro, cidade, valor, área, quartos, situação documental), consultada por filtros combinados;
Informação textual e normativa — manuais internos, regulamentos de condomínio e guias de regularização, consultada por assunto.

Um corretor que atende cliente interessado em imóvel na planta precisa das duas ao mesmo tempo: quais unidades cabem no orçamento e qual documentação é exigível naquela fase da incorporação. As duas informações existem na empresa; nenhuma está a uma pergunta de distância.


Funcionalidades
🔍 Consulta em linguagem natural ao portfólio, com filtros combinados de tipo, cidade, bairro, valor, área e número de quartos
📝 Busca textual na descrição, permitindo perguntas por características que não são campos estruturados (churrasqueira, vista para o mar, mobiliado)
📄 Consulta ao conteúdo de documentos normativos por assunto, sem exigir que o usuário conheça ou cite o nome do documento
🖼️ Cards visuais com foto, gerados a partir dos dados estruturados retornados pela consulta — não do texto produzido pelo modelo
🔐 Autenticação e controle de acesso por papéis (administrador e corretor), aplicado no banco de dados via Row Level Security
🏠 Gestão de imóveis — cadastro, edição e exclusão, restritos ao administrador
📷 Gestão de fotos com nomenclatura padronizada e remoção sincronizada entre banco de dados e armazenamento
📚 Módulo independente de documentos, com vínculo opcional a imóvel, distinguindo documentos institucionais dos específicos de uma unidade


Como funciona
Percurso de uma pergunta como "apartamento em Itapema até 900 mil com churrasqueira":

Corretor  ──►  Interface de chat

                    │

                    ▼

            Função de servidor  ──►  Gemini 2.5 Flash

                    │                      │

                    │   ◄── chamada de ferramenta com parâmetros extraídos

                    ▼

            Validação e normalização dos parâmetros

                    │

                    ▼

            PostgreSQL (sob políticas de RLS)

                    │

        ┌───────────┴───────────┐

        ▼                       ▼

  dados ──► Gemini        dados ──► Interface

  (redige a resposta)     (renderiza os cards)

O modelo não acessa o banco de dados. Ele recebe as descrições das ferramentas disponíveis, decide qual chamar e com quais parâmetros, e a função de servidor executa a consulta. Os cards exibidos ao corretor são construídos a partir dos dados estruturados retornados — de modo que, mesmo que a redação da resposta apresente imprecisão, valores, áreas e situações documentais têm origem verificável no banco.

Ferramentas disponíveis ao modelo

Ferramenta (function): buscar_imoveis
Domínio: Características, valores e localização do portfólio
Consulta: imoveis + imovel_fotos

Ferramenta (function): buscar_documentos
Domínio: Conteúdo normativo, contratual e procedimental
Consulta: documentos

Arquitetura
Camada de interface — Aplicação React com roteamento por TanStack Router, no qual o gate de autenticação é estrutural: as rotas protegidas vivem sob um segmento reservado (_authenticated/), de modo que nenhuma tela interna é alcançável sem sessão válida.

Camada de aplicação — Função de servidor que recebe a pergunta, encaminha ao modelo junto das descrições das ferramentas e do prompt de sistema, valida os parâmetros retornados e executa a consulta. A chave de acesso ao modelo permanece no servidor, nunca no navegador.

Camada de dados — PostgreSQL gerenciado pelo Supabase, com Row Level Security ativa em todas as tabelas, autenticação integrada e armazenamento de arquivos em buckets com políticas próprias. As regras de acesso são aplicadas pelo banco, não pela interface.


Modelo de dados

Relacionamentos

Um imóvel possui várias fotos — 1:N, com ON DELETE CASCADE (a foto não existe sem o imóvel)
Um imóvel pode ter vários documentos vinculados, e um documento pode não pertencer a nenhum imóvel — 1:N opcional, com ON DELETE SET NULL (excluir o imóvel desvincula, não apaga o documento)
Cada perfil corresponde a um usuário autenticado — 1:1

Buckets de armazenamento

Tecnologias utilizadas


Ferramentas de IA utilizadas
O projeto usou IA em duas frentes distintas, que convém não confundir: a IA como funcionalidade do produto e a IA como instrumento de desenvolvimento.

Ferramenta

Google Gemini 2.5 Flash

Lovable

GitHub Copilot (modo Agent)

Claude

ChatGPT


O Gemini integra o produto e segue operando após a entrega; as demais atuaram no processo e não estão presentes na aplicação final.
Gerenciamento de contexto com MCP
Um projeto desenvolvido ao longo de vários dias enfrenta um problema específico: cada nova sessão com uma ferramenta de IA começa sem memória das decisões anteriores, e decisões deliberadas correm o risco de ser desfeitas por não estarem registradas.

Foi configurado um servidor de memória via Model Context Protocol no ambiente local, integrado ao GitHub Copilot em modo Agent, mantendo o estado da aplicação, as pendências priorizadas e as decisões arquiteturais com sua justificativa:

docs/memoria-projeto.json — fonte estruturada, legível por máquina
docs/notas-desenvolvimento.md — versão legível por humanos, mantida em consistência


Segurança e governança
Controle de acesso no banco, não na interface. Todas as tabelas operam com Row Level Security. Ocultar um botão não é controle de acesso: mesmo que a camada de apresentação falhe, a operação é negada pelo banco.
Menor privilégio. O corretor lê portfólio, fotos e documentos; o administrador acrescenta as operações de escrita.
Respostas fundamentadas. O modelo é instruído a responder somente com base nos dados retornados pelas ferramentas, a declarar explicitamente quando nada é encontrado e a citar o documento de origem em respostas normativas.
Sem dados pessoais. O copiloto responde apenas sobre características comerciais dos imóveis, não sobre proprietários — atendendo aos princípios de finalidade específica e minimização da LGPD (Lei nº 13.709/2018).
Limite de competência. O prompt de sistema estabelece que o copiloto não é fonte de aconselhamento jurídico; dúvidas de regularização que extrapolem o registro cadastral devem ser encaminhadas ao setor jurídico.
A chave do modelo nunca vai ao navegador. A chamada ao Gemini acontece na função de servidor.


Estrutura do projeto
.

├── src/

│   ├── routes/

│   │   └── _authenticated/     # rotas protegidas por sessão

│   ├── components/

│   ├── integrations/supabase/

│   └── lib/

├── supabase/

│   └── migrations/             # histórico de evolução do esquema

├── docs/

│   ├── memoria-projeto.json    # memória de projeto (MCP)

│   ├── notas-desenvolvimento.md

│   ├── erros-e-aprendizados.md

│   └── img/                    # prints usados neste README

└── README.md



Limitações conhecidas
Busca textual, não semântica. A consulta a documentos opera por correspondência de termos e não captura sinonímia: uma pergunta sobre "animais de estimação" não encontra um regulamento que trate de "animais domésticos". Com três documentos o efeito é mitigado pela devolução do conteúdo integral ao modelo, mas a limitação delimita a escala em que a solução funciona.
Conteúdo dos documentos inserido manualmente. Não há extração automática de texto a partir dos PDFs enviados, o que impacta a escalabilidade da base de conhecimento.
Sem histórico de conversas. Cada pergunta é independente; não há perguntas de acompanhamento com contexto preservado.
Verificação de senhas vazadas não habilitada. O recurso exige plano pago da plataforma de banco de dados.


Trabalhos futuros
Busca semântica por embeddings vetoriais com a extensão pgvector, substituindo a correspondência textual de termos — justificável quando o volume tornar inviável entregar o conteúdo integral ao modelo
Orquestração multiagente, com agentes especializados em imóveis e documentos sob um roteador, em lugar da especialização por ferramentas com chamada única
Extração automática de texto dos arquivos enviados, com o tratamento de segurança que essa ingestão exige
Histórico de conversas por usuário
Habilitação da verificação de senhas comprometidas e atualização das dependências vulneráveis


Autoria
Bruna Gabriela Ribeiro Sartor

Projeto acadêmico — disciplina de IA Generativa Aplicada ao Desenvolvimento Centro Universitário UniFECAF · 2026



