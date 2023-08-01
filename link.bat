@echo off
rem set source="test"
rem set target="test3"
rem forfiles /s /P "%source%" /C "cmd /c if @isdir==TRUE (mklink /j \"%target%\@relpath\" @path ) else (mklink /h \"%target%\@relpath\" @path )"
SET CLEAN_LINKS=rmdir .\src\lib /s /q
SET COPY_LINKS=mklink /d .\src\lib C:\PServer\api\NODE_PROJECTS\angular_workspace\projects\elites-choice\lib
%CLEAN_LINKS%
%COPY_LINKS%
