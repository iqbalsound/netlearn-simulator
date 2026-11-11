# Releasing NetLearn Simulator (git over SSH, no GitHub CLI)

Repo: `git@github.com:YOUR-USER/netplanIqbal.git`

## 1. One-time SSH setup
```
ssh-keygen -t ed25519 -C "iqbalsound@yahoo.com"
cat ~/.ssh/id_ed25519.pub          # paste at GitHub > Settings > SSH and GPG keys > New SSH key
ssh -T git@github.com              # expect: "Hi YOUR-USER! You've successfully authenticated"
```

## 2. Push the code
```
unzip netlearn-simulator-v0.2-project.zip && cd netlearn-simulator
git config user.name "Iqbal Uddin Khan"; git config user.email "iqbalsound@yahoo.com"
git init -b main && git add -A && git commit -m "NetLearn Simulator v0.2"
git remote add origin git@github.com:YOUR-USER/netplanIqbal.git
git push -u origin main
```
If the repo already has commits (README/licence created on the web): `git pull --rebase origin main --allow-unrelated-histories` first, then push.

## 3. Create the APT signing key (once, on your laptop)
```
gpg --full-generate-key            # RSA 4096, no expiry, name "NetLearn APT", set a passphrase
gpg --list-secret-keys --keyid-format long      # note the key id after rsa4096/
gpg --armor --export-secret-keys KEYID          # copy the whole block
```
GitHub repo > Settings > Secrets and variables > Actions > New repository secret:
* `APT_GPG_PRIVATE_KEY` = the exported block
* `APT_GPG_PASSPHRASE` = your passphrase (leave empty if none)

## 4. Allow the workflow to publish
Settings > Actions > General > Workflow permissions > **Read and write permissions** > Save.

## 5. Release v0.2
```
git tag -a v0.2 -m "NetLearn Simulator v0.2"
git push origin v0.2
```
GitHub > Actions > "Build and release" builds the DEB, RPM, Windows Setup.exe + portable zip, creates the Release, and publishes the APT repo to the `gh-pages` branch.

## 6. Turn on Pages (once, after the first run created gh-pages)
Settings > Pages > Source: **Deploy from a branch** > `gh-pages` / `/ (root)`. The simulator itself is then online at `https://YOUR-USER.github.io/netplanIqbal/` and the repo at `.../apt`.

## 7. Install from the APT repo (users)
```
curl -fsSL https://YOUR-USER.github.io/netplanIqbal/apt/KEY.gpg | sudo gpg --dearmor -o /usr/share/keyrings/netlearn.gpg
echo "deb [signed-by=/usr/share/keyrings/netlearn.gpg] https://YOUR-USER.github.io/netplanIqbal/apt stable main" | sudo tee /etc/apt/sources.list.d/netlearn.list
sudo apt update && sudo apt install netlearn-simulator
```
RPM: `sudo dnf install ./netlearn-simulator-0.2-1.noarch.rpm` (from the Release page). Windows: run `NetLearn-Simulator-0.2-Setup.exe` (unsigned: SmartScreen > More info > Run anyway).

## Next release
Change the version text in `js/ui/about-modal.js`, commit, push, then `git tag -a v0.3 -m "v0.3" && git push origin v0.3`. Re-run a failed build: Actions > the run > Re-run jobs. Wrong tag: `git tag -d v0.2 && git push origin :refs/tags/v0.2`.
