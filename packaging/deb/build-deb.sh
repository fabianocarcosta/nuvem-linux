#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
PKG_NAME="nuvem-linux"
VERSION="0.1.0"
ARCH="amd64"
STAGE_DIR="$SCRIPT_DIR/build/${PKG_NAME}_${VERSION}_${ARCH}"
OUTPUT_DIR="$ROOT_DIR/dist-packages"

echo "==> Compilando o frontend (Vite)..."
cd "$ROOT_DIR"
npm run build

echo "==> Limpando diretório de montagem..."
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR/DEBIAN"
mkdir -p "$STAGE_DIR/opt/$PKG_NAME"
mkdir -p "$STAGE_DIR/usr/bin"
mkdir -p "$STAGE_DIR/usr/share/applications"
mkdir -p "$STAGE_DIR/usr/share/icons/hicolor/scalable/apps"
mkdir -p "$STAGE_DIR/usr/share/icons/hicolor/512x512/apps"
mkdir -p "$STAGE_DIR/usr/lib/systemd/user"
mkdir -p "$STAGE_DIR/usr/share/nautilus-python/extensions"
mkdir -p "$STAGE_DIR/usr/share/icons/hicolor/scalable/status"
mkdir -p "$OUTPUT_DIR"

echo "==> Copiando arquivos do aplicativo..."
cp "$ROOT_DIR/server.js" "$STAGE_DIR/opt/$PKG_NAME/"
cp "$ROOT_DIR/package.json" "$STAGE_DIR/opt/$PKG_NAME/"
cp "$ROOT_DIR/LICENSE" "$STAGE_DIR/opt/$PKG_NAME/"
cp "$ROOT_DIR/NOTICE.md" "$STAGE_DIR/opt/$PKG_NAME/"
cp "$ROOT_DIR/README.md" "$STAGE_DIR/opt/$PKG_NAME/"
cp "$ROOT_DIR/MANUAL.md" "$STAGE_DIR/opt/$PKG_NAME/"
cp -r "$ROOT_DIR/lib" "$STAGE_DIR/opt/$PKG_NAME/"
cp -r "$ROOT_DIR/dist" "$STAGE_DIR/opt/$PKG_NAME/"
cp -r "$ROOT_DIR/scripts" "$STAGE_DIR/opt/$PKG_NAME/"
cp -r "$ROOT_DIR/systemd" "$STAGE_DIR/opt/$PKG_NAME/"

mkdir -p "$STAGE_DIR/usr/share/doc/$PKG_NAME"
cp "$ROOT_DIR/LICENSE" "$STAGE_DIR/usr/share/doc/$PKG_NAME/copyright"
cp "$ROOT_DIR/NOTICE.md" "$STAGE_DIR/usr/share/doc/$PKG_NAME/"
cp "$ROOT_DIR/MANUAL.md" "$STAGE_DIR/usr/share/doc/$PKG_NAME/"

echo "==> Copiando node_modules de produção..."
# Copia apenas dependências essenciais de produção se existirem, excluindo devDependencies
cp -r "$ROOT_DIR/node_modules" "$STAGE_DIR/opt/$PKG_NAME/"
rm -rf "$STAGE_DIR/opt/$PKG_NAME/node_modules/vite"
rm -rf "$STAGE_DIR/opt/$PKG_NAME/node_modules/esbuild"
rm -rf "$STAGE_DIR/opt/$PKG_NAME/node_modules/rollup"
rm -rf "$STAGE_DIR/opt/$PKG_NAME/node_modules/@rollup"
rm -rf "$STAGE_DIR/opt/$PKG_NAME/node_modules/@esbuild"
rm -rf "$STAGE_DIR/opt/$PKG_NAME/node_modules/concurrently"

echo "==> Instalando binários e atalhos de sistema..."
cp "$ROOT_DIR/packaging/bin/nuvem-linux" "$STAGE_DIR/usr/bin/nuvem-linux"
chmod +x "$STAGE_DIR/usr/bin/nuvem-linux"

cp "$ROOT_DIR/packaging/assets/nuvem-linux.desktop" "$STAGE_DIR/usr/share/applications/"
cp "$ROOT_DIR/packaging/assets/nuvem-linux.svg" "$STAGE_DIR/usr/share/icons/hicolor/scalable/apps/"
cp "$ROOT_DIR/packaging/assets/nuvem-linux.png" "$STAGE_DIR/usr/share/icons/hicolor/512x512/apps/"
cp -r "$ROOT_DIR/packaging/assets/icons/"* "$STAGE_DIR/usr/share/icons/hicolor/scalable/status/"
cp "$ROOT_DIR/packaging/nautilus/nuvem_nautilus.py" "$STAGE_DIR/usr/share/nautilus-python/extensions/"

# Systemd user service unit template
cat > "$STAGE_DIR/usr/lib/systemd/user/nuvem-linux.service" <<UNIT
[Unit]
Description=Nuvem Linux - sincronização do Google Drive
After=default.target network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/nuvem-linux
Environment=PATH=%h/.local/bin:/usr/local/bin:/usr/bin:/bin
Environment=RCLONE_DRIVE_USE_TRASH=true
ExecStart=/usr/bin/node /opt/nuvem-linux/server.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=false
ReadWritePaths=%h

[Install]
WantedBy=default.target
UNIT

echo "==> Copiando scripts de controle DEBIAN..."
cp "$SCRIPT_DIR/postinst" "$STAGE_DIR/DEBIAN/postinst"
cp "$SCRIPT_DIR/prerm" "$STAGE_DIR/DEBIAN/prerm"
chmod 755 "$STAGE_DIR/DEBIAN/postinst" "$STAGE_DIR/DEBIAN/prerm"

# Calcula tamanho instalado em KB
INSTALLED_SIZE=$(du -sk "$STAGE_DIR" | cut -f1)

cat > "$STAGE_DIR/DEBIAN/control" <<EOF
Package: $PKG_NAME
Version: $VERSION
Section: utils
Priority: optional
Architecture: $ARCH
Installed-Size: $INSTALLED_SIZE
Maintainer: Fabiano Carvalho da Costa <fabianocarvalhodacosta@gmail.com>
Depends: nodejs (>= 18.0.0) | nodejs, rclone (>= 1.71.0) | rclone, zenity, libnotify-bin
Recommends: python3-nautilus, python3-dbus
Homepage: https://github.com/fabiano/nuvem-linux
Description: Cliente de sincronizacao bidirecional do Google Drive para Linux
 Aplicativo nativo para sincronizar pastas locais nos dois sentidos com
 o Google Drive usando rclone bisync, com resolucao segura de conflitos,
 integracao com a lixeira do desktop e painel web moderno.
EOF

echo "==> Ajustando permissões..."
find "$STAGE_DIR" -type d -exec chmod 755 {} +
find "$STAGE_DIR" -type f -exec chmod 644 {} +
chmod 755 "$STAGE_DIR/usr/bin/nuvem-linux"
chmod 755 "$STAGE_DIR/DEBIAN/postinst" "$STAGE_DIR/DEBIAN/prerm"

echo "==> Empacotando com dpkg-deb..."
dpkg-deb --build --root-owner-group "$STAGE_DIR" "$OUTPUT_DIR/${PKG_NAME}_${VERSION}_${ARCH}.deb"

echo ""
echo "✅ Pacote .deb gerado com sucesso em:"
echo "   $OUTPUT_DIR/${PKG_NAME}_${VERSION}_${ARCH}.deb"
ls -lh "$OUTPUT_DIR/${PKG_NAME}_${VERSION}_${ARCH}.deb"

