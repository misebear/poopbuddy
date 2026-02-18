@echo off
REM ========================================
REM PoopBuddy - Local Web Server
REM Serves the web version on localhost:8080
REM ========================================

echo Starting PoopBuddy web server on http://localhost:8080 ...
echo Press Ctrl+C to stop.

REM Use Python if available, otherwise use npx serve
where python >nul 2>nul
if %errorlevel%==0 (
    cd www
    python -m http.server 8080
) else (
    npx -y serve www -l 8080 --no-clipboard
)
