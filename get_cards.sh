#!/bin/sh
# 使い方: CARDLIST_BASE=https://example.com ./get_cards.sh SAMPLE
set -e
if [ -z "$CARDLIST_BASE" ]; then
  echo "環境変数 CARDLIST_BASE に取得先のベースURLを設定してください。" >&2
  exit 1
fi
if [ -z "$1" ]; then
  echo "使い方: $0 <英字タイトル>" >&2
  exit 1
fi
node fetch_cards.js --titlematch "$1" --out "cards_$1.csv" --images images
