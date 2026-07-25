# Notas de Desenvolvimento - ImobIA

## Pendências Ativas

### Prioridade alta

- Corrigir os IDs auto-gerados em `imovel_fotos` e `documentos`, que hoje podem gerar erro de duplicate key por falta de default/sequence.
- Corrigir a exibição do campo de upload de foto na edição do imóvel, que deve aparecer sempre que um imóvel existente estiver sendo editado.
- Garantir que o estado `SC` seja preservado e exibido corretamente no formulário.

### Prioridade média

- Exibir a foto do imóvel nos cards de listagem.
- Ajustar a exibição de "1 quartos" para o singular em telas de listagem e detalhes.
- Revisar permissões e organização da interface para documentos, incluindo separação por tipo e vínculo.

### Prioridade baixa

- Melhorar a UX de upload com validações, preview e mensagens de status.
- Avaliar se faz sentido permitir upload de foto e documento já durante o cadastro do imóvel, antes do salvamento inicial.
- Adicionar feedback visual de sucesso em cadastro de imóvel, upload de foto e upload de documento.
- Remover qualquer referência residual a documentos na tela `/imoveis/novo`.
- Corrigir a sanitização do nome de arquivo de documento, decodificando o nome antes de aplicar a regex de limpeza.
- Oferecer opção de continuar cadastrando após salvar imóvel ou enviar documento, em vez de redirecionar automaticamente para o chat.

## Decisões de Arquitetura Tomadas

- O upload de documentos não deve seguir o fluxo de um imóvel específico; os documentos são independentes e precisam de cadastro separado.
- É necessário distinguir claramente entre documentos institucionais e documentos vinculados a um imóvel.
- A tela `/documentos` deve ser admin-only e aceitar um vínculo opcional com imóvel.
- A tela `/imoveis/$id` deve exibir apenas a listagem somente leitura dos documentos relacionados ao imóvel, sem formulário duplicado.

## Erros Resolvidos e Aprendizados

- A duplicidade do formulário de documentos na tela do imóvel foi eliminada ao mover o cadastro para uma rota própria.
- Foi reforçado o aprendizado de que nem todo documento pertence a um imóvel; parte da documentação é institucional e precisa existir de forma independente.
- A sanitização de nomes de arquivo já funciona corretamente para fotos; o desvio atual está restrito ao fluxo de documentos.
- Até o momento, não há um erro técnico adicional registrado como concluído nesta memória além da reorganização do fluxo de documentos.

## Observações de Segurança

- O módulo de documentos deve respeitar controle de acesso administrativo na rota de cadastro.
- A listagem em `/imoveis/$id` deve permanecer somente leitura para evitar edição indevida de documentos relacionados.
- A separação entre documentos institucionais e documentos de imóvel reduz risco de associação incorreta de dados sensíveis ou operacionais.
- Não há, na memória atual, um incidente de segurança confirmado; o ponto registrado é de organização de acesso e escopo.
