// 中央輸出編碼（output encoding）—— 兩個 context 兩個 helper，唔可以撈亂。
//
// ⚠️ HTML text context ≠ JSON-in-<script> context：
//  - HTML：用 HTML entity（&amp; &lt; …）中和 tag/attribute 突破。
//  - JSON-LD：payload 已經係合法 JSON，唔可以插 HTML entity（會炸 JSON.parse）；
//    只需要中和「令 HTML parser 提早收 <script> / 開新 tag」嗰幾個字元，
//    用 JSON 自己嘅 \uXXXX escape —— JSON.parse round-trip 後照樣攞返原文。
//
// 兩者都唔改動合法顯示/結構資料，只係編碼。

// HTML text/attribute context：中和 & < > " ' 五個字元。
// & 一定要行先，否則會將後續 entity 嘅 & 二次編碼。
// 只掂 ASCII 特殊字元 → Unicode/廣東話/一般標點原封不動，亦唔會雙重編碼。
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// application/ld+json <script> context 專用 serializer。
//
// 每一個出 application/ld+json 嘅 TSX 都要經呢個 function，唔准 bare JSON.stringify。
// 先 JSON.stringify，再將「HTML parser breakout」字元換成 JSON 嘅 \uXXXX escape：
//  - < > &  ：唔俾攻擊者喺字串內砌 </script> 或者開新 tag。
//  - U+2028 / U+2029：JS 舊 parser 會當行結束符，避免 script context 走位。
// 全部係合法 JSON escape → JSON.parse(serializeJsonLd(x)) 深等於 x，攻擊者塞入
// 嘅字串原文照樣以「資料」形式保留，只係無法逃出 <script> 執行。
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data ?? null)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
