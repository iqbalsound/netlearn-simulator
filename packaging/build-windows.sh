#!/bin/sh
# Builds a portable Windows ZIP (unzip anywhere, double-click NetLearn-Simulator.bat).
# For a real Setup.exe, compile packaging/windows/installer.iss with Inno Setup on Windows.
set -e
VER="${VERSION:-0.2}"; VER="${VER#v}"; ROOT="$(cd "$(dirname "$0")/.." && pwd)"; W="$ROOT/build/windows"
rm -rf "$W"; mkdir -p "$W/app" "$ROOT/dist"
cp -r "$ROOT/index.html" "$ROOT/css" "$ROOT/js" "$ROOT/README.md" "$W/app/"
cp "$ROOT/packaging/windows/NetLearn-Simulator.bat" "$W/"
( cd "$W" && zip -qr "$ROOT/dist/NetLearn-Simulator-$VER-windows-portable.zip" . )
echo "Built dist/NetLearn-Simulator-$VER-windows-portable.zip"
