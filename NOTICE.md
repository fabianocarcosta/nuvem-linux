# Avisos de Terceiros e Agradecimentos (Third-Party Notices)

**Nuvem Linux**
Copyright (C) 2026 **Data Fisher**
Autor: **Fabiano C Costa** <fabianocarvalhodacosta@gmail.com>
*Estatístico / Cientista de Dados · Analista e Desenvolvedor de Sistemas*

Este documento lista e homenageia os principais projetos de software livre e de código aberto utilizados como base, dependências ou componentes do **Nuvem Linux**, em estrito cumprimento às respectivas licenças.

---

## 1. Rclone
- **Autores**: Nick Craig-Wood e colaboradores do projeto Rclone
- **Site oficial**: <https://rclone.org>
- **Repositório**: <https://github.com/rclone/rclone>
- **Licença**: Licença MIT
- **Uso no Nuvem Linux**: Utilizado como motor central de sincronização em nuvem e comunicação com a API do Google Drive via comando `rclone bisync`.

```text
The MIT License (MIT)

Copyright (c) 2012 Nick Craig-Wood

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

---

## 2. Node.js
- **Autores**: OpenJS Foundation e colaboradores
- **Site oficial**: <https://nodejs.org>
- **Repositório**: <https://github.com/nodejs/node>
- **Licença**: Licença MIT
- **Uso no Nuvem Linux**: Runtime JavaScript utilizado para execução do backend local (`server.js`), agendamento de sincronizações e gerenciamento de arquivos.

```text
Node.js is licensed under the MIT License.
Copyright Node.js contributors. All rights reserved.
```

---

## 3. Express
- **Autores**: OpenJS Foundation e colaboradores
- **Site oficial**: <https://expressjs.com>
- **Repositório**: <https://github.com/expressjs/express>
- **Licença**: Licença MIT
- **Uso no Nuvem Linux**: Framework web para fornecimento da API REST local (`http://127.0.0.1:4173`) e entrega da interface gráfica.

---

## 4. Vite
- **Autores**: Yuxi (Evan) You e colaboradores
- **Site oficial**: <https://vite.dev>
- **Repositório**: <https://github.com/vitejs/vite>
- **Licença**: Licença MIT
- **Uso no Nuvem Linux**: Ferramenta de build e empacotamento do frontend em HTML/CSS/JavaScript modular.

---

## 5. Lucide Icons
- **Autores**: Comunidade Lucide Icons (derivado do Feather Icons)
- **Site oficial**: <https://lucide.dev>
- **Repositório**: <https://github.com/lucide-icons/lucide>
- **Licença**: Licença ISC (permissiva compatível com MIT/GPL)
- **Uso no Nuvem Linux**: Conjunto de ícones vetoriais modernos utilizados no painel de controle.

```text
ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT).
All other copyright (c) 2022-present Lucide Contributors.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.
```

---

## 6. Nautilus Python (python3-nautilus)
- **Autores**: GNOME Foundation e colaboradores
- **Site oficial**: <https://gitlab.gnome.org/GNOME/nautilus-python>
- **Licença**: GNU General Public License v2 ou posterior (GPLv2+)
- **Uso no Nuvem Linux**: Binding Python para o gerenciador de arquivos GNOME Nautilus, permitindo a exibição de emblemas de status nos arquivos e ações no menu de contexto.

---

## 7. StatusNotifierItem & DBusMenu Specifications
- **Organizações**: KDE e Canonical Ltd. / Projeto Ayatana
- **Especificações**:
  - `org.kde.StatusNotifierItem`: <https://www.freedesktop.org/wiki/Specifications/StatusNotifierItem/>
  - `com.canonical.dbusmenu`: <https://launchpad.net/dbusmenu>
- **Licença**: GNU LGPL / GPL
- **Uso no Nuvem Linux**: Protocolo de comunicação via D-Bus para renderizar o indicador de status e menu interativo na barra superior do sistema (System Tray).

---

## 8. AppImageKit / appimagetool
- **Autores**: Simon Peter (probonopd) e equipe AppImage
- **Site oficial**: <https://appimage.org>
- **Repositório**: <https://github.com/AppImage/AppImageKit>
- **Licença**: Licença MIT
- **Uso no Nuvem Linux**: Ferramenta utilizada no empacotamento do executável portátil para distribuição universal em distribuições Linux.

