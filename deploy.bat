rem @2021 ripple solutions(www.eripplesolutions.com), this software is free for use, modification and distribution provided you maintain this header and everything in it
@echo off
cd F:\PServer\api\NODE_PROJECTS\api_workspace\elites-choice-api
echo enter action (allowed values are build, deploy, rules,indexes)
SET /P ACTION=

if %ACTION%=="" (
   goto end
)

goto %ACTION%
goto end

:build
SET BUILD=call emulate.bat
%BUILD%
goto end

:deploy
SET FB_PROJECT_ELITES=elites-choice
echo enter project (allowed values are elites)

SET /P PROJECT=
SET /P FB_PROJECT=
SET /P COPY_CONFIG=
if %PROJECT%==elites (
   SET FB_PROJECT=%FB_PROJECT_ELITES%
   SET COPY_CONFIG=copy /Y .firebaserc-elites .firebaserc
)
SET SET_PROJECT=firebase use %FB_PROJECT%
echo "deploying to only func:api, add other functions here of you have made modifications in them"
echo first change memory profile and environment variable to .prod
echo
echo
SET DEPLOY_PROJECT=firebase deploy --only functions:api

%SET_PROJECT% && %COPY_CONFIG% &&%DEPLOY_PROJECT%
goto end

:rules
SET DEPLOY_RULES=firebase deploy --only firestore:rules
%DEPLOY_RULES%

:indexes
SET DEPLOY_INDEX=firebase deploy --only firestore:indexes
%DEPLOY_INDEX%

goto end

:end
exit

rem firebase functions:log
rem firebase functions:log --only api