#!/usr/bin/env bash
set -euo pipefail
systemctl --user disable --now nuvem-linux.service || true
rm -f "$HOME/.config/systemd/user/nuvem-linux.service"
systemctl --user daemon-reload
printf 'Serviço removido. Configurações, tokens e arquivos sincronizados foram mantidos.\n'
