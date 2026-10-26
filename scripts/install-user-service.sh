#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
node_bin="$(command -v node)"
mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/nuvem-linux.service" <<UNIT
[Unit]
Description=Nuvem Linux - sincronização do Google Drive
After=default.target network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$project_dir
Environment=PATH=$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin
Environment=RCLONE_DRIVE_USE_TRASH=true
ExecStart=$node_bin $project_dir/server.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=false
ReadWritePaths=$HOME

[Install]
WantedBy=default.target
UNIT
systemctl --user daemon-reload
systemctl --user enable --now nuvem-linux.service
printf 'Serviço instalado e iniciado. Logs: journalctl --user -u nuvem-linux.service -f\n'
printf 'Painel: http://localhost:4173\n'
