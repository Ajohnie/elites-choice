@echo off
firebase emulators:start --only functions,firestore,auth,storage --import ./backups --export-on-exit

