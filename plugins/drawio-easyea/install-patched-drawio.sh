#!/bin/bash
set -e

echo "=== Installazione Draw.io Desktop Nativo con Supporto Plugin EasyEA ==="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEB_FILE="$SCRIPT_DIR/drawio-easyea-patched.deb"

if [ ! -f "$DEB_FILE" ]; then
    echo "Errore: File $DEB_FILE non trovato."
    exit 1
fi

echo "[1/2] Rimozione eventuale versione Snap confinata..."
if command -v snap &>/dev/null && snap list drawio &>/dev/null; then
    echo "Disinstallazione snap drawio..."
    sudo snap remove drawio
else
    echo "Nessuna versione Snap di drawio installata."
fi

echo "[2/2] Installazione pacchetto nativo patchato..."
sudo dpkg -i "$DEB_FILE" || sudo apt-get install -f -y

echo ""
echo "✅ Installazione completata con successo!"
echo "Ora Draw.io Desktop include nativamente il plugin EasyEA."
echo "Puoi avviarlo con: drawio"
