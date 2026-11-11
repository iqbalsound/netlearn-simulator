Name:       netlearn-simulator
Version:    0.2
Release:    1%{?dist}
Summary:    NetLearn Simulator - educational network simulator
License:    TBD
BuildArch:  noarch
Source0:    %{name}-%{version}.tar.gz
Requires:   xdg-utils

%description
Browser-based, offline network simulator for classrooms by Iqbal Uddin Khan.
Simplified behaviour for learning; does not run real vendor firmware.

%prep
%setup -q

%install
mkdir -p %{buildroot}/usr/share/netlearn-simulator %{buildroot}/usr/bin %{buildroot}/usr/share/applications
cp -r index.html css js README.md %{buildroot}/usr/share/netlearn-simulator/
install -m 755 packaging/linux/netlearn-simulator %{buildroot}/usr/bin/netlearn-simulator
install -m 644 packaging/linux/netlearn-simulator.desktop %{buildroot}/usr/share/applications/

%files
/usr/share/netlearn-simulator
/usr/bin/netlearn-simulator
/usr/share/applications/netlearn-simulator.desktop

%changelog
* Wed Nov 11 2026 Iqbal Uddin Khan <iqbalsound@yahoo.com> - 0.2-1
- v0.2: configurable devices, 17 manual labs
