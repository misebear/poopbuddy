@echo off
REM ========================================
REM PoopBuddy - Build & Deploy Script
REM Run from project root: scripts\deploy.bat
REM ========================================

echo [1/5] Syncing web assets...
copy /Y index.js www\index.js
copy /Y index.html www\index.html  
copy /Y index.css www\index.css
echo Done.

echo [2/5] Capacitor sync...
call npx cap sync android
echo Done.

echo [3/5] Building debug APK...
call android\gradlew.bat -p android assembleDebug
echo Done.

echo [4/5] Installing to device...
set ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe
%ADB% install -r android\app\build\outputs\apk\debug\app-debug.apk
echo Done.

echo [5/5] Launching app...
%ADB% shell am start -n com.poopbuddy.app/.MainActivity
echo Done.

echo ========================================
echo   PoopBuddy deployed successfully! 🐾
echo ========================================
pause
