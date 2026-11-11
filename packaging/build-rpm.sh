#!/bin/sh
# Build an .rpm (Fedora, RHEL, Rocky, Alma, openSUSE). Needs: sudo dnf install rpm-build
set -e
VER="${VERSION:-0.2}"; VER="${VER#v}"; ROOT="$(cd "$(dirname "$0")/.." && pwd)"
command -v rpmbuild >/dev/null || { echo "Install rpm-build first (sudo dnf install rpm-build)"; exit 1; }
mkdir -p "$HOME/rpmbuild/SOURCES" "$ROOT/dist"
T="$(mktemp -d)"; mkdir "$T/netlearn-simulator-$VER"
cp -r "$ROOT/index.html" "$ROOT/css" "$ROOT/js" "$ROOT/README.md" "$ROOT/packaging" "$T/netlearn-simulator-$VER/"
tar -C "$T" -czf "$HOME/rpmbuild/SOURCES/netlearn-simulator-$VER.tar.gz" "netlearn-simulator-$VER"
sed "s/^Version:.*/Version:    $VER/" "$ROOT/packaging/netlearn-simulator.spec" > "$T/netlearn-simulator.spec"
rpmbuild -bb "$T/netlearn-simulator.spec"
cp "$HOME"/rpmbuild/RPMS/noarch/netlearn-simulator-$VER-*.rpm "$ROOT/dist/"
echo "RPM copied to dist/"
