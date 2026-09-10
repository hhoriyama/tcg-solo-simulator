@echo off
chcp 65001 >nul
setlocal
echo ============================================
echo  カードデータ＋画像 取得
echo ============================================
echo.
if "%CARDLIST_BASE%"=="" (
  echo  環境変数 CARDLIST_BASE に取得先のベースURLを設定してください。
  echo    例: set CARDLIST_BASE=https://example.com
  echo.
  pause
  exit /b 1
)
if "%~1"=="" (
  echo  使い方: get_cards.bat ^<英字タイトル^>
  echo    例: get_cards.bat SAMPLE
  echo.
  pause
  exit /b 1
)
node fetch_cards.js --titlematch %~1 --out cards_%~1.csv --images images
echo.
echo  終わりました。cards_%~1.csv / images\ ができています。
echo.
echo  1) index.html をブラウザで開く
echo  2) 「① カード管理」→「CSVファイルを選ぶ…」→ cards_%~1.csv
echo.
pause
