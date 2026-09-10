#!/bin/sh
# macOS / Linux 用（Node.js 18 以上が必要）
cd "$(dirname "$0")"
node fetch_cards.js --dump-titles titles.json
