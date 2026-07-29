# Trove

Plataforma bilingue de gestão de inventário, reservas e aluguer de material
entre empresas de decoração.

## Documentação do projecto

Consulte [PROJECT.md](PROJECT.md) para a descrição completa da visão,
funcionalidades, arquitectura, estado actual, decisões e roadmap.

`PROJECT.md` é a fonte oficial do projecto e deve ser actualizado em todas as
iterações.

## Estado

A Trove possui um protótipo web responsivo com inventário, fotografias,
categorias, preços em MZN, calendário de reservas, perfil público, equipa,
análises e uma demonstração da rede local.

Antes de aceitar clientes reais, ainda são necessários autenticação
multiempresa, permissões protegidas no servidor, prevenção de conflitos,
subscrições, pagamentos e marketplace real.

## Desenvolvimento

Requisitos:

- Node.js `>=22.13.0`

Comandos:

```bash
pnpm install
pnpm run dev
pnpm run build
pnpm test
pnpm run lint
pnpm run db:generate
```

## Ligações

- Produção privada:
  <https://trove-decor-platform.irachande7.chatgpt.site>
- Documento do projecto: [PROJECT.md](PROJECT.md)
