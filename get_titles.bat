@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo ============================================================
echo  タイトル一覧 (titles.json) の取得・更新
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [エラー] Node.js が見つかりません。
  echo https://nodejs.org/ から LTS 版をインストールしてから、もう一度実行してください。
  echo.
  pause
  exit /b 1
)

node fetch_cards.js --dump-titles titles.json
if errorlevel 1 (
  echo.
  echo [エラー] 取得に失敗しました。ネットワーク接続を確認してください。
  echo.
  pause
  exit /b 1
)

echo.
echo ------------------------------------------------------------
echo  titles.json を更新しました（数秒で終わります／画像は落としません）。
echo  index.html →「② デッキ構築」→「タイトル一覧(JSON)を読込」→ titles.json
echo ------------------------------------------------------------
echo.
pause
