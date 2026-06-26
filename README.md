# Nive Atendente — Desktop Windows

Cliente Windows para atendentes humanos da Nive. Fica na **bandeja do sistema** (ao lado do relógio), recebe notificações quando entra alguém na fila e permite responder várias conversas ao mesmo tempo.

## Por que Electron?

- Integração nativa com a bandeja do Windows e notificações do sistema
- Instalador `.exe` (NSIS) para cada atendente
- Interface em React, alinhada ao painel web que você já usa
- Cada usuário instala na própria máquina com login individual

## Requisitos

- Windows 10/11 (64 bits)
- Node.js 20+
- O site Nive (`stepgosistemassite`) rodando e acessível na rede

## Desenvolvimento

```bash
cd stepgo-atendente-desktop
npm install
npm run dev
```

O app abre em modo desenvolvimento com hot reload. Na primeira execução, configure a URL do servidor em **Configurações** (ex.: `http://localhost:3000` em dev ou `https://nivesistemas.com.br` em produção).

## Gerar instalador Windows

```bash
npm run dist
```

O instalador será gerado em:

```
%LOCALAPPDATA%\nive-atendente-desktop\release\
```

Exemplo: `C:\Users\SeuUsuario\AppData\Local\nive-atendente-desktop\release\`

> Se existir uma pasta `release/` antiga dentro do projeto (OneDrive), você pode apagá-la manualmente — ela não é mais usada.

## Uso diário

1. Instale o app no Windows de cada atendente
2. Faça login com a conta de administrador Nive (suporta 2FA)
3. Feche a janela — o app **continua rodando na bandeja**
4. Clique no ícone da bandeja para abrir o painel
5. Notificações aparecem quando novos atendimentos entram na fila

## Configurações

| Opção | Descrição |
|-------|-----------|
| URL do servidor | Endereço do site Nive com as APIs de suporte |
| Iniciar minimizado | Abre só na bandeja, sem mostrar a janela |
| Som nas notificações | Alerta sonoro quando a fila cresce |

## API utilizada

O desktop consome as mesmas rotas do painel web, com autenticação por token:

- `POST /api/admin/desktop/login`
- `POST /api/admin/desktop/login/2fa/verify`
- `GET /api/admin/support/conversations`
- Demais rotas de claim, mensagens, anexos e encerramento

## Estrutura

```
stepgo-atendente-desktop/
├── electron/          # Processo principal (tray, janela, IPC)
├── src/               # Interface React
├── build/             # Ícones do app
└── release/           # Instalador gerado
```

## Ícones

Execute `node scripts/generate-icons.mjs` para regenerar os ícones a partir da marca Nive (`build/brand/icon-source.png`).
