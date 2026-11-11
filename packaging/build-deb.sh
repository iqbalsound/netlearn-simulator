#!/bin/sh
# Build a .deb (Debian, Ubuntu, Kali, Mint). Run from anywhere: sh packaging/build-deb.sh
set -e
VER="${VERSION:-0.2}"; VER="${VER#v}"; ROOT="$(cd "$(dirname "$0")/.." && pwd)"; B="$ROOT/build/deb"; PKG="$B/netlearn-simulator_${VER}_all"
rm -rf "$B"; mkdir -p "$PKG/DEBIAN" "$PKG/usr/share/netlearn-simulator" "$PKG/usr/bin" "$PKG/usr/share/applications" "$ROOT/dist"
cp -r "$ROOT/index.html" "$ROOT/css" "$ROOT/js" "$ROOT/README.md" "$PKG/usr/share/netlearn-simulator/"
install -m 755 "$ROOT/packaging/linux/netlearn-simulator" "$PKG/usr/bin/netlearn-simulator"
install -m 644 "$ROOT/packaging/linux/netlearn-simulator.desktop" "$PKG/usr/share/applications/"
cat > "$PKG/DEBIAN/control" <<C
Package: netlearn-simulator
Version: $VER
Section: education
Priority: optional
Architecture: all
Depends: xdg-utils
Recommends: firefox | chromium | chromium-browser | google-chrome-stable
Maintainer: Iqbal Uddin Khan <iqbalsound@yahoo.com>
Description: NetLearn Simulator - educational network simulator
 Browser-based, offline network simulator for classrooms. Simplified
 behaviour for learning; does not run real vendor firmware.
C
find "$PKG" -type d -exec chmod 755 {} +
dpkg-deb --build --root-owner-group "$PKG" "$ROOT/dist/netlearn-simulator_${VER}_all.deb"
echo "Built dist/netlearn-simulator_${VER}_all.deb"
