#!/bin/bash
set -e

# Run from the repo root (`make ssl`). Writes docker/edge/ssl/, which is gitignored.
DIR="docker/edge/ssl"
CRT="$DIR/star.megaphone.local.crt"
KEY="$DIR/star.megaphone.local.key"

mkdir -p "$DIR"

# Keep an existing, still-valid certificate. Trusting the cert is a one-time sudo
# step, and regenerating silently invalidates it. Pass FORCE=1 to replace it.
if [ -z "$FORCE" ] && [ -f "$CRT" ] && [ -f "$KEY" ]; then
    if openssl x509 -in "$CRT" -noout -checkend 0 >/dev/null 2>&1; then
        EXPIRY=$(openssl x509 -in "$CRT" -noout -enddate | cut -d= -f2)
        echo "SSL certificate already present and valid until $EXPIRY — keeping it."
        echo "  (it stays trusted; run 'FORCE=1 make ssl' to replace it)"
        exit 0
    fi
    echo "Existing SSL certificate has expired — regenerating..."
fi

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$KEY" \
    -out "$CRT" \
    -subj "/CN=*.megaphone.local" \
    -addext "subjectAltName=DNS:megaphone.local,DNS:*.megaphone.local"

echo "SSL certificates generated in $DIR/"
echo ""
echo "To trust the certificate on macOS, run:"
echo "  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain $CRT"
