#!/usr/bin/env bash
# Build/refresh a signed APT repository inside a Pages site folder.
# Usage: bash scripts/make-apt-repo.sh <site-dir> <dir-with-new-.deb-files>
# Result: <site-dir>/apt/{pool,dists,KEY.gpg,index.html}. Old .deb versions already in the pool are kept.
# Signing uses the first secret key in the current GPG keyring (CI imports it from a secret).
set -euo pipefail
SITE="$1"; NEW="$2"; APT="$SITE/apt"; SUITE=stable; ARCHS="all amd64 arm64"
mkdir -p "$APT/pool/main/n/netlearn-simulator"
cp "$NEW"/*.deb "$APT/pool/main/n/netlearn-simulator/"
cd "$APT"
rm -rf "dists/$SUITE"; for a in $ARCHS; do mkdir -p "dists/$SUITE/main/binary-$a"; done
# Packages index (the package is Architecture: all, so we publish the same index for every architecture)
dpkg-scanpackages --multiversion pool /dev/null > Packages.tmp 2>/dev/null
for a in $ARCHS; do cp Packages.tmp "dists/$SUITE/main/binary-$a/Packages"; gzip -9kf "dists/$SUITE/main/binary-$a/Packages"; done
rm -f Packages.tmp
# Release file (written by hand so no apt-utils is needed): hashes + sizes of every index file
{
  echo "Origin: NetLearn"; echo "Label: NetLearn Simulator"; echo "Suite: $SUITE"; echo "Codename: $SUITE"
  echo "Date: $(LC_ALL=C date -Ru)"; echo "Architectures: $ARCHS"; echo "Components: main"
  echo "Description: NetLearn Simulator - by Iqbal"
  echo "SHA256:"
  (cd "dists/$SUITE" && find main -type f | sort | while read -r f; do printf ' %s %16d %s\n' "$(sha256sum "$f" | cut -d' ' -f1)" "$(stat -c %s "$f")" "$f"; done)
} > "dists/$SUITE/Release"
KEYID="$(gpg --list-secret-keys --with-colons 2>/dev/null | awk -F: '/^fpr/ {print $10; exit}')"
if [ -n "$KEYID" ]; then
  PASS=(); [ -n "${APT_GPG_PASSPHRASE:-}" ] && PASS=(--passphrase "$APT_GPG_PASSPHRASE")
  G=(gpg --batch --yes --pinentry-mode loopback "${PASS[@]}" --default-key "$KEYID")
  "${G[@]}" -abs -o "dists/$SUITE/Release.gpg" "dists/$SUITE/Release"
  "${G[@]}" --clearsign -o "dists/$SUITE/InRelease" "dists/$SUITE/Release"
  gpg --armor --export "$KEYID" > KEY.gpg
  echo "Signed with key $KEYID"
else
  echo "WARNING: no GPG key found - repository is UNSIGNED (users need [trusted=yes])" >&2
fi
cat > index.html <<'HTML'
<!doctype html><meta charset="utf-8"><title>NetLearn Simulator APT repository</title>
<body style="font:15px system-ui;max-width:760px;margin:2rem auto;padding:0 1rem"><h1>NetLearn Simulator - APT repository</h1>
<pre>curl -fsSL https://REPLACE_USER.github.io/REPLACE_REPO/apt/KEY.gpg | sudo gpg --dearmor -o /usr/share/keyrings/netlearn.gpg
echo "deb [signed-by=/usr/share/keyrings/netlearn.gpg] https://REPLACE_USER.github.io/REPLACE_REPO/apt stable main" | sudo tee /etc/apt/sources.list.d/netlearn.list
sudo apt update &amp;&amp; sudo apt install netlearn-simulator</pre>
<p>Run online: <a href="../">NetLearn Simulator</a></p></body>
HTML
# fill in the real Pages URL when running in GitHub Actions
if [ -n "${GITHUB_REPOSITORY:-}" ]; then sed -i "s#REPLACE_USER#${GITHUB_REPOSITORY%%/*}#g; s#REPLACE_REPO#${GITHUB_REPOSITORY##*/}#g" index.html; fi
echo "APT repo ready in $APT"
