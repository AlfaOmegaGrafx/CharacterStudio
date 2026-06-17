@echo off
cd /d "%~dp0.."
"C:\Program Files\nodejs\node.exe" "%~dp0..\node_modules\vite\bin\vite.js" --host <SURFACE_LAN_IP> --strictPort false
