# Nuvem Linux ☁️

[![Release](https://img.shields.io/github/v/release/fabianocarcosta/nuvem-linux?color=blue&label=Vers%C3%A3o)](https://github.com/fabianocarcosta/nuvem-linux/releases/latest)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Platform: Linux](https://img.shields.io/badge/Platform-Linux%20(x86__64)-orange.svg)]()

**Cliente nativo de sincronização bidirecional do Google Drive para distribuições Linux (Ubuntu, Debian, Fedora, Mint, Pop!_OS e outras).**

O **Nuvem Linux** funciona de forma semelhante ao cliente oficial do Dropbox e Google Drive: roda silenciosamente em segundo plano, integra-se ao gerenciador de arquivos com emblemas visuais de status, adiciona um ícone de progresso na barra do sistema e protege seus arquivos com histórico e lixeira segura.

---

### 📥 Downloads Oficiais da Versão Estável

| Pacote | Compatibilidade | Download Direto |
| :--- | :--- | :--- |
| **Debian / Ubuntu (`.deb`)** | Ubuntu, Debian, Linux Mint, Pop!_OS | [⬇️ Baixar `.deb` (v0.1.3)](https://github.com/fabianocarcosta/nuvem-linux/releases/download/v0.1.3/nuvem-linux_0.1.3_amd64.deb) |
| **Portátil (`.AppImage`)** | Qualquer distribuição Linux x86_64 | [⬇️ Baixar `.AppImage` (v0.1.3)](https://github.com/fabianocarcosta/nuvem-linux/releases/download/v0.1.3/Nuvem-Linux-0.1.3-x86_64.AppImage) |

---

## 📑 Sumário

1. [Destaques e Funcionalidades](#-destaques-e-funcionalidades)
2. [Instalação](#-instalação)
   - [Opção 1: Pacote Debian (.deb) — Recomendado](#opção-1-pacote-debian-deb--recomendado)
   - [Opção 2: Pacote Portátil (AppImage)](#opção-2-pacote-portátil-appimage)
   - [Opção 3: Executar pelo código-fonte (Desenvolvimento)](#opção-3-executar-pelo-código-fonte-desenvolvimento)
3. [Inicialização Automática com o Sistema](#-inicialização-automática-com-o-sistema)
4. [Guia de Utilização](#-guia-de-utilização)
   - [1. Conectar sua Conta Google](#1-conectar-sua-conta-google-ou-múltiplas-contas)
   - [2. Adicionar uma Pasta para Sincronizar](#2-adicionar-uma-pasta-para-sincronizar)
   - [3. Selecionar o Local no Google Drive](#3-selecionar-o-local-no-google-drive-navegador-visual)
   - [4. Revisar a Prévia e Aplicar](#4-revisar-a-prévia-e-aplicar)
5. [Integração com o Desktop](#-integração-com-o-desktop)
   - [Emblemas nos Arquivos (GNOME Nautilus)](#emblemas-nos-arquivos-gerenciador-de-arquivos-nautilus)
   - [Ícone na Barra do Sistema (System Tray)](#ícone-na-barra-do-sistema-system-tray--indicador)
6. [Comandos de Linha de Comando (CLI)](#-comandos-de-linha-de-comando-cli)
7. [Segurança, Lixeira e Conflitos](#-segurança-lixeira-e-conflitos)
8. [Estrutura de Arquivos e Diagnóstico](#-estrutura-de-arquivos-e-diagnóstico)

---

## 🌟 Destaques e Funcionalidades

- **Sincronização Bidirecional em Tempo Real (`rclone bisync`)**: O que você altera no computador vai para o Google Drive; o que altera no Drive baixa para o computador a cada 30 segundos.
- **Auto-recuperação**: Detecta e resolve automaticamente estados de pastas vazias e índices de sincronização sem travar o processo.
- **Navegador Visual do Google Drive**: Selecione a pasta de destino navegando visualmente pelas pastas do seu Google Drive ou crie novas pastas na hora.
- **Múltiplas Contas Google**: Conecte mais de uma conta do Google Drive, alterne entre elas com um clique ou desconecte quando desejar.
- **Emblemas de Status nos Arquivos**: Ícones no canto dos arquivos no gerenciador de arquivos (Nautilus) mostrando se o arquivo está sincronizado, pendente ou com erro.
- **Ícone na Barra Superior (Tray Indicator)**: Mostra o progresso da sincronização na barra de tarefas, com menu rápido para sincronizar, pausar ou abrir pastas locais.
- **Proteção Antiexclusão Acidental**: Arquivos apagados vão para a lixeira nativa do Google Drive e para a lixeira do Linux, com retenção de 30 dias.
- **Privacidade Total**: O servidor roda estritamente em `127.0.0.1` (localhost). Tokens OAuth nunca saem do seu computador.

---

## 📦 Instalação

### Opção 1: Pacote Debian (`.deb`) — Recomendado
Ideal para **Ubuntu**, **Debian**, **Linux Mint**, **Pop!_OS** e derivados.

#### Instalação via terminal (Resolve todas as dependências automaticamente):
```bash
sudo apt update
sudo apt install ./dist-packages/nuvem-linux_0.1.3_amd64.deb
```
> 💡 *Dica:* O comando `apt install ./arquivo.deb` instala automaticamente o `nodejs`, `rclone`, extensões do Nautilus e pacotes do sistema necessários diretamente dos repositórios oficiais.

#### Instalação gráfica:
Dê **dois cliques** no arquivo `nuvem-linux_0.1.3_amd64.deb` e clique em **Instalar** na Central de Aplicativos.

---

### Opção 2: Pacote Portátil (`AppImage`)
Ideal para qualquer distribuição Linux (Fedora, Arch, openSUSE, etc.) sem precisar instalar dependências no sistema. O **Node.js** e o **rclone** já vêm embutidos dentro do pacote.

1. Conceda permissão de execução ao arquivo:
   ```bash
   chmod +x dist-packages/Nuvem-Linux-0.1.3-x86_64.AppImage
   ```
2. Execute com dois cliques ou pelo terminal:
   ```bash
   ./dist-packages/Nuvem-Linux-0.1.3-x86_64.AppImage
   ```

---

### Opção 3: Executar pelo código-fonte (Desenvolvimento)

Se estiver editando ou desenvolvendo o aplicativo:
```bash
# 1. Instalar dependências
npm install

# 2. Compilar o frontend (Vite)
npm run build

# 3. Iniciar o servidor
npm start
```
Abra no navegador: `http://localhost:4173`.

---

## 🚀 Inicialização Automática com o Sistema

Para que o **Nuvem Linux** inicie silenciosamente em segundo plano assim que você ligar o computador (ou fizer login):

### Se você instalou pelo `.deb`:
O pacote `.deb` já cadastra o serviço de usuário no systemd. Basta habilitá-lo:
```bash
# 1. Recarregar e ativar o serviço
systemctl --user daemon-reload
systemctl --user enable --now nuvem-linux.service

# 2. Permitir inicialização no boot (mesmo antes do login gráfico):
sudo loginctl enable-linger $USER
```

### Se você estiver rodando pelo código-fonte:
```bash
npm run install:service
sudo loginctl enable-linger $USER
```

Para verificar se o serviço está ativo e rodando:
```bash
systemctl --user status nuvem-linux.service
```

---

## 🖥️ Guia de Utilização

### 1. Conectar sua Conta Google (ou Múltiplas Contas)
1. Abra o painel do aplicativo (pelo ícone da bandeja, menu de aplicativos ou acessando `http://localhost:4173`).
2. Na seção **Google Drive**, clique no botão **Conectar Google Drive**.
3. Uma aba do seu navegador será aberta com a página segura de login do Google. Escolha sua conta e autorize o acesso.
4. O painel identificará a conta conectada (ex: `seu-email@gmail.com`).
5. **Múltiplas Contas**: Para adicionar outra conta, basta clicar em **Conectar outra conta** e autenticar. Você pode alternar a conta ativa a qualquer momento no seletor de contas.

---

### 2. Adicionar uma Pasta para Sincronizar
1. No painel, vá na seção **Adicionar Pasta de Sincronização**.
2. **Pasta no computador**: Digite o caminho absoluto (ex: `/home/fabiano/Documentos/Projetos`) ou clique em **Selecionar pasta no PC** para abrir a janela nativa de seleção.

---

### 3. Selecionar o Local no Google Drive (Navegador Visual)
1. No campo **Pasta no Google Drive**, clique no botão **Procurar…**.
2. Uma janela modal se abrirá listando as pastas do seu Google Drive em tempo real:
   - Dê dois cliques em qualquer pasta para entrar nela.
   - Use o botão **Criar pasta** para criar uma pasta nova no Google Drive sem sair do app.
   - Use o botão **Raiz do Drive** ou a barra de navegação para voltar.
3. Clique em **Selecionar esta pasta**.

---

### 4. Revisar a Prévia e Aplicar
1. Clique em **Gerar prévia**.
2. O Nuvem Linux analisará o que existe no computador e o que existe no Google Drive:
   - Arquivos existentes apenas no PC serão marcados para envio.
   - Arquivos existentes apenas no Drive serão marcados para download.
   - Arquivos iguais são validados pelo hash de conteúdo.
   - Conflitos (mesmo arquivo modificado em ambos os lados) são preservados de forma segura, criando uma cópia `(conflito)`.
3. Clique em **Aplicar sincronização**.
4. Pronto! A pasta está sincronizada e será monitorada a cada 30 segundos.

---

## 🎨 Integração com o Desktop

### Emblemas nos Arquivos (Gerenciador de Arquivos Nautilus)
Dentro de qualquer pasta sincronizada, os arquivos e subpastas exibem um selo no canto inferior:
- ✅ **Check Verde (`emblem-default`)**: Arquivo totalmente sincronizado e idêntico à nuvem.
- 🔄 **Setas Azuis (`emblem-synchronizing`)**: Arquivo novo ou editado localmente aguardando o próximo ciclo de sincronização.
- ⚠️ **Sinal de Atenção (`emblem-important`)**: Arquivo em conflito, erro na sincronização ou pasta pausada.

**Menu de Contexto (Botão Direito):**
Ao clicar com o botão direito em um arquivo ou pasta gerenciada pela Nuvem:
- **Nuvem Linux: Sincronizar agora**: Força a sincronização imediata sem esperar o intervalo de 30 segundos.
- **Nuvem Linux: Abrir painel**: Abre o painel de controle do aplicativo.

---

### Ícone na Barra do Sistema (System Tray / Indicador)
No painel superior do Linux, um ícone de nuvem exibe o estado geral:
- ☁️✅ **Nuvem Azul com Check**: Tudo sincronizado e em dia.
- ☁️🔄 **Nuvem com Setas Giratórias**: Sincronização em andamento (ao passar o mouse, o tooltip informa qual pasta está sendo sincronizada).
- ☁️⏸️ **Nuvem Cinza**: Sincronização pausada.
- ☁️⚠️ **Nuvem Vermelha**: Erro de conexão ou falha.

**Ao clicar no ícone da barra:**
- **Clique com botão esquerdo**: Abre instantaneamente o painel de controle.
- **Menu completo**:
  - Resumo de status no cabeçalho.
  - 🔄 **Sincronizar tudo agora**
  - 🌐 **Abrir painel web**
  - 📁 **Atalhos rápidos para abrir cada pasta sincronizada no gerenciador de arquivos**
  - ⏸️ **Pausar / Retomar sincronização**
  - 🚪 **Fechar indicador**

---

## ⌨️ Comandos de Linha de Comando (CLI)

Após a instalação do pacote `.deb`, o utilitário `nuvem-linux` fica disponível globalmente no seu terminal:

| Comando | Descrição |
| :--- | :--- |
| `nuvem-linux` ou `nuvem-linux open` | Inicia o serviço caso esteja parado e abre a interface gráfica. |
| `nuvem-linux start` | Inicia o serviço em segundo plano silenciosamente. |
| `nuvem-linux status` | Exibe se o serviço está em execução e respondendo na porta local. |
| `nuvem-linux stop` | Interrompe o serviço do Nuvem Linux. |
| `nuvem-linux logs` | Acompanha os registros e transferências em tempo real via `journalctl`. |

---

## 🛡️ Segurança, Lixeira e Conflitos

- **Lixeira do Google Drive**: Itens apagados no computador que já estavam no Drive são movidos para a **lixeira oficial do Google Drive** (`RCLONE_DRIVE_USE_TRASH=true`), permitindo recuperação pela web do Google.
- **Lixeira do Linux**: Itens apagados no Google Drive que estavam no computador são movidos para a lixeira do desktop (`Trash`), evitando exclusões acidentais definitivas.
- **Proteção contra Sobrescrita**: Quando um mesmo arquivo é modificado simultaneamente no computador e no Drive, nenhuma versão é destruída: o Nuvem Linux mantém o original e cria a versão conflitante nomeada como `nome.conflito1.ext`, notificando o usuário.

---

## 📁 Estrutura de Arquivos e Diagnóstico

- **Configurações e pastas monitoradas**: `~/.local/share/nuvem-linux/sync-folders.json`
- **Backups e históricos do bisync**: `~/.cache/rclone/bisync/` e `~/.local/share/nuvem-linux/bisync-backups/`
- **Extensão do Nautilus do Usuário**: `~/.local/share/nautilus-python/extensions/nuvem_nautilus.py`
- **Extensão do Nautilus do Sistema**: `/usr/share/nautilus-python/extensions/nuvem_nautilus.py`
- **Ícones do sistema**: `~/.local/share/nuvem-linux/icons/` e `/usr/share/icons/hicolor/scalable/status/`

### Como ver os logs de sincronização em tempo real:
```bash
journalctl --user -u nuvem-linux.service -f
```

---

## 🛠️ Como Gerar Novos Pacotes para Distribuição

Se você fizer modificações no código e quiser gerar novas versões para distribuir aos parceiros:

```bash
cd /home/fabiano/REA

# Gera o pacote .deb e o AppImage:
npm run package
```
Os arquivos prontos para entrega ficarão na pasta `dist-packages/`:
- `nuvem-linux_0.1.3_amd64.deb`
- `Nuvem-Linux-0.1.3-x86_64.AppImage`

---

## 👨‍💻 Autor e Mantenedor

O **Nuvem Linux** é um produto desenvolvido e mantido por:

* **Fabiano C Costa**
  - **Empresa**: Data Fisher
  - **Formação / Especialidade**: Estatístico / Cientista de Dados · Analista e Desenvolvedor de Sistemas
  - **E-mail**: [fabianocarvalhodacosta@gmail.com](mailto:fabianocarvalhodacosta@gmail.com)

---

## ⚖️ Licença e Avisos Legais

Este projeto está licenciado sob os termos da **GNU General Public License v3.0 (GPLv3)** — consulte o arquivo [LICENSE](file:///home/fabiano/REA/LICENSE) para o texto legal completo.

### Agradecimentos e Créditos a Terceiros
O Nuvem Linux faz uso respeitoso de grandes projetos de software livre:
- **Rclone** (MIT License - Nick Craig-Wood e equipe)
- **Node.js** e **Express** (MIT License - OpenJS Foundation)
- **Vite** (MIT License - Evan You)
- **Lucide Icons** (ISC License)
- **Nautilus Python** (GPLv2+ - GNOME Foundation)
- **AppImageKit** (MIT License - probonopd)

Para detalhes completos de direitos autorais de terceiros, consulte o documento [NOTICE.md](file:///home/fabiano/REA/NOTICE.md).
