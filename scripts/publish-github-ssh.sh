#!/bin/sh
# Push to GitHub over SSH (no GitHub CLI needed).
# Usage: sh scripts/publish-github-ssh.sh git@github.com:YOUR-USER/netlearn-simulator.git
set -e
URL="$1"; [ -n "$URL" ] || { echo "Usage: $0 git@github.com:USER/REPO.git"; exit 1; }
cd "$(dirname "$0")/.."
if [ ! -f "$HOME/.ssh/id_ed25519.pub" ]; then
  ssh-keygen -t ed25519 -C "iqbalsound@yahoo.com" -f "$HOME/.ssh/id_ed25519"
  echo; echo "Add this PUBLIC key at GitHub > Settings > SSH and GPG keys > New SSH key:"; cat "$HOME/.ssh/id_ed25519.pub"
  echo; echo "Then run this script again."; exit 0
fi
eval "$(ssh-agent -s)" >/dev/null; ssh-add "$HOME/.ssh/id_ed25519"
ssh -o StrictHostKeyChecking=accept-new -T git@github.com || true   # "successfully authenticated" is expected
[ -d .git ] || git init -b main
git add -A; git commit -m "NetLearn Simulator - Phase 1" || true
git remote remove origin 2>/dev/null || true; git remote add origin "$URL"
git push -u origin main
