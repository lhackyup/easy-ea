#!/usr/bin/env bash
# EasyEA Protocol Registration Script for Linux
# Registers easyea:// protocol handler for the current user

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HANDLER_PY="$SCRIPT_DIR/easyea-handler.py"
DESKTOP_TEMPLATE="$SCRIPT_DIR/easyea-handler.desktop"

chmod +x "$HANDLER_PY"

TARGET_DIR="$HOME/.local/share/applications"
mkdir -p "$TARGET_DIR"

TARGET_DESKTOP="$TARGET_DIR/easyea-handler.desktop"

echo "Installing EasyEA Protocol Handler to $TARGET_DESKTOP..."
cat <<EOF > "$TARGET_DESKTOP"
[Desktop Entry]
Name=EasyEA Protocol Handler
Comment=EasyEA Desktop Protocol Launcher (Archi, Draw.io, Camunda)
Exec=$HANDLER_PY %u
Terminal=false
Type=Application
MimeType=x-scheme-handler/easyea;
NoDisplay=true
Categories=Development;
StartupNotify=true
EOF

chmod +x "$TARGET_DESKTOP"

echo "Registering x-scheme-handler/easyea mime type..."
xdg-mime default easyea-handler.desktop x-scheme-handler/easyea

if command -v update-desktop-database &> /dev/null; then
    update-desktop-database "$TARGET_DIR" 2>/dev/null || true
fi

echo "Verifying registration:"
CURRENT_HANDLER=$(xdg-mime query default x-scheme-handler/easyea)
echo "Default handler for x-scheme-handler/easyea is: $CURRENT_HANDLER"

if [ "$CURRENT_HANDLER" = "easyea-handler.desktop" ]; then
    echo "✓ Success: easyea:// protocol handler successfully installed and activated!"
else
    echo "⚠️ Warning: xdg-mime returned $CURRENT_HANDLER instead of easyea-handler.desktop."
fi
