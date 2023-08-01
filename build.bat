@echo off
rem taskkill /im node.exe /F && taskkill /im java.exe /F
SET KILL_NODE=taskkill /im node.exe /F
SET KILL_EMULATOR=taskkill /im java.exe /F
SET CLEAN=rmdir dist /s /q
SET LINK=call link.bat
SET BUILD=npm run-script build
SET COPY_BUILD=Xcopy /E /I .\src\emails\templates .\dist\emails\templates
rem SET COPY_BUILD=copy /Y .\package.json .\dist\package.json
SET EMULATE=call emulate.bat
rem %KILL_EMULATOR%
rem %KILL_NODE%
goto clean

:clean
%CLEAN%

goto link

:link
%LINK%

goto build

:build
call link.bat
%LINK%&&%BUILD%&&%EMULATE%
rem %BUILD%&&%COPY_BUILD%&&%EMULATE%
