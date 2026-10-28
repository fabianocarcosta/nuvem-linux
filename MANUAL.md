# Manual do Usuário - Nuvem Linux

Guia prático para instalação, configuração e uso cotidiano do **Nuvem Linux**.

---

## 1. Como Instalar

### No Ubuntu, Debian, Linux Mint ou Pop!_OS:
Abra o terminal na pasta onde baixou o arquivo `.deb` e execute:
```bash
sudo apt update
sudo apt install ./nuvem-linux_0.1.1_amd64.deb
```
> O sistema cuidará de baixar todos os pacotes e dependências automaticamente.

### Em outras distribuições (ou sem instalar nada):
Use o arquivo **AppImage**:
1. Clique com o botão direito no arquivo `Nuvem-Linux-0.1.1-x86_64.AppImage` -> **Propriedades** -> **Permissões** -> marque **Permitir executar o arquivo como programa**.
2. Dê dois cliques para abrir.

---

## 2. Inicialização Automática no Boot do Sistema

Para que suas pastas fiquem sempre sincronizadas sem precisar abrir o aplicativo manualmente:
```bash
systemctl --user enable --now nuvem-linux.service
sudo loginctl enable-linger $USER
```

---

## 3. Primeiro Uso: Conectando sua Conta Google

1. Abra o **Nuvem Linux** pelo menu de aplicativos ou pelo terminal com o comando `nuvem-linux`.
2. No painel, localize a seção **Google Drive** e clique em **Conectar Google Drive**.
3. O navegador será aberto na tela oficial e segura do Google. Faça login e autorize o acesso.
4. Ao retornar ao painel, sua conta aparecerá com o selo verde de **Conectado**.

---

## 4. Sincronizando uma Pasta

1. No campo **Pasta no computador**, clique em **Selecionar pasta no PC** e escolha a pasta desejada (por exemplo, sua pasta de documentos ou trabalho).
2. No campo **Pasta no Google Drive**, clique em **Procurar…**:
   - Navegue pelas pastas do seu Drive.
   - Se desejar criar uma pasta nova, use o botão **Criar pasta**.
   - Clique em **Selecionar esta pasta**.
3. Clique em **Gerar prévia**.
4. Revise os arquivos que serão enviados ou baixados e confirme em **Aplicar sincronização**.
5. Pronto! O aplicativo agora manterá essa pasta sincronizada continuamente a cada 30 segundos.

---

## 5. Como Identificar o Status dos Arquivos

No seu gerenciador de arquivos (**Arquivos / Nautilus**), observe os selos nos arquivos da pasta:
* ✅ **Selo Verde de Check**: Arquivo sincronizado e salvo no Google Drive.
* 🔄 **Selo Azul de Sincronização**: Arquivo novo ou alterado que está sendo enviado.
* ⚠️ **Selo de Atenção**: Arquivo em conflito ou pasta pausada.

---

## 6. Atalhos na Barra Superior (Bandeja)

No canto superior direito da tela, junto ao relógio e controle de som, você verá o ícone da Nuvem:
* **Clique com botão esquerdo**: Abre o painel de controle.
* **Clique com botão direito**:
  - Exibe o status da sincronização.
  - Permite sincronizar tudo agora com um clique.
  - Oferece atalhos diretos para abrir cada uma das suas pastas no computador.
  - Permite pausar ou retomar a sincronização.

---

## 7. Comandos Rápidos no Terminal

* `nuvem-linux` -> Abre a interface do aplicativo.
* `nuvem-linux status` -> Mostra se o serviço está funcionando.
* `nuvem-linux logs` -> Acompanha o envio e recebimento de arquivos em tempo real.
* `nuvem-linux stop` -> Interrompe temporariamente a sincronização.

