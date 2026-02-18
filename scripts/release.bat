@echo off
REM ========================================
REM PoopBuddy - Release Build Script
REM Builds signed APK for Play Store upload
REM ========================================

echo [1/4] Syncing web assets...
copy /Y index.js www\index.js
copy /Y index.html www\index.html
copy /Y index.css www\index.css

echo [2/4] Capacitor sync...
call npx cap sync android

echo [3/4] Building release AAB...
call android\gradlew.bat -p android bundleRelease

echo [4/4] Locating output...
dir /B android\app\build\outputs\bundle\release\*.aab

echo ========================================
echo   Release bundle ready! 📦
echo   Upload to Google Play Console:
echo   android\app\build\outputs\bundle\release\app-release.aab
echo ========================================
pause
