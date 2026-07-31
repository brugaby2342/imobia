<h1 align="center">ImobIA — Copiloto Corporativo da Litoral Prime</h1> </br></br>

<img width="1400" height="803" alt="capa" src="https://github.com/user-attachments/assets/ad6e873a-f511-41ce-9232-6519ac0aab55" />


> Projeto acadêmico desenvolvido para a disciplina IA Generativa Aplicada ao Desenvolvimento (UniFECAF/Rocketseat), a partir do desafio de construir um copiloto corporativo inteligente utilizando ferramentas modernas de desenvolvimento assistido por IA.
>
> Assistente corporativo que permite a corretores de imóveis consultar, em linguagem natural, tanto o portfólio de propriedades quanto o conteúdo de documentos normativos internos — com respostas fundamentadas exclusivamente nos dados da empresa.

## 📋 Sobre o Projeto

*O problema*

Empresas em crescimento acumulam informações mais rápido do que conseguem organizá-las. Planilhas, PDFs, procedimentos e políticas internas coexistem em repositórios distintos, e o custo de encontrar a informação certa é alto.

O cenário escolhido foi uma imobiliária de médio porte no litoral norte de Santa Catarina, porque o setor reúne de forma intensa as duas naturezas de informação que um copiloto corporativo precisa conciliar:

*Informação estruturada* — características comerciais do imóvel (tipo, bairro, cidade, valor, área, quartos, situação documental), consultada por filtros combinados;

*Informação textual e normativa* — manuais internos, regulamentos de condomínio e guias de regularização, consultados por assunto.

### Funcionalidades Principais

- Consulta em linguagem natural ao portfólio, com filtros combinados.

- Busca textual na descrição, permitindo perguntas por características que não são campos estruturados.

- Consulta ao conteúdo de documentos normativos por assunto.

- Gestão de imóveis — cadastro, edição e exclusão, restritos ao administrador.

- Gestão de fotos.

- Módulo independente de documentos, com vínculo opcional a imóvel, distinguindo documentos institucionais dos específicos de uma unidade

---

## 📝 Como funciona

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


Pelo fluxo, percebe-se que o modelo não acessa o banco de dados. Ele recebe as descrições das ferramentas disponíveis, decide qual chamar e com quais parâmetros, e a função de servidor executa a consulta. Os cards exibidos ao corretor são construídos a partir dos dados estruturados retornados.

---

## 🛠️ Ferramentas (functions - tool use)

| FERRAMENTA          | DOMÍNIO        | CONSULTA        |
| :--- | :--- | :--- |
| `buscar_imoveis`      | Características, valores e localização do portfólio | `imoveis` + `imovel_fotos`
| `buscar_documentos`   | Conteúdo normativo, contratual e procedimental.     | documentos

---

## 🏠 Arquitetura

*Camada de interface* — Aplicação React com roteamento por TanStack Router, no qual o gate de autenticação é estrutural: as rotas protegidas vivem sob um segmento reservado (_authenticated/), de modo que nenhuma tela interna é alcançável sem sessão válida.

*Camada de aplicação* — Função de servidor que recebe a pergunta, encaminha ao modelo junto das descrições das ferramentas e do prompt de sistema, valida os parâmetros retornados e executa a consulta. A chave de acesso ao modelo permanece no servidor, nunca no navegador.

*Camada de dados* — PostgreSQL gerenciado pelo Supabase, com Row Level Security ativa em todas as tabelas, autenticação integrada e armazenamento de arquivos em buckets com políticas próprias. As regras de acesso são aplicadas pelo banco, não pela interface.

---

## 🎲 Modelo de dados

| Entidade        | Função        | Decisão de Modelagem        |
| :--- | :--- | :--- |
| `imoveis`        | Portfólio, com características comerciais e situação documental  | Não armazena caminho de foto — a relação com imagens é externalizada  |
| `imovel_fotos`    | Fotos vinculadas a um imóvel        | Guarda o caminho do arquivo, não a URL, pois URLs assinadas expiram        |
| `documentos`        | Documentos normativos, com coluna de texto consultável pela IA        | Vínculo com imóvel é opcional, permitindo documentos institucionais |
| `profiles`        | Perfil do usuário, ligado à autenticação, com o papel atribuído        | Base do controle de acesso por papéis        |

**Relacionamentos**

Um imóvel possui várias fotos — 1:N, com ON DELETE CASCADE (a foto não existe sem o imóvel);

Um imóvel pode ter vários documentos vinculados, e um documento pode não pertencer a nenhum imóvel — 1:N opcional, com ON DELETE SET NULL (excluir o imóvel desvincula, não apaga o documento);

Cada perfil corresponde a um usuário autenticado — 1:1

**Buckets de armazenamento**

`imovel_fotos` e `documentos`

---

## 💻 Tecnologias utilizadas

| Camada          | Tecnologia          |
| :--- | :--- |
| Frontend          | React, TypeScript, TanStack Router, Tailwind CSS |
| Backend          | Funções de servidor (Supabase / Lovable)          |
| Banco de Dados           | PostgreSQL (Supabase), com Row Level Security |
| Autenticação          | Supabase Auth (e-mail e senha) |
| Armazenamento          | Supabase Storage |
| Modelo de Linguagem          | Google Gemini 2.5 Flash |
| Versionamento          | Git / GitHub |

*Ferramentas de IA*

O projeto usou IA em duas frentes distintas, a IA como funcionalidade do produto e a IA como instrumento de desenvolvimento.

| Ferramenta | Frente | Papel |
| :--- | :--- | :--- |
| Google Gemini 2.5 Flash | Produto | Interpreta as perguntas, escolhe a ferramenta de busca e redige as respostas |
|Lovable | Desenvolvimento | Geração e alteração de código a partir de prompts, com migrations no banco e sincronização com o repositório |
| GitHub Copilot (modo agent) | Desenvolvimento | Assistência no ambiente local e operação do servidor MCP de memória do projeto |
| Claude | Desenvolvimento | Formulação dos prompts, diagnóstico de erros, decisões de arquitetura e documentação |
| ChatGPT | Dados | Produção das fotos fictícias, coerentes com a descrição de cada imóvel |

*Gerenciamento de contexto com MCP*

Foi configurado um servidor de memória via Model Context Protocol no ambiente local, integrado ao GitHub Copilot em modo Agent, mantendo o estado da aplicação, as pendências priorizadas e as decisões arquiteturais com sua justificativa:

[Pasta de documentos](https://github.com/brugaby2342/imobia/tree/main/docs)

`docs/memoria-projeto.json` — fonte estruturada, legível por máquina.</br>
`docs/notas-desenvolvimento.md` — versão legível por humanos, mantida em consistência.</br>
`docs/erros-e-aprendizados.md` - registro dos obstáculos enfrentados e contornados.

---

## 🔒 Segurança e Governança

- Controle de acesso no banco, não na interface. 
- Menor privilégio: O corretor lê portfólio, fotos e documentos; o administrador acrescenta as operações de escrita.
- Respostas fundamentadas: O modelo é instruído a responder somente com base nos dados retornados pelas ferramentas, a declarar explicitamente quando nada é encontrado e a citar o documento de origem em respostas normativas.
- Finalidade específica e minimização da LGPD (Lei nº 13.709/2018): O copiloto responde apenas sobre características comerciais dos imóveis, não sobre dados pessoais dos proprietários.
- Limite de competência: O prompt de sistema estabelece que o copiloto não é fonte de aconselhamento jurídico; dúvidas de regularização que extrapolem o registro cadastral devem ser encaminhadas ao setor jurídico.
- Cadastro sob autorização: A criação de conta no ImobIA está condicionada à autorização prévia do administrador, impedindo o acesso de terceiros desvinculados à imobiliária. Uma lista de e-mails autorizados pelo administrador é verificada por gatilho no momento do registro — quem não consta nela não cria conta.
- A chave do modelo nunca vai ao navegador. A chamada ao Gemini acontece na função de servidor.

---

## 📔 Como acessar

Acesse a versão publicada:
[ImobIA](https://imobia-copilot.lovable.app)

---

## 🔐 Credenciais para teste:

As credenciais são fornecidas porque o cadastro exige autorização prévia do administrador: apenas e-mails liberados na base conseguem criar conta.


Administrador </br>
e-mail: admin.novo@gmail.com</br>
senha: adminovo</br>

Corretor</br>
e-mail: jicesa2239@kingcq.com</br>
senha: jicesa</br>

e-mail para teste de cadastro</br>
e-mail: niwima9405@kierko.com</br>
Crie a senha no cadastro

---

## ﹖ Perguntas Sugeridas para Testes

*Imóvel na planta em Itapema*

*Quais imóveis têm churrasqueira e vista para o mar em Porto Belo?*
- *E em Itapema?*

*O que é exigido na documentação de imóvel na planta?*

*Quais imóveis têm pendência na documentação?*

---

📷 Prints


- Cadastro de imóveis e fotos
<img width="1582" height="1035" alt="caaastro-foto" src="https://github.com/user-attachments/assets/8fc132a8-816b-4aa4-a9a9-e192640c25ca" />


- Consulta de documento
<img width="1582" height="1035" alt="ex pesquisa-doc" src="https://github.com/user-attachments/assets/9b1ad138-50dc-4f6f-94dc-c18274329e80" />


- Resultado da consulta com a imagem do card;
<img width="811" height="778" alt="card" src="https://github.com/user-attachments/assets/17a09744-46eb-470f-a539-26186ed3e289" />


- Interação com chat
<img width="1582" height="1035" alt="interacao-chat" src="https://github.com/user-attachments/assets/081eae52-d320-4195-97b5-85c9f0681a52" />


<img width="1582" height="1035" alt="ex chat" src="https://github.com/user-attachments/assets/5599dd5c-2cf2-4a9c-92ab-4bb66a46e2bc" />



- Listagem de Imóveis
<img width="1400" height="803" alt="listagem imoveis" src="https://github.com/user-attachments/assets/31d00535-e8da-4c8a-a029-9514b8419b08" />




---

## 📄 Licença
Projeto desenvolvido para fins acadêmicos. Uso livre para estudo e referência.

Feito por Bruna Gabriela Ribeiro Sartor</br>
Acadêmica em Inteligência Artificial e Automação Digital


