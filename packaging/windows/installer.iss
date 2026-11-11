; Inno Setup script (free: https://jrsoftware.org/isinfo.php). Build on Windows:
;   1) run packaging\build-windows.sh (or copy files to build\windows\app)
;   2) open this file in Inno Setup and press Compile -> Output\NetLearn-Simulator-Setup.exe
#ifndef AppVersion
  #define AppVersion "0.2"
#endif

[Setup]
AppName=NetLearn Simulator
AppVersion={#AppVersion}
AppPublisher=Iqbal Uddin Khan
DefaultDirName={autopf}\NetLearn Simulator
DefaultGroupName=NetLearn Simulator
OutputDir=..\..\dist
OutputBaseFilename=NetLearn-Simulator-{#AppVersion}-Setup
Compression=lzma
PrivilegesRequired=lowest

[Files]
Source: "..\..\build\windows\app\*"; DestDir: "{app}\app"; Flags: recursesubdirs
Source: "NetLearn-Simulator.bat"; DestDir: "{app}"

[Icons]
Name: "{group}\NetLearn Simulator"; Filename: "{app}\NetLearn-Simulator.bat"
Name: "{autodesktop}\NetLearn Simulator"; Filename: "{app}\NetLearn-Simulator.bat"
