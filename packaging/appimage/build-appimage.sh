#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
VERSION="0.1.3"
APPDIR="$SCRIPT_DIR/build/Nuvem-Linux.AppDir"
OUTPUT_DIR="$ROOT_DIR/dist-packages"
APPIMAGE_BIN="$OUTPUT_DIR/Nuvem-Linux-${VERSION}-x86_64.AppImage"

echo "==> Compilando o frontend (Vite)..."
cd "$ROOT_DIR"
npm run build

echo "==> Preparando AppDir..."
rm -rf "$APPDIR"
mkdir -p "$APPDIR/usr/bin"
mkdir -p "$APPDIR/usr/share/applications"
mkdir -p "$APPDIR/usr/share/icons/hicolor/scalable/apps"
mkdir -p "$APPDIR/usr/share/icons/hicolor/512x512/apps"
mkdir -p "$APPDIR/opt/nuvem-linux"
mkdir -p "$OUTPUT_DIR"

echo "==> Copiando arquivos do aplicativo..."
cp "$ROOT_DIR/server.js" "$APPDIR/opt/nuvem-linux/"
cp "$ROOT_DIR/package.json" "$APPDIR/opt/nuvem-linux/"
cp "$ROOT_DIR/LICENSE" "$APPDIR/opt/nuvem-linux/"
cp "$ROOT_DIR/NOTICE.md" "$APPDIR/opt/nuvem-linux/"
cp "$ROOT_DIR/README.md" "$APPDIR/opt/nuvem-linux/"
cp "$ROOT_DIR/MANUAL.md" "$APPDIR/opt/nuvem-linux/"
cp -r "$ROOT_DIR/lib" "$APPDIR/opt/nuvem-linux/"
cp -r "$ROOT_DIR/dist" "$APPDIR/opt/nuvem-linux/"
cp -r "$ROOT_DIR/scripts" "$APPDIR/opt/nuvem-linux/"
cp -r "$ROOT_DIR/systemd" "$APPDIR/opt/nuvem-linux/"

echo "==> Copiando node_modules de produção..."
cp -r "$ROOT_DIR/node_modules" "$APPDIR/opt/nuvem-linux/"
rm -rf "$APPDIR/opt/nuvem-linux/node_modules/vite"
rm -rf "$APPDIR/opt/nuvem-linux/node_modules/esbuild"
rm -rf "$APPDIR/opt/nuvem-linux/node_modules/rollup"
rm -rf "$APPDIR/opt/nuvem-linux/node_modules/@rollup"
rm -rf "$APPDIR/opt/nuvem-linux/node_modules/@esbuild"
rm -rf "$APPDIR/opt/nuvem-linux/node_modules/concurrently"

echo "==> Incluindo runtime Node.js e rclone portátil..."
NODE_EXEC="$(command -v node)"
cp "$NODE_EXEC" "$APPDIR/usr/bin/node"
chmod +x "$APPDIR/usr/bin/node"

RCLONE_EXEC="$(command -v rclone || echo "$HOME/.local/bin/rclone")"
if [ -x "$RCLONE_EXEC" ]; then
  cp "$RCLONE_EXEC" "$APPDIR/usr/bin/rclone"
  chmod +x "$APPDIR/usr/bin/rclone"
fi

echo "==> Configurando integração do desktop..."
cp "$SCRIPT_DIR/AppRun" "$APPDIR/AppRun"
chmod +x "$APPDIR/AppRun"

cp "$ROOT_DIR/packaging/assets/nuvem-linux.desktop" "$APPDIR/nuvem-linux.desktop"
cp "$ROOT_DIR/packaging/assets/nuvem-linux.desktop" "$APPDIR/usr/share/applications/nuvem-linux.desktop"

cp "$ROOT_DIR/packaging/assets/nuvem-linux.png" "$APPDIR/nuvem-linux.png"
cp "$ROOT_DIR/packaging/assets/nuvem-linux.png" "$APPDIR/.DirIcon"
cp "$ROOT_DIR/packaging/assets/nuvem-linux.png" "$APPDIR/usr/share/icons/hicolor/512x512/apps/nuvem-linux.png"

cp "$ROOT_DIR/packaging/assets/nuvem-linux.svg" "$APPDIR/nuvem-linux.svg"
cp "$ROOT_DIR/packaging/assets/nuvem-linux.svg" "$APPDIR/usr/share/icons/hicolor/scalable/apps/nuvem-linux.svg"

cp "$ROOT_DIR/packaging/bin/nuvem-linux" "$APPDIR/usr/bin/nuvem-linux"
chmod +x "$APPDIR/usr/bin/nuvem-linux"

echo "==> Localizando ou preparando appimagetool..."
TOOLS_DIR="$SCRIPT_DIR/.tools"
mkdir -p "$TOOLS_DIR"

if [ -x "/tmp/squashfs-root/AppRun" ]; then
  APPIMAGETOOL="/tmp/squashfs-root/AppRun"
elif [ -x "$TOOLS_DIR/squashfs-root/AppRun" ]; then
  APPIMAGETOOL="$TOOLS_DIR/squashfs-root/AppRun"
else
  echo "Baixando appimagetool para geração do AppImage..."
  curl -sL "https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage" -o "$TOOLS_DIR/appimagetool"
  chmod +x "$TOOLS_DIR/appimagetool"
  cd "$TOOLS_DIR"
  "$TOOLS_DIR/appimagetool" --appimage-extract >/dev/null 2>&1
  APPIMAGETOOL="$TOOLS_DIR/squashfs-root/AppRun"
  cd "$ROOT_DIR"
fi

echo "==> Gerando AppImage..."
export ARCH=x86_64
rm -f "$APPIMAGE_BIN"
"$APPIMAGETOOL" "$APPDIR" "$APPIMAGE_BIN"

echo ""
echo "✅ AppImage gerado com sucesso em:"
echo "   $APPIMAGE_BIN"
ls -lh "$APPIMAGE_BIN"

