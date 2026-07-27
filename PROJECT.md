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

Última actualização: **27 de Julho de 2026**

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

Os preços são de produto e ainda não estão ligados a facturação real.

## 5. Funcionalidades implementadas

### Interface

- Dashboard com indicadores de inventário, reservas e utilização.
- Navegação responsiva para computador, tablet e telemóvel.
- Interface em português e inglês.
- Tema personalizável para o perfil da empresa.
- Página de planos Basic e Network.

### Inventário

- Criação e remoção de artigos.
- Nome, categoria, quantidade, disponibilidade e estado.
- Preço de aluguer e moeda por artigo, com MZN como padrão.
- Fotografia própria ou imagem de demonstração.
- Localização no armazém e condição do artigo.
- Pesquisa, filtragem e ordenação.
- Selecção e operações em massa.
- Categorias personalizáveis.
- Importação e exportação CSV.

### Reservas e calendário

- Criação de reservas com cliente, evento, contacto e notas.
- Datas de início e fim.
- Quantidade e estado da reserva.
- Calendário mensal e semanal.
- Consulta dos detalhes da reserva.
- Exportação de reservas.

### Equipa e perfil

- Interface para convidar colaboradores e escolher funções.
- Perfil público com fotografia, biografia, contactos, localização e cor.
- Persistência de perfil, inventário, reservas e categorias.

### Infraestrutura

- Aplicação React/Next executada através de Vinext.
- Cloudflare D1 para dados relacionais.
- Cloudflare R2 para fotografias.
- Drizzle ORM para a definição do esquema.
- Alojamento privado através de OpenAI Sites.
- Código-fonte num repositório privado do GitHub.

## 6. Estado funcional

| Área | Estado | Observação |
|---|---|---|
| Interface web responsiva | Funcional | Disponível no ambiente publicado |
| Inventário básico | Funcional | Ainda sem isolamento por empresa |
| Categorias | Funcional | Ainda sem isolamento por empresa |
| Upload de imagens | Funcional | JPG e PNG até 5 MB |
| Reservas | Parcial | Falta detectar conflitos de forma transaccional |
| Calendário | Funcional | Baseado nas reservas existentes |
| Importação/exportação | Parcial | CSV disponível; falta Excel e validação avançada |
| Perfil público | Parcial | Editor existe; falta rota pública independente |
| Equipa | Demonstração | Convites ficam pendentes e não enviam email |
| Autenticação | Parcial | Existe suporte do ambiente, mas a API não está protegida |
| Multiempresa | Não implementado | Todos os dados usam o mesmo espaço |
| Subscrições | Demonstração | Não existe checkout, webhook ou facturação |
| Rede local | Demonstração | Os artigos e negócios são dados estáticos |
| Aplicação mobile | Parcial | Web responsiva; ainda não é PWA ou aplicação nativa |
| Notificações | Não implementado | Falta email, push e lembretes |
| Testes automatizados | Mínimo | O build é a validação principal actual |

## 7. Arquitectura actual

```text
Navegador
   │
   ▼
Next.js / Vinext
   ├── Interface React
   ├── /api/data
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
- `db/schema.ts`: entidades do banco de dados.
- `drizzle/`: migrações do banco de dados.
- `app/globals.css`: sistema visual e adaptação responsiva.
- `.openai/hosting.json`: configuração de D1, R2 e alojamento.

## 8. Modelo de dados actual

- `inventory_items`: artigos e quantidades.
- `reservations`: reservas associadas actualmente ao nome de um artigo.
- `categories`: categorias do inventário.
- `collaborators`: convites pendentes e funções.
- `business_profile`: perfil único da empresa.

## 9. Modelo de dados pretendido

Para suportar várias empresas com segurança, o modelo deverá evoluir para:

- `users`
- `businesses`
- `memberships`
- `subscriptions`
- `categories`
- `inventory_items`
- `item_photos`
- `inventory_movements`
- `clients`
- `events`
- `reservations`
- `reservation_items`
- `marketplace_listings`
- `rental_requests`
- `payments`
- `notifications`
- `audit_logs`

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

- [ ] Registo, login e recuperação de acesso.
- [ ] Empresas, utilizadores e memberships.
- [ ] `business_id` em todas as entidades privadas.
- [ ] Funções e permissões aplicadas na API.
- [ ] Remoção dos dados de demonstração das contas reais.

### Fase 2 — Inventário operacional

- [ ] Edição completa de artigos.
- [ ] Várias fotografias por artigo.
- [ ] Histórico de movimentos de stock.
- [ ] Kits e conjuntos.
- [ ] Manutenção, limpeza e danos.
- [ ] Importação Excel com validação.

### Fase 3 — Reservas robustas

- [ ] Clientes e eventos como entidades próprias.
- [ ] Vários artigos por reserva.
- [ ] Verificação atómica de disponibilidade.
- [ ] Preço total, desconto, caução e logística.
- [ ] Alteração, cancelamento, saída e devolução.

### Fase 4 — Equipa e comunicação

- [ ] Convites por email.
- [ ] Aceitação e expiração de convites.
- [ ] Notificações internas.
- [ ] Lembretes por email e push.
- [ ] Histórico de actividade.

### Fase 5 — Subscrições

- [ ] Permissões reais por plano.
- [ ] Integração de pagamento em MZN.
- [ ] Webhooks, renovação, cancelamento e tolerância.
- [ ] Histórico de pagamentos e recibos.

### Fase 6 — Trove Network

- [ ] Publicação voluntária de artigos.
- [ ] Pesquisa por distância, preço e disponibilidade.
- [ ] Pedidos, aprovação e contrapropostas.
- [ ] Pagamentos, cauções e devoluções.
- [ ] Avaliações e resolução de conflitos.

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
npm install
npm run dev
npm run build
npm test
npm run lint
npm run db:generate
```

## 16. Decisões pendentes

- Fornecedor definitivo de autenticação.
- Modelo do marketplace: contacto, comissão ou pagamento intermediado.
- Regras de caução, cancelamento, danos e reembolso.
- Integração de pagamentos e processo de facturação em Moçambique.
- Limites exactos de cada plano.
- Estratégia PWA versus aplicações nativas.
- Política de verificação das empresas da rede.

## 17. Histórico de iterações

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

