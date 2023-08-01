@echo off
SET KILL_NODE=taskkill /im node.exe /F
SET KILL_EMULATOR=taskkill /im java.exe /F
%KILL_EMULATOR%
%KILL_NODE%