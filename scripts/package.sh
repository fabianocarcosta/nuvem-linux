#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

TARGET="${1:-all}"

case "$TARGET" in
  deb)
    "$ROOT_DIR/packaging/deb/build-deb.sh"
    ;;
  appimage)
    "$ROOT_DIR/packaging/appimage/build-appimage.sh"
    ;;
  all)
    echo "============================================="
    echo "  Gerando Pacote Debian (.deb)..."
    echo "============================================="
    "$ROOT_DIR/packaging/deb/build-deb.sh"
    echo ""
    echo "============================================="
    echo "  Gerando Pacote Portátil (AppImage)..."
    echo "============================================="
    "$ROOT_DIR/packaging/appimage/build-appimage.sh"
    echo ""
    echo "============================================="
    echo "  Distribuição concluída com sucesso!"
    echo "============================================="
    ls -lh "$ROOT_DIR/dist-packages/"
    ;;
  *)
    echo "Uso: $0 [deb|appimage|all]"
    exit 1
    ;;
esac

