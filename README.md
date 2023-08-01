# elites-choice-api

Api for elite choice investments web app

## deployment failures

- Check package.json and make sure all dependencies referenced in code appear
- set variables for functions.runWith e.g. timeoutSeconds, including them in the configuration and setting them to
  undefined caused deployment errors(No HTTPS URL function triggers)
- Invoking https://us-central1-retail-koncepts-app.cloudfunctions.net/api returns 403 - forbidden. Clients need to
  authenticate their requests using fireAuth

## Errors

- The Firebase ID token has been revoked
    - check that the system time and server time are in sync
    - changed my clock time zone to UTC+00:00, however, running nestjs out of the api function used the system time zone
    - running it inside the api function used UTC+00:00 yet my system clock was on UTC+3:00

## …or create a new repository on the command line

echo "# retail_koncepts_api" >> README.md git init git add README.md git commit -m "first commit"
git branch -M main git remote add origin https://github.com/Ajohnie/retail_koncepts_api.git
git push -u origin main

## …or push an existing repository from the command line

git remote add origin https://github.com/Ajohnie/retail_koncepts_api.git
git branch -M main git push -u origin main

## EMAIL OVER GMAIL fails with error - Please login and try again

- allow less secure apps in accounts management
- head over to [https://accounts.google.com/DisplayUnlockCaptcha], sign in with the account using to send emails and
  click continue

## Cors Error when project is created from template

- change cors variable in main.ts

## Partial Error when uploading to efris

- check all data fields and make sure the correct values are submitted
- for example, when saving a purchase, measureUnit needs to be unit value instead of init name
- it usually means not all fields could be validated successfully

## Gateway timeout

- caused by failure to scale automatically by google cloud

## document not found in firebase yet it has been confirmed to exist
- if firebase field expects number but you pass string for id,
then query fails so convert string to number for success, I used isNaN(idValue)?idValue:parseInt(idValue,0)
- it was caused by number being converted to a string when passed as a query parameter