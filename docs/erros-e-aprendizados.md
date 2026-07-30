# ImobIA — Erros, Depuração e Aprendizados Técnicos


> Registro de desenvolvimento do ImobIA, copiloto corporativo da imobiliária fictícia Litoral Prime. Este documento acompanha a Parte Teórica do trabalho e reúne o que não cabe nela: os erros encontrados, o caminho de diagnóstico de cada um, as hipóteses que se mostraram falsas e o aprendizado transferível de cada episódio.


## PARTE 1 - ENGENHARIA DE PROMPTS APLICADA À GERAÇÃO DE CÓDIGO

O risco principal não era o código não funcionar: era a ferramenta alterar algo que já funcionava, ou operar sobre premissas erradas a respeito do que existia no projeto.

### O que ajudou
Exigir o plano antes da implementação.

Todo prompt de alteração terminava com alguma variação de:

*Antes de implementar, me diga o que vai mudar em cada item, quais migrations serão criadas e se há risco de quebrar alguma tela que já funciona.*

Casos concretos</br>
- A ferramenta se propôs a criar uma migration de política de segurança que já havia sido aplicada manualmente, o que geraria duplicação.
- A ferramenta relatou como concluída a remoção de um bloco de interface que continuava presente na tela — o plano permitiu identificar que ela estava olhando para o componente errado (o da tela de edição, não o do cadastro).


Ganhos relevantes: </br>
- revisar um plano custa menos que refazer uma implementação.
- o plano expõe as premissas da ferramenta antes que elas virem código.

### Práticas eficazes

- Descrever o sintoma observado, não só o resultado desejado.
- Declarar explicitamente o que não deve ser alterado.
- Pedir verificação dos nomes reais de colunas antes da consulta.
- Registrar no prompt o diagnóstico já obtido por outros meios.
- Agrupar ajustes correlatos em um único prompt.

### O que não funcionou

- Prompts que descrevem só o resultado desejado. </br>
"Corrija a exclusão de fotos" produziu tentativa de conserto no cliente, quando a causa estava numa política de banco de dados. 
Descrever o sintoma completo — incluindo o que funcionava (exclusão de documentos) — foi o que permitiu o diagnóstico correto.


- Confiar no relato da ferramenta sobre o próprio trabalho. </br>
Em mais de uma ocasião a ferramenta afirmou ter removido algo que permanecia no código. O relato não é evidência; o teste é.

### O mesmo padrão aplicado ao assistente local

Quando o crédito da ferramenta de geração se esgotou e duas alterações de frontend passaram a ser feitas pelo assistente do ambiente local, o padrão foi mantido — e o comportamento observado foi exatamente o pretendido: o assistente leu o arquivo antes de editar, identificou que o cabeçalho de navegação já continha verificação por papel de usuário, inseriu apenas um item paralelo sem tocar no bloco do administrador, e ao final releu o arquivo alterado para conferir o resultado.


## PARTE 2 - CASOS DE DEPURAÇÃO

### Caso 1 — Validação estrita antes da normalização

Sintoma: Perguntas em linguagem natural com valores expressos coloquialmente falhavam. A mensagem de erro apontava que o campo `quartos_min` deveria ser um número.

Contexto: O modelo extraía da pergunta valores como "800 mil", "R$ 1,2 milhão" ou "200 m²" e os enviava como parâmetros da tool de busca.

Hipótese inicial: O modelo estava interpretando mal a pergunta.

Causa real: A interpretação estava correta. O problema era a camada de validação de tipos, executada **antes** da normalização do valor: um filtro que chegava como string era rejeitado, e a rejeição interrompia a consulta inteira em vez de descartar apenas aquele filtro.

Correção: Coerção com fallback, de modo que valor inválido vira `null` e o filtro é ignorado:
`z.coerce.number().catch(null)`
acompanhada da normalização das strings ("mil", "milhão", "m²") antes da coerção.


### Caso 2 — Dessincronização de sequências após carga manual

Sintoma: `duplicate key value violates unique constraint` "`imovel_fotos_pkey`" ao enviar qualquer arquivo, embora o banco estivesse aparentemente íntegro.

Causa: A carga inicial de dados inseriu registros com identificadores explícitos. As sequências do PostgreSQL não são atualizadas por inserção com `id` explícito, então continuaram apontando para valores baixos, já ocupados. O primeiro INSERT sem `id` explícito colidia com uma linha existente.

Correção:

sql
SELECT setval(pg_get_serial_sequence('public.imovel_fotos', 'id'),
              (SELECT MAX(id) FROM public.imovel_fotos) + 1, false);

Aplicado também a documentos. A migration que definiu os defaults de identidade das duas tabelas acompanhou a correção.

### Caso 3 — Política de leitura ausente no Storage

Sintomas: 

- Excluir uma foto pela aplicação exibia "arquivo não encontrado no bucket" e removia a linha do banco de qualquer forma, deixando o arquivo órfão no Storage.
- Enviar nova foto falhava em imóveis que já possuíam fotos, mesmo após exclusões.

Hipóteses: 

- política de `DELETE` ausente. Refutada ao listar as políticas: a política de `DELETE` existia, restrita a administrador via private.`is_admin()`.

Causa real: Faltava a política de `SELECT` em `storage.objects` para o bucket `imovel_fotos`.

### Caso 4 — Sequencial derivado de contagem

Sintoma: o padrão de nomenclatura `imovel_{id}_{sequencial}.{ext}` era frágil.

Causa: O próximo sequencial era calculado por contagem dos arquivos existentes. Com três fotos, excluir a segunda faz a contagem retornar 2, e o próximo arquivo é nomeado _3 — que já existe.

Correção: Calcular como maior número já usado + 1, extraído dos nomes existentes, e incrementar até encontrar nome livre caso ainda haja colisão.

### Caso 5 — Autorização de cadastro

Contexto: O cadastro estava aberto, qualquer pessoa com o endereço da aplicação criava conta e passava a ver o portfólio. A regra desejada era a da imobiliária real — só se cadastra quem o administrador reconhece como corretor da casa.

Solução adotada: Lista de e-mails autorizados em tabela própria, mais um gatilho de banco que barra a inserção de usuário não autorizado.

### Caso 6 - Roteamento interno que ignorava o MCP

Sintoma: O assistente utilizado no ambiente local roteava tarefas de edição de arquivo para outro modelo interno, que ignorava as ferramentas do servidor MCP e gravava na memória nativa do editor — criando duas fontes de verdade concorrentes sobre o estado do projeto.

Contorno: Instruir explicitamente, no início de cada interação:

*Use as ferramentas do servidor MCP de memória diretamente — não delegue para outro agente, não use a memória nativa do editor.*

## PARTE 3 - APRENDIZADOS

- Um filtro inválido deve ser ignorado, nunca fatal. Validação estrita é adequada a formulários, onde o usuário pode corrigir o campo; não a parâmetros gerados por um modelo, onde não há a quem devolver o erro.
- Toda carga manual de dados com identificadores explícitos exige ressincronizar as sequências. 
- Banco e Storage são sistemas distintos; a ordem entre as operações determina qual inconsistência é possível (registro órfão ou arquivo órfão).
- A operação `remove()` do `supabase-js` retorna vazio tanto quando o arquivo não existe quanto quando a permissão é negada.
- Mudanças de esquema e de política concentradas em uma única ferramenta, mudanças restritas ao frontend liberadas para a outra.
- O controle de acesso vive no banco, não na interface.

- A responsabilidade se transfere da escrita para a verificação; aceitar sem teste um código gerado por IA equivale a assinar um documento sem lê-lo. A interface decide o que é fácil de alcançar; o banco decide o que é permitido.



