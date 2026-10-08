@echo off
rem 내 보드게임 사이트를 켜고 브라우저로 연다. 더블클릭해서 쓴다.
rem 서버는 '내 보드게임 서버' 창(최소화)에서 돈다. 그 창을 닫으면 꺼진다.
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "URL=http://127.0.0.1:8000"
set "PY=.venv\Scripts\python.exe"

rem 이미 켜져 있으면 브라우저만 연다
call :alive && goto open

if not exist "%PY%" (
  echo [오류] 파이썬 가상환경 .venv 가 없습니다. README.md의 처음 설치를 따라 주세요.
  pause
  exit /b 1
)

rem 화면 코드가 마지막 빌드보다 새로우면 다시 빌드한다
powershell -NoProfile -Command "$d = 'frontend\dist\index.html'; if (-not (Test-Path $d)) { exit 1 }; $t = (Get-Item $d).LastWriteTime; $new = Get-ChildItem 'frontend\src', 'frontend\index.html' -Recurse -File | Where-Object { $_.LastWriteTime -gt $t }; if ($new) { exit 1 } else { exit 0 }"
if errorlevel 1 (
  echo 화면을 빌드합니다...
  call npm --prefix frontend run build >nul
  if errorlevel 1 (
    echo [오류] 화면 빌드에 실패했습니다.
    pause
    exit /b 1
  )
)

echo 서버를 켭니다. 끄려면 '내 보드게임 서버' 창을 닫으세요.
start "내 보드게임 서버" /min "%PY%" -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000

rem 켜질 때까지 최대 30초 기다린다
for /l %%i in (1,1,30) do (
  call :alive && goto open
  timeout /t 1 /nobreak >nul
)
echo [오류] 서버가 켜지지 않았습니다. '내 보드게임 서버' 창의 메시지를 확인해 주세요.
pause
exit /b 1

:open
rem BGH_NO_BROWSER가 있으면 브라우저를 열지 않는다 (시험용)
if not defined BGH_NO_BROWSER start "" "%URL%"
exit /b 0

:alive
powershell -NoProfile -Command "try { $r = Invoke-RestMethod -TimeoutSec 2 '%URL%/api/health'; if ($r.status -eq 'ok') { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
exit /b %errorlevel%
