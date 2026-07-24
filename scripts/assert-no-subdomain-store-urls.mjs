/**
 * Build guard：唔准再喺 code 砌 `{slug}.wowlix.com` subdomain URL。
 *
 * 點解要條 guard —— 呢個 class 前後炸咗四次：
 *   #355 sitemap emit 971 條死鏈 · #356 商品卡 href · #363 canonical
 *   · 追單 WhatsApp 送咗條死 link 俾真客人（cart-recovery）
 * 每次都係「另一個地方又自己砌多一次」。`*.wowlix.com` wildcard DNS
 * 根本唔存在（dig NXDOMAIN），砌得出嚟就一定係死鏈。
 *
 * 租戶面一律行 path biolink（`lib/site-url.ts` 個 biolinkUrl / storeShareUrl）。
 * 第日真係補咗 wildcard DNS 想復活 subdomain，改 lib/site-url.ts 一個位就得，
 * 唔使全 repo 撈 —— 順手可以刪咗呢條 guard。
 *
 * 註釋行唔算（doc 要講得出個 pattern 先解釋到點解唔准用）。
 */
import fs from "node:fs";
import path from "node:path";

const ROOTS = ["app", "lib", "components"];
const EXTS = new Set([".ts", ".tsx"]);

// `${...}.wowlix.com` / `" + slug + ".wowlix.com` —— 即係 host 位有變數。
// 寫死嘅 `www.wowlix.com` / `wowlix.com` 唔中（嗰啲係平台自己條 host）。
const SUBDOMAIN_URL = /\$\{[^}]*\}\.wowlix\.com/;

/** 純註釋行（`//`、`*`、`/*`）唔算 —— doc 要引用得到個 pattern。 */
function isCommentLine(line) {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      yield* walk(full);
    } else if (EXTS.has(path.extname(entry.name))) {
      yield full;
    }
  }
}

const hits = [];

for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue;
  for (const file of walk(root)) {
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (isCommentLine(line)) return;
      if (SUBDOMAIN_URL.test(line)) {
        hits.push(`${file}:${i + 1}  ${line.trim()}`);
      }
    });
  }
}

if (hits.length > 0) {
  console.error(
    "ERROR: 砌緊 {slug}.wowlix.com subdomain URL —— wildcard DNS 唔存在，" +
      "呢啲全部係死鏈。改用 lib/site-url.ts 個 biolinkUrl() / storeShareUrl()：",
  );
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}

console.log("OK: 冇 {slug}.wowlix.com subdomain URL");
