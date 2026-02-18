@echo off
echo ====================================
echo  PoopBuddy Android Build Script
echo ====================================
echo.

echo [1/3] Copying web assets to www...
copy /Y index.html www\
copy /Y index.js www\
copy /Y index.css www\
copy /Y manifest.json www\
copy /Y sw.js www\
copy /Y health-db.json www\
if exist icon.svg copy /Y icon.svg www\
if exist icon-192.png copy /Y icon-192.png www\
if exist icon-512.png copy /Y icon-512.png www\

echo [2/3] Syncing Capacitor...
call npx cap sync android

echo [3/3] Building debug APK...
cd android
call gradlew assembleDebug

echo.
echo ====================================
echo  BUILD COMPLETE!
echo  APK: android\app\build\outputs\apk\debug\app-debug.apk
echo ====================================
pause
