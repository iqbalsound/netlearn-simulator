# NetLearn Simulator - by Iqbal (v0.2)

Educational network simulator that runs in a browser, fully offline. It simulates behaviour for learning; it does **not** run real vendor firmware.

**Author:** Iqbal Uddin Khan, Assistant Professor, DIT, Hamdard University - iqbalsound@yahoo.com

## Run
Open `index.html` (double-click). Plain `<script>` tags are used, so no server is needed.

## What is new in v0.2
* **Real addressing:** every NIC has a MAC, IPv4 and IPv6 address, DHCP client option, up/down state.
* **Switch ports:** access / trunk (802.1Q) / out-of-band per port, VLAN IDs, allowed VLANs, native VLAN, SVIs (L3 switch), MAC learning.
* **Router config:** interface IPs, VLAN sub-interfaces, static routes, RIP/RIPng, OSPF/OSPFv3, DHCP server + relay, NAT masquerade (PAT), stateful firewall (order matters), DNS, tunnels (GRE, IP-in-IP, 6in4, IPsec concept, WireGuard concept).
* **Wi-Fi:** access points (SSID, WPA2 password) and PCs/laptops with a Wi-Fi NIC; wrong password = "authentication failed".
* **Terminal per device:** `ping`, `trace`, `show ip`, `ip route print`, `nmap`, `curl`, `nslookup`, `wg show`, MikroTik-style `ip address add ...`.
* **17 labs from the Computer Networks Lab Manual (Labs 01-15)** + Wi-Fi and ARP demos. Each lab has objective, steps, hints, **Check my work** and **Show solution**.
* Tabs: *Lab* (instructions), *Device* (Config + live Tables), bottom *Event log* / *Terminal*. Toolbar: Converge +60 s, Control packets, Subnet calculator.

## Install packages
| Platform | Build | Install |
|---|---|---|
| Debian/Ubuntu/Kali | `sh packaging/build-deb.sh` | `sudo apt install ./dist/netlearn-simulator_0.2_all.deb` |
| Fedora/RHEL/openSUSE | `sh packaging/build-rpm.sh` (needs `rpm-build`) | `sudo dnf install ./dist/netlearn-simulator-0.2-1*.rpm` |
| Windows | `sh packaging/build-windows.sh` (Git Bash/WSL) | unzip, double-click `NetLearn-Simulator.bat`; or compile `packaging/windows/installer.iss` with Inno Setup |

## Publish to GitHub over SSH
`sh scripts/publish-github-ssh.sh git@github.com:YOUR-USER/netlearn-simulator.git` (the first run creates an SSH key and prints it; add it at GitHub > Settings > SSH keys, then run again).

## Simplifications (so students are not misled)
* Not real firmware; CLIs are command subsets, not full IOS/RouterOS/Junos (Phase 3).
* RIP/OSPF are real message exchanges but simplified (OSPF: Down/Init/Full only, no DR/BDR, one flat area). No EIGRP/BGP yet.
* IPv6 shares the IPv4 code path (no link-local addresses, no DAD). Lab 15 uses 1000::1/64 on R1-R2 instead of the manual's 1000:1:1:1:1:1:1:1158/112, which is not on-link.
* TCP is reduced to SYN / SYN-ACK / RST / one request-response; IPsec and WireGuard have no real cryptography.
* Lab 14: Open vSwitch + Faucet are modelled as VLAN-aware L3 switches; real OpenFlow flow tables come in Phase 8.
* nmap/OS detection is a simulated engine reading the target's configured services (scan only your own lab).
* Wi-Fi ignores distance/channels; no STP yet (a loop guard prevents broadcast storms).
