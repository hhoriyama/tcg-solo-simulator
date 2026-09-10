#!/usr/bin/env node
/**
 * カードリスト取得スクリプト
 *
 * カードゲームの公式カードリストのようなページ構造から、カードデータ(CSV)と
 * 画像をまとめて取得するツール。取得先は固定せず、--base か環境変数で指定する。
 *
 * Node.js 18 以上（追加パッケージ不要）
 *
 *   node fetch_cards.js --base <URL> --list                 商品(収録商品)の一覧を表示
 *   node fetch_cards.js --base <URL> --list --title <作品名>  タイトルで絞って一覧表示
 *   node fetch_cards.js --base <URL> --series <商品ID>       その商品のカードを取得
 *   node fetch_cards.js --base <URL> --title <作品名>        タイトル全部を取得
 *   node fetch_cards.js --base <URL> --series <商品ID> --no-images  画像を落とさない
 *   node fetch_cards.js --base <URL> --series <商品ID> --parallel   パラレル(_p1など)も含める
 *
 * オプション
 *   --base <URL>      取得先のベースURL（環境変数 CARDLIST_BASE でも指定可・必須）
 *   --out <file>      出力CSV（既定: cards.csv）
 *   --images <dir>    画像の保存先（既定: images）
 *   --titlematch <英字>  タイトルを英字の部分一致で指定
 *   --list-titles        タイトル一覧を表示
 *   --dump-titles [file] タイトル一覧を JSON で書き出す（既定: titles.json）
 *   --wait <ms>       リクエスト間隔（既定: 250）
 *   --append          既存CSVに追記（ヘッダーを二重に書かない）
 *
 * 出力CSVの列は index.html の取り込み形式に合わせてあります。
 *
 * ※ 取得したカードデータ・画像の著作権は各権利者に帰属します。個人利用の範囲で、
 *    対象サイトの利用規約を確認のうえ、サーバーに負荷をかけないようご利用ください。
 */

const fs = require('fs');
const path = require('path');

const BASE = (() => {
  const i = process.argv.indexOf('--base');
  return (i >= 0 && process.argv[i + 1]) ? process.argv[i + 1] : (process.env.CARDLIST_BASE || '');
})();
if (!BASE) {
  console.error('取得先のベースURLが未指定です。--base <URL> か 環境変数 CARDLIST_BASE で指定してください。');
  process.exit(1);
}
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/* ---------------- args ---------------- */
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : d; };
const flag = n => argv.includes('--' + n);

const OUT      = opt('out', 'cards.csv');
const IMGDIR   = opt('images', 'images');
const WAIT     = +opt('wait', 250);
const NOIMG    = flag('no-images');
const PARALLEL = flag('parallel');
const APPEND   = flag('append');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url, bin) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ja' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return bin ? Buffer.from(await r.arrayBuffer()) : await r.text();
    } catch (e) {
      if (i === 2) throw e;
      await sleep(800 * (i + 1));
    }
  }
}

/* ---------------- HTML helpers ---------------- */
const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#039;': "'", '&nbsp;': ' ', '&apos;': "'" };
const unent = s => String(s).replace(/&(amp|lt|gt|quot|#039|nbsp|apos);/g, m => ENT[m]);
// <img alt="X"> を 【X】 に変えてからタグを落とす（登場時 / トリガー種別などを残すため）
const strip = s => unent(String(s)
  .replace(/<img[^>]*alt="([^"]*)"[^>]*>/g, (_, a) => a ? '【' + a + '】' : '')
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]*>/g, ''))
  .replace(/\s+/g, ' ').trim();

function dlBlock(html, cls) {
  const re = new RegExp('<dl class="cardDataCol ' + cls + '[^"]*">([\\s\\S]*?)<\\/dl>');
  const m = html.match(re);
  return m ? m[1] : '';
}
function ddText(block) {
  const m = block.match(/<dd class="cardDataContents">([\s\S]*?)<\/dd>/);
  return m ? strip(m[1]) : '';
}
function ddImgAlts(block) {
  const m = block.match(/<dd class="cardDataContents">([\s\S]*?)<\/dd>/);
  if (!m) return [];
  return [...m[1].matchAll(/<img[^>]*alt="([^"]*)"/g)].map(x => unent(x[1]));
}
function ddTextNoIcon(block) {
  const m = block.match(/<dd class="cardDataContents">([\s\S]*?)<\/dd>/);
  if (!m) return '';
  return unent(m[1].replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

/* ---------------- 商品一覧 ---------------- */
async function seriesList() {
  const h = await get(BASE + '/jp/cardlist/');
  const sel = h.match(/<select[^>]*name="series"[\s\S]*?<\/select>/);
  if (!sel) return [];
  return [...sel[0].matchAll(/<option value="(\d+)"[^>]*>([\s\S]*?)<\/option>/g)]
    .map(m => ({ id: m[1], name: strip(m[2]) }));
}

/* ---------------- タイトル一覧 ---------------- */
async function titleList() {
  const h = await get(BASE + '/jp/cardlist/');
  const sel = h.match(/<select[^>]*name="selectTitle"[\s\S]*?<\/select>/);
  if (!sel) return [];
  return [...sel[0].matchAll(/<option value="([^"]*)"/g)]
    .map(m => unent(m[1]).trim())
    .filter(v => v && v !== 'ALL');
}

/* ---------------- カードNo一覧 ---------------- */
async function cardNumbers(params) {
  const q = new URLSearchParams({ search: 'true', ...params });
  const h = await get(BASE + '/jp/cardlist/index.php?' + q.toString());
  const nos = [...new Set([...h.matchAll(/detail_iframe\.php\?card_no=([^"'&]+)/g)].map(m => decodeURIComponent(m[1])))];
  return PARALLEL ? nos : nos.filter(n => !/_p\d+$/i.test(n));
}

/* ---------------- 1枚ぶん ---------------- */
const CATMAP = { 'キャラクター': 'キャラ', 'フィールド': 'フィールド', 'イベント': 'イベント', 'アクションポイント': 'AP' };
const COLORS = ['赤', '青', '緑', '黄', '紫'];

async function cardDetail(no) {
  const h = await get(BASE + '/jp/cardlist/detail_iframe.php?card_no=' + encodeURIComponent(no));

  const nameRaw = (h.match(/<h2 class="cardNameCol">([\s\S]*?)<\/h2>/) || [])[1] || '';
  const name = strip(nameRaw.replace(/<span class="rubyData">[\s\S]*?<\/span>/g, ''));
  const rarity = strip((h.match(/<span class="rareData">([\s\S]*?)<\/span>/) || [])[1] || '');
  const image = ((h.match(/<dd class="cardDataImgCol"><img src="([^"?]+)/) || [])[1] || '');
  const title = unent(((h.match(/<dd class="cardDataTitleCol[^"]*">\s*<img[^>]*alt="([^"]*)"/) || [])[1] || '')).trim();

  const cat = ddText(dlBlock(h, 'categoryData'));
  const type = CATMAP[cat] || 'キャラ';

  // 必要エナジー : img alt は「紫3」「紫-」など（指定色 + 個数）
  const needAlt = ddImgAlts(dlBlock(h, 'needEnergyData'))[0] || '';
  let color = '', energyColor = 0;
  const nm = needAlt.match(/^(.)(\d+|-)/);
  if (nm) { color = COLORS.includes(nm[1]) ? nm[1] : ''; energyColor = nm[2] === '-' ? 0 : +nm[2]; }

  // 発生エナジー : img alt の色文字の個数（「紫」=1 /「紫+」=1(条件付き+1) /「紫紫」=2）
  const genBlock = dlBlock(h, 'generatedEnergyData');
  const genAlt = ddImgAlts(genBlock)[0] || '';
  let gen = 0;
  if (genAlt) {
    const c = color || COLORS.find(x => genAlt.includes(x)) || '';
    gen = c ? (genAlt.split(c).length - 1) : 0;
    if (!color && c) color = c;
  }
  if (type === 'イベント' || type === 'AP') gen = 0;

  const ap = +ddText(dlBlock(h, 'apData')).replace(/[^\d]/g, '') || 0;
  const bpRaw = ddText(dlBlock(h, 'bpData'));            // "3000" / "3000+" / "-"
  const bp = parseInt((bpRaw.match(/\d+/) || [0])[0], 10) || 0;
  const traits = ddText(dlBlock(h, 'attributeData')).replace(/^-$/, '');

  const effBlock = dlBlock(h, 'effectData');
  const text = ddText(effBlock).replace(/^-$/, '');

  const trgBlock = dlBlock(h, 'triggerData');
  const trigger = (ddImgAlts(trgBlock)[0] || '').trim();
  const triggerText = ddTextNoIcon(trgBlock).replace(/^-$/, '');

  return { no, name, title, color, type, energyColor, energyAny: 0, ap, bp, gen, traits, trigger, text, rarity, triggerText, _img: image };
}

/* ---------------- CSV ---------------- */
const HEAD = ['no', 'name', 'title', 'color', 'type', 'energyColor', 'energyAny', 'ap', 'bp', 'gen', 'traits', 'trigger', 'text', 'image', 'rarity', 'triggerText'];
const q = v => { v = v == null ? '' : String(v); return /[",\n\t]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
const row = c => HEAD.map(k => q(c[k])).join(',');

/* ---------------- main ---------------- */
async function main() {
  const list = await seriesList();

  if (flag('dump-titles')) {
    const f = opt('dump-titles', true);
    const file = (f === true ? 'titles.json' : f);
    const ts = await titleList();
    fs.writeFileSync(file, JSON.stringify({ source: BASE + '/jp/cardlist/', fetched: new Date().toISOString().slice(0, 10), titles: ts }, null, 2), 'utf8');
    console.log(`✔ ${file} にタイトル ${ts.length}件 を書き出しました`);
    return;
  }

  if (flag('list-titles')) {
    const ts = await titleList();
    const m = opt('titlematch', null);
    ts.filter(t => !m || m === true || t.toLowerCase().includes(String(m).toLowerCase()))
      .forEach(t => console.log(t));
    return;
  }

  if (flag('list')) {
    const t = opt('title', null);
    list.filter(s => s.id && (!t || t === true || s.name.includes(t)))
        .forEach(s => console.log(s.id.padEnd(8), s.name));
    console.log(`\n(${list.length} 件)  例: node fetch_cards.js --series ${(list[1] || list[0] || {}).id || '570101'}`);
    return;
  }

  const series = opt('series', null);
  let title = opt('title', null);
  const tmatch = opt('titlematch', null);

  // --titlematch : ASCII の部分一致でタイトルを特定（Windows の文字コード問題を回避）
  if (tmatch && tmatch !== true) {
    const ts = await titleList();
    const hits = ts.filter(t => t.toLowerCase().includes(String(tmatch).toLowerCase()));
    if (!hits.length) { console.log(`「${tmatch}」に一致するタイトルがありません。--list-titles で確認してください。`); return; }
    if (hits.length > 1) {
      console.log('複数のタイトルに一致しました。--title で1つ指定してください:');
      hits.forEach(t => console.log('  ' + t));
      return;
    }
    title = hits[0];
    console.log(`▼ タイトル: ${title}`);
  }

  if (!series && !title) {
    console.log('使い方: node fetch_cards.js --list  /  --series <ID>  /  --title <タイトル名>');
    console.log('詳しくはファイル先頭のコメントを見てください。');
    return;
  }

  const params = {};
  if (series && series !== true) params.series = series;
  if (title && title !== true) params.selectTitle = title;

  const label = series && series !== true
    ? (list.find(s => s.id === String(series)) || {}).name || series
    : title;
  console.log(`▼ 取得対象: ${label}`);

  const nos = await cardNumbers(params);
  if (!nos.length) { console.log('カードが見つかりませんでした。--list で商品IDを確認してください。'); return; }
  console.log(`  カード ${nos.length} 枚`);

  if (!NOIMG) fs.mkdirSync(IMGDIR, { recursive: true });

  const rows = [];
  let imgOk = 0, imgSkip = 0, imgNg = 0;

  for (let i = 0; i < nos.length; i++) {
    const no = nos[i];
    let c;
    try { c = await cardDetail(no); }
    catch (e) { console.log(`  ! ${no} 取得失敗: ${e.message}`); continue; }

    const fname = no.replace(/[\/\\:*?"<>|]/g, '_') + '.png';
    if (!NOIMG) {
      const dest = path.join(IMGDIR, fname);
      if (fs.existsSync(dest)) { imgSkip++; }
      else if (c._img) {
        try { fs.writeFileSync(dest, await get(BASE + c._img, true)); imgOk++; await sleep(WAIT); }
        catch (e) { imgNg++; }
      }
      c.image = IMGDIR.replace(/\\/g, '/').replace(/\/$/, '') + '/' + fname;
    } else {
      c.image = '';
    }

    rows.push(row(c));
    process.stdout.write(`\r  ${i + 1}/${nos.length}  ${no}          `);
    await sleep(WAIT);
  }
  process.stdout.write('\n');

  const exists = APPEND && fs.existsSync(OUT);
  const body = (exists ? '' : HEAD.join(',') + '\n') + rows.join('\n') + '\n';
  fs.writeFileSync(OUT, body, { encoding: 'utf8', flag: exists ? 'a' : 'w' });

  console.log(`✔ ${OUT} に ${rows.length} 枚を書き出しました`);
  try {
    const ts = await titleList();
    fs.writeFileSync('titles.json', JSON.stringify({ source: BASE + '/jp/cardlist/', fetched: new Date().toISOString().slice(0, 10), titles: ts }, null, 2), 'utf8');
    console.log(`✔ titles.json にタイトル ${ts.length}件 を書き出しました`);
  } catch (e) { console.log('（titles.json の書き出しに失敗:', e.message, '）'); }
  if (!NOIMG) console.log(`✔ 画像: 新規 ${imgOk} / 既存スキップ ${imgSkip}${imgNg ? ` / 失敗 ${imgNg}` : ''}  → ${IMGDIR}/`);
  console.log(`\n次の手順:\n  1) index.html を開く\n  2) ①カード管理 で ${OUT} の中身を貼り付けて「取り込む」\n  3) ②デッキ構築 でデッキを作る`);
}

module.exports = { cardDetail, seriesList, cardNumbers, strip, dlBlock, ddText, ddImgAlts, ddTextNoIcon, HEAD, row };
if (require.main === module) main().catch(e => { console.error('エラー:', e.message); process.exit(1); });
