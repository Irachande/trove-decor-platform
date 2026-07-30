# Trove — Documento do Projecto

> Fonte oficial para o âmbito, estado, arquitectura, decisões e evolução da
> plataforma Trove.

## Regra de manutenção

Este documento deve ser revisto em **todas as iterações** do projecto.

Uma iteração só é considerada concluída quando, no mesmo commit:

1. o estado das funcionalidades afectadas estiver actualizado;
2. mudanças de arquitectura, dados, integrações ou dependências estiverem
   documentadas;
3. o roadmap reflectir o trabalho concluído e o próximo passo;
4. uma entrada for adicionada ao histórico de iterações;
5. os comandos de validação executados estiverem registados.

Última actualização: **30 de Julho de 2026**

## 1. Visão

A Trove é uma plataforma web e mobile para empresas de decoração gerirem os
seus artigos, reservas, equipas e presença pública. No plano avançado, permite
também encontrar e alugar material pertencente a outros decoradores da mesma
região.

O produto deve reduzir reservas duplicadas, inventário perdido, comunicação
fragmentada e compras desnecessárias de material.

## 2. Utilizadores

- Proprietários de empresas de decoração.
- Gestores de inventário e armazém.
- Gestores de reservas e eventos.
- Colaboradores com acesso apenas de consulta.
- Decoradores parceiros que alugam material entre empresas.
- Visitantes que consultam perfis públicos.

## 3. Proposta de valor

- Saber exactamente que artigos existem e onde estão guardados.
- Consultar disponibilidade por data e quantidade.
- Coordenar toda a equipa a partir de diferentes dispositivos.
- Organizar clientes, eventos, entregas e devoluções.
- Apresentar publicamente a marca de cada decorador.
- Rentabilizar material parado através da rede local.
- Encontrar material sem aumentar permanentemente o armazém.

## 4. Planos previstos

### Basic — 1.200 MZN/mês

- Gestão de inventário.
- Calendário partilhado.
- Reservas e eventos.
- Até três colaboradores.
- Perfil público.
- Importação e exportação de dados.

### Network — 3.100 MZN/mês

- Tudo incluído no Basic.
- Colaboradores ilimitados.
- Pesquisa de artigos de empresas próximas.
- Pedidos e aceitação de alugueres.
- Preços e condições definidos por cada empresa.
- Análises de utilização e receita.

Os preços, limites e ciclo mensal são aplicados pelo motor de subscrições. A
integração PaySuite está pronta, mas pagamentos reais permanecem desactivados
até serem configuradas as credenciais da conta comercial.

## 5. Funcionalidades implementadas

### Interface

- Dashboard com indicadores de inventário, reservas e utilização.
- Navegação responsiva para computador, tablet e telemóvel.
- Interface em português e inglês.
- Tema personalizável para o perfil da empresa.
- Página de planos Basic e Network.

### Inventário

- Criação e remoção de artigos.
- Criação e edição completa com nome, descrição, SKU, categoria, quantidades,
  stock mínimo, condição e estado.
- Preço de aluguer e moeda por artigo, com MZN como padrão.
- Galeria com até oito fotografias próprias por artigo.
- Localização no armazém e condição do artigo.
- Pesquisa, filtragem e ordenação.
- Selecção e operações em massa.
- Categorias personalizáveis.
- Histórico de entradas, saídas, acertos, danos e abates de stock.
- Manutenção, limpeza, inspecção, reparação e registo de danos.
- Kits compostos por vários artigos, quantidades e preço único.
- Importação Excel ou CSV com validação integral antes da gravação.
- Exportação CSV.

### Reservas e calendário

- Clientes e eventos como entidades próprias e reutilizáveis.
- Reservas com vários artigos, quantidades e preços registados por linha.
- Verificação transaccional da disponibilidade por artigo e período.
- Subtotal, desconto, entrega, total, caução, pagamento e logística.
- Alteração, confirmação, cancelamento, saída e devolução de reservas.
- Datas do evento, montagem e recolha, contacto, local e notas.
- Calendário mensal e semanal.
- Consulta dos detalhes da reserva.
- Exportação de reservas.

### Equipa e perfil

- Convites seguros dirigidos a um email, válidos por sete dias.
- Aceitação ou recusa explícita pelo utilizador autenticado com o mesmo email.
- Renovação e revogação de convites pendentes.
- Funções de proprietário, gestor, inventário, reservas e consulta.
- Alteração de funções, remoção de membros e troca entre empresas autorizadas.
- Centro de notificações internas com leitura individual ou em massa.
- Lembretes internos para reservas nos três dias seguintes.
- Alertas do navegador enquanto a aplicação está aberta.
- Histórico cronológico das alterações importantes e respectivos autores.
- Perfil público com fotografia, biografia, contactos, localização e cor.
- Persistência de perfil, inventário, reservas e categorias.

### Identidade e empresas

- Entrada obrigatória através de Sign in with ChatGPT no ambiente Sites.
- Criação automática de utilizador, empresa e membership.
- Empresas novas começam sem artigos ou reservas demonstrativas.
- A primeira conta proprietária preserva e reclama os dados existentes.
- Dados, imagens e operações isolados através de `business_id`.
- Permissões verificadas no servidor em todas as operações privadas.

### Subscrições e facturação

- Período experimental inicial de catorze dias por empresa.
- Plano Basic limitado a três colaboradores; Network sem esse limite.
- Operações de escrita bloqueadas quando a subscrição fica vencida.
- Pagamento mensal em MZN através do adaptador PaySuite.
- Checkout externo, webhooks HMAC, idempotência e validação do valor.
- Renovação mensal, cancelamento no fim do período e tolerância de sete dias.
- Histórico de tentativas, pagamentos, falhas, métodos e referências.
- Recibos numerados, bilingues e preparados para impressão.
- O teste não expira nem bloqueia escrita enquanto o provedor não estiver
  configurado, evitando bloquear empresas antes de existir uma forma de pagar.

### Trove Network

- Publicação voluntária de artigos do inventário com preço diário, caução,
  quantidades, condições, entrega e localização.
- Pesquisa multiempresa por nome, categoria, empresa, localidade, datas,
  quantidade, preço e distância quando ambas as localizações possuem
  coordenadas.
- Disponibilidade calculada com reservas internas e alugueres Network aceites.
- Pedidos entre empresas, contrapropostas, aceitação, rejeição e cancelamento.
- Confirmação manual de pagamento e caução feitos fora da Trove.
- Registo de recolha e devolução com actualização do stock e movimentos.
- Avaliações recíprocas depois da devolução.
- Disputas com motivo, proposta da contraparte e aceitação por quem abriu.
- Fotografias publicadas servidas apenas a membros autenticados do plano
  Network, sem expor o inventário privado da empresa proprietária.

### Infraestrutura

- Aplicação React/Next executada através de Vinext.
- Cloudflare D1 para dados relacionais.
- Cloudflare R2 para fotografias.
- Drizzle ORM para a definição do esquema.
- `read-excel-file` para leitura de ficheiros XLSX no navegador.
- Alojamento privado através de OpenAI Sites.
- Código-fonte num repositório privado do GitHub.
- Integração PaySuite para M‑Pesa, e‑Mola e cartões; credenciais reais pendentes.

## 6. Estado funcional

| Área | Estado | Observação |
|---|---|---|
| Interface web responsiva | Funcional | Disponível no ambiente publicado |
| Inventário básico | Funcional | Isolado por empresa e protegido por função |
| Categorias | Funcional | Isoladas por empresa |
| Upload de imagens | Funcional | JPG/PNG até 5 MB, autenticado e separado por empresa |
| Reservas | Funcional | Multiartigo, conflitos atómicos, preços e ciclo operacional |
| Calendário | Funcional | Visões mensal/semanal, detalhes e reservas canceladas excluídas |
| Inventário operacional | Funcional | Fichas, stock, fotografias, kits e manutenção isolados por empresa |
| Importação/exportação | Funcional | Importação XLSX/CSV validada e exportação CSV |
| Perfil público | Parcial | Editor existe; falta rota pública independente |
| Equipa | Funcional | Convites com aceitação/expiração, funções, remoção e troca de empresa |
| Autenticação | Funcional no Sites | Usa Sign in with ChatGPT; fornecedor público definitivo continua pendente |
| Multiempresa | Funcional | Consultas, alterações e imagens são isoladas por `business_id` |
| Subscrições | Parcial | Motor, limites, checkout e webhooks funcionam; falta activar credenciais PaySuite reais |
| Rede local | Funcional (MVP) | Publicações, pesquisa, disponibilidade, negociação, aluguer, avaliações e disputas são reais; pagamento é confirmado manualmente |
| Aplicação mobile | Parcial | Web responsiva; ainda não é PWA ou aplicação nativa |
| Notificações | Parcial | Centro interno, lembretes e alertas com app aberta; falta email/push em segundo plano |
| Histórico de actividade | Funcional | Alterações importantes registadas por empresa e autor |
| Testes automatizados | Parcial | Testes estruturais e integração das APIs de reservas, equipa e facturação |

## 7. Arquitectura actual

```text
Navegador
   │
   ▼
Next.js / Vinext
   ├── Interface React
   ├── Identidade Sign in with ChatGPT
   ├── Contexto de empresa e permissões
   ├── /api/data
   ├── /api/billing/checkout
   ├── /api/billing/webhook
   ├── /api/network
   ├── /api/network-image
   ├── /api/item-image
   └── /api/profile-image
          │
          ├── Cloudflare D1
          └── Cloudflare R2
```

### Estrutura principal

- `app/DecorApp.tsx`: interface e estado principal da aplicação.
- `app/api/data/route.ts`: leitura e alteração dos dados.
- `app/api/item-image/route.ts`: armazenamento das fotografias dos artigos.
- `app/api/profile-image/route.ts`: armazenamento da fotografia do perfil.
- `app/chatgpt-auth.ts`: utilitários de identidade do ambiente publicado.
- `app/billing.ts`: catálogo de planos, cliente PaySuite e segurança de webhooks.
- `app/api/network/route.ts`: pesquisa, publicações e ciclo de aluguer entre
  empresas.
- `app/api/network-image/route.ts`: acesso autenticado às fotografias
  voluntariamente publicadas.
- `app/workspace.ts`: criação de empresas, memberships e autorização.
- `db/schema.ts`: entidades do banco de dados.
- `drizzle/`: migrações do banco de dados.
- `app/globals.css`: sistema visual e adaptação responsiva.
- `.openai/hosting.json`: configuração de D1, R2 e alojamento.

## 8. Modelo de dados actual

- `users`: identidades autenticadas.
- `businesses`: empresas e plano actual.
- `memberships`: relação entre utilizadores, empresas e funções.
- `subscriptions`: plano, estado, período, tolerância e cancelamento.
- `payments`: cobranças, estado, referência, checkout e recibo.
- `payment_webhook_events`: idempotência e rastreio dos eventos PaySuite.
- `marketplace_listings`: artigos publicados voluntariamente na rede.
- `rental_requests`: pedidos, negociação, valores e ciclo de entrega/devolução.
- `rental_reviews`: avaliações recíprocas por aluguer concluído.
- `rental_disputes`: problema, proposta de resolução e aceitação.
- `inventory_items`: artigos e quantidades, isolados por empresa.
- `item_photos`: galeria de fotografias associada aos artigos.
- `inventory_movements`: histórico de alterações de stock.
- `maintenance_records`: inspecções, limpezas, reparações e danos.
- `kits`: conjuntos comerciais com preço próprio.
- `kit_items`: composição e quantidade de cada artigo num kit.
- `clients`: clientes reutilizáveis, isolados por empresa.
- `events`: eventos associados a clientes e reservas.
- `reservations`: período, valores, logística e estado do ciclo de aluguer.
- `reservation_items`: artigos, quantidades e preços de cada reserva.
- `categories`: categorias isoladas por empresa.
- `collaborators`: convites, validade, aceitação e revogação.
- `notifications`: avisos e lembretes por utilizador e empresa.
- `audit_logs`: histórico de alterações importantes e respectivos autores.
- `business_profile`: perfil de cada empresa.

## 9. Modelo de dados pretendido

Para suportar várias empresas com segurança, o modelo deverá evoluir para:

- `users`
- `businesses`
- `memberships`
- `subscriptions` — implementado
- `categories`
- `inventory_items`
- `item_photos` — implementado
- `inventory_movements` — implementado
- `maintenance_records` — implementado
- `kits` e `kit_items` — implementado
- `clients` — implementado
- `events` — implementado
- `reservations`
- `reservation_items` — implementado
- `marketplace_listings` — implementado
- `rental_requests` — implementado
- `rental_reviews` — implementado
- `rental_disputes` — implementado
- `payments` — implementado
- `notifications` — implementado
- `audit_logs` — implementado

Todas as entidades pertencentes a uma empresa deverão possuir `business_id` e
ser filtradas e autorizadas no servidor.

## 10. Fluxos pretendidos

### Entrada de uma empresa

1. O proprietário cria uma conta.
2. Confirma o email.
3. Cria ou configura a empresa.
4. Escolhe o plano.
5. Importa o inventário ou cria o primeiro artigo.
6. Convida a equipa.

### Reserva interna

1. O utilizador cria um evento e selecciona vários artigos.
2. O servidor verifica disponibilidade por data e quantidade.
3. A reserva bloqueia a quantidade necessária.
4. A equipa acompanha preparação, saída, devolução e eventuais danos.
5. A disponibilidade é reposta depois da devolução.

### Aluguer entre decoradores

1. A empresa proprietária publica voluntariamente um artigo na rede.
2. Outra empresa pesquisa por artigo, distância e datas.
3. Envia um pedido com quantidade e período.
4. A proprietária aceita, rejeita ou faz contraproposta.
5. O pagamento e a caução são confirmados.
6. As partes registam entrega, devolução e avaliação.

## 11. Segurança e privacidade

Antes de aceitar clientes reais, são obrigatórios:

- Autenticação em todas as operações privadas.
- Isolamento de dados por empresa.
- Permissões verificadas no servidor.
- Validação estruturada de todas as entradas.
- Protecção contra reservas duplicadas.
- Limites de pedidos e uploads.
- URLs de imagens controladas e política de retenção.
- Registo de alterações importantes.
- Backups e teste de recuperação.
- Termos de serviço e política de privacidade.
- Gestão segura de segredos exclusivamente no ambiente de alojamento.

## 12. Roadmap

### Fase 1 — Fundação segura

- [x] Registo, login e recuperação através da identidade do ambiente Sites.
- [x] Empresas, utilizadores e memberships.
- [x] `business_id` em todas as entidades privadas.
- [x] Funções e permissões aplicadas na API.
- [x] Remoção dos dados de demonstração das contas novas.

Nota: autenticação pública por email, Google ou Apple continua uma decisão de
produto para a distribuição fora do ambiente Sites.

### Fase 2 — Inventário operacional

- [x] Edição completa de artigos.
- [x] Várias fotografias por artigo.
- [x] Histórico de movimentos de stock.
- [x] Kits e conjuntos.
- [x] Manutenção, limpeza e danos.
- [x] Importação Excel com validação.

### Fase 3 — Reservas robustas

- [x] Clientes e eventos como entidades próprias.
- [x] Vários artigos por reserva.
- [x] Verificação atómica de disponibilidade.
- [x] Preço total, desconto, caução e logística.
- [x] Alteração, cancelamento, saída e devolução.

### Fase 4 — Equipa e comunicação

- [ ] Convites por email.
- [x] Aceitação e expiração de convites.
- [x] Notificações internas.
- [ ] Lembretes por email e push.
- [x] Histórico de actividade.

Nota: os links de convite podem ser copiados e partilhados, e os alertas do
navegador funcionam com a aplicação aberta. O envio automático de email e push
em segundo plano depende da escolha e configuração de um fornecedor externo.

### Fase 5 — Subscrições

- [x] Permissões reais por plano.
- [ ] Integração de pagamento em MZN.
- [x] Webhooks, renovação, cancelamento e tolerância.
- [x] Histórico de pagamentos e recibos.

Nota: o adaptador PaySuite, checkout e webhook estão implementados e foram
testados com um simulador local. O pagamento em MZN só será marcado como
concluído depois de configurar `PAYSUITE_API_TOKEN` e
`PAYSUITE_WEBHOOK_SECRET` de uma conta comercial activa. O fornecedor não
disponibiliza actualmente um ambiente sandbox; uma conta activa processa
transacções reais. Até essa activação, o período experimental permanece aberto
para não bloquear o trabalho das empresas.

### Fase 6 — Trove Network

- [x] Publicação voluntária de artigos.
- [x] Pesquisa por distância, preço e disponibilidade.
- [x] Pedidos, aprovação e contrapropostas.
- [x] Confirmação manual de pagamentos, cauções e devoluções.
- [ ] Pagamentos intermediados, divisão e reembolsos automáticos.
- [x] Avaliações e resolução de conflitos.

Nota: devoluções e estado de caução estão implementados. Nesta primeira versão,
as empresas pagam directamente entre si e a proprietária confirma manualmente
pagamento e caução na Trove. Pagamento intermediado, divisão automática,
reembolsos e retenção financeira dependem de contrato comercial, regras legais
e suporte do provedor; não são apresentados como funcionalidade concluída.

### Fase 7 — Mobile e lançamento

- [ ] PWA instalável.
- [ ] Notificações push.
- [ ] Funcionamento básico com ligação instável.
- [ ] Testes automatizados e monitorização.
- [ ] Beta com empresas reais.

## 13. Definição de concluído

Uma funcionalidade está concluída quando:

- funciona em português e inglês;
- funciona em computador e telemóvel;
- respeita autenticação, empresa e permissões;
- valida erros e apresenta mensagens úteis;
- possui testes proporcionais ao risco;
- não introduz erros no build;
- está documentada neste ficheiro;
- foi publicada no ambiente correcto quando aplicável.

## 14. Ambientes e ligações

- GitHub: <https://github.com/Irachande/trove-decor-platform>
- Produção privada:
  <https://trove-decor-platform.irachande7.chatgpt.site>
- Branch principal: `main`
- Moeda padrão: Metical moçambicano (`MZN`)
- Idiomas: Português (`pt`) e Inglês (`en`)

## 15. Comandos principais

```bash
pnpm install
pnpm run dev
pnpm run build
pnpm test
pnpm run lint
pnpm run typecheck
pnpm run db:generate
```

## 16. Decisões pendentes

- Fornecedor definitivo de autenticação.
- Comissão e pagamento intermediado no marketplace; o MVP usa contratação
  directa entre empresas.
- Regras legais e financeiras para caução, cancelamento, danos e reembolso.
- Activação da conta comercial PaySuite e configuração segura das credenciais.
- Estratégia PWA versus aplicações nativas.
- Política de verificação das empresas da rede.
- Fornecedor e remetente verificado para email transaccional.
- Fornecedor de push e gestão das respectivas chaves.

## 17. Histórico de iterações

### 30 de Julho de 2026 — Fase 6: Trove Network operacional

- Substituídos os artigos e negócios demonstrativos por publicações reais de
  inventário, exclusivas do plano Network e autorizadas por função.
- Cada publicação define preço diário em MZN, caução, quantidade mínima/máxima,
  recolha ou entrega, termos, localidade e coordenadas opcionais.
- Criada pesquisa por texto, datas, quantidade e raio, com distância geográfica
  quando o dispositivo e a publicação possuem coordenadas.
- A disponibilidade desconta reservas internas e alugueres Network aceites,
  com gatilho transaccional que volta a validar stock no momento da aceitação.
- Implementados pedidos recebidos/enviados, contrapropostas, aceitação,
  rejeição, cancelamento, confirmação financeira manual, recolha e devolução.
- Recolha e devolução actualizam o stock físico e criam movimentos de
  inventário `network_out` e `network_return`.
- Adicionadas avaliações recíprocas e disputas com proposta da contraparte e
  confirmação de resolução pela empresa que abriu o problema.
- Criadas as entidades `marketplace_listings`, `rental_requests`,
  `rental_reviews` e `rental_disputes`, com a migração
  `0007_peaceful_moon_knight.sql`.
- Criada rota autenticada para fotografias da rede, validando a publicação e o
  prefixo da empresa antes de ler do R2.
- Adicionado teste integrado com duas empresas Network, cobrindo bloqueio do
  plano Basic, publicação, pesquisa, distância, contraproposta, disponibilidade,
  pagamento/caução manuais, recolha, disputa, resolução, devolução e avaliação.
- Pagamento intermediado permanece pendente; o MVP regista apenas confirmações
  de transacções feitas directamente entre as empresas.
- Validação: `node tests/phase6-api.integration.mjs`,
  `node --test tests/rendered-html.test.mjs` (15 testes), `vinext build`,
  `tsc --noEmit --incremental false`,
  `eslint . --ignore-pattern dist --ignore-pattern .next` e
  `git diff --check`.

### 30 de Julho de 2026 — Fase 5: subscrições e facturação

- Criado catálogo vinculativo dos planos Basic (1.200 MZN) e Network
  (3.100 MZN), com limite real de três colaboradores no Basic.
- Todas as empresas recebem catorze dias de teste; subscrições vencidas passam
  por sete dias de tolerância antes de bloquear operações de escrita.
- Enquanto as credenciais comerciais não estiverem configuradas, o teste
  permanece aberto para impedir bloqueios sem uma via real de pagamento.
- Implementados renovação mensal, cancelamento no fim do período e retoma da
  subscrição pelo proprietário.
- Adicionado adaptador PaySuite para criar cobranças em MZN e encaminhar o
  utilizador para checkout com M‑Pesa, e‑Mola ou cartão.
- Criado webhook com assinatura HMAC SHA-256, validação do valor, idempotência,
  tratamento de sucesso/falha e actualização atómica do plano.
- Adicionados histórico de pagamentos, referências, métodos, falhas e recibos
  numerados preparados para impressão.
- Criadas as entidades `subscriptions`, `payments` e
  `payment_webhook_events`, com a migração `0006_confused_snowbird.sql`.
- Adicionado teste integrado com simulador local do PaySuite, incluindo
  checkout Network, webhook falsificado, confirmação assinada, duplicação,
  recibo, cancelamento, retoma e limites por plano.
- A activação de cobranças reais permanece pendente porque exige uma conta
  comercial PaySuite e credenciais secretas; o fornecedor declara que não
  disponibiliza sandbox e que contas activadas processam transacções reais.
- Referências: <https://paysuite.tech/docs/> e
  <https://paysuite.co.mz/>.
- Validação: `pnpm run test:phase5-api`, `pnpm test`, `pnpm run lint`,
  `pnpm run typecheck`, `pnpm run build` e `git diff --check`.

### 29 de Julho de 2026 — Fase 4: equipa e comunicação

- Os convites deixaram de conceder acesso automaticamente: exigem aceitação
  explícita por uma sessão com o mesmo email e expiram ao fim de sete dias.
- Adicionadas renovação, revogação e recusa de convites, com link partilhável e
  estados visíveis na gestão da equipa.
- Implementadas alteração de funções, remoção de membros e troca entre empresas
  às quais o utilizador pertence.
- Criado centro de notificações internas, leitura individual/em massa e
  lembretes automáticos para reservas nos três dias seguintes.
- Adicionados alertas nativos do navegador enquanto a Trove está aberta.
- Criado histórico de actividade com empresa, utilizador, acção, entidade e
  data, aplicado às alterações importantes da API.
- Criadas as entidades `notifications` e `audit_logs`, e ampliados os convites
  com validade, aceitação e revogação.
- Adicionada a migração `0005_reflective_exiles.sql`, testes estruturais e um
  teste integrado com proprietário e colaborador, cobrindo convite, aceitação,
  recusa, mudança de função, permissões, notificações e histórico.
- O envio automático de email e push em segundo plano permanece pendente até à
  escolha de fornecedores e configuração segura das credenciais.
- Validação: `pnpm run test:phase4-api`, `pnpm test`, `pnpm run lint`,
  `pnpm run typecheck`, `pnpm run build` e `git diff --check`.

### 29 de Julho de 2026 — Fase 3: reservas robustas

- Criadas as entidades `clients`, `events` e `reservation_items`, todas
  isoladas por `business_id`, e ampliado o modelo financeiro e operacional das
  reservas.
- Implementada a migração automática das reservas anteriores para o novo
  modelo, preservando clientes, eventos e artigos existentes.
- Adicionada composição de reservas com vários artigos e quantidades, preços
  capturados por linha, desconto, entrega, total, caução, pagamento e logística.
- A disponibilidade passou a ser validada atomicamente no D1 por artigo,
  quantidade e intervalo de datas, impedindo sobre-reservas concorrentes.
- Adicionados directório de clientes e eventos, edição de reservas e estados
  de confirmação, cancelamento, saída e devolução.
- Saídas e devoluções actualizam o stock disponível e criam movimentos de
  inventário na mesma transacção.
- O calendário passa a usar a data actual, exclui cancelamentos e mantém as
  visões mensal e semanal com acesso ao detalhe operacional.
- Adicionada a migração `0004_numerous_slyde.sql`, testes estruturais e um teste
  integrado da API que cobre criação multiartigo, conflito, edição, saída,
  devolução e cancelamento.
- Validação: `pnpm run test:phase3-api`, `pnpm test`, `pnpm run lint`,
  `pnpm run typecheck`, `pnpm run build` e `git diff --check`.

### 29 de Julho de 2026 — Fase 2: inventário operacional

- Implementada a ficha completa de artigos com descrição, SKU, stock mínimo,
  valor de reposição, localização, condição, estado e preço em MZN.
- Adicionada galeria de até oito fotografias por artigo, com ficheiros no R2,
  metadados no D1 e remoção coordenada em ambos.
- Criado histórico de movimentos de stock para stock inicial, importações,
  compras, acertos, danos, perdas e abates.
- Adicionados registos de inspecção, limpeza, reparação e danos, incluindo
  custo, data, estado e conclusão.
- Implementados kits compostos por vários artigos, quantidades e preço único.
- Adicionada importação de XLSX e CSV com validação de cabeçalhos, tipos,
  quantidades, disponibilidade e preços antes de qualquer gravação.
- Criadas as entidades `item_photos`, `inventory_movements`,
  `maintenance_records`, `kits` e `kit_items`, todas isoladas por
  `business_id`.
- Adicionada a migração `0003_sleepy_wolfpack.sql` e testes estruturais da
  Fase 2.
- Validação: `pnpm test`, `pnpm run lint`, `pnpm run typecheck`,
  `pnpm run build`,
  `git diff --check` e inspecção manual da migração Drizzle.

### 28 de Julho de 2026 — Fase 1: fundação segura

- Adicionado ecrã de entrada obrigatório com Sign in with ChatGPT.
- Criadas as entidades `users`, `businesses` e `memberships`.
- Adicionado `business_id` a inventário, reservas, categorias, perfil e
  colaboradores.
- Implementado isolamento por empresa em todas as consultas e alterações.
- Aplicadas permissões no servidor para inventário, reservas, equipa e perfil.
- Fotografias passaram a ser autenticadas e separadas por empresa no R2.
- Convites passam a conceder a função definida quando o email convidado entra.
- Contas novas começam vazias; os dados anteriores são preservados para o
  primeiro proprietário.
- Criada migração segura para bases antigas, incluindo a restrição composta de
  categorias.
- Validação: `pnpm test`, `pnpm run lint`, simulação local de duas empresas,
  resposta `401` sem sessão e resposta `403` para tentativa de escrita por uma
  função de consulta.

### 27 de Julho de 2026 — Documento central do projecto

- Criado `PROJECT.md` como fonte oficial do estado do produto.
- Registados visão, funcionalidades, arquitectura, limitações e roadmap.
- Criada uma regra para actualizar este documento em todas as iterações.
- Validação: revisão de Markdown e verificação de diferenças do Git.

### 27 de Julho de 2026 — Inventário e calendário

- Adicionadas categorias, quantidades, fotografias, preços e moedas.
- Definido MZN como moeda padrão.
- Adicionados filtros, ordenação e operações em massa.
- Implementados calendário semanal e mensal e detalhes de reservas.
- Adicionados idiomas português e inglês.
- Adicionadas interfaces de equipa, análise e rede local.
- Publicada a versão 2 no ambiente privado.

### 27 de Julho de 2026 — Protótipo inicial

- Criada a experiência visual da Trove.
- Implementados dashboard, inventário, reservas, perfil, planos e rede.
- Configuradas persistência D1, imagens R2 e publicação com Sites.
