/**
 * Tenant slug policy — 單一真相。
 *
 * 以前 register / check-slug / middleware 各揸一份 reserved list，三份內容
 * 都唔同：check-slug 話 "wowlix" 可用（wizard 綠燈、最後 register 先 400）、
 * register 又唔 reserve "pricing"/"product" 等 route 字（註冊到但 path routing
 * 永遠 resolve 唔到 = 開出嚟就係死店），而 tenant-settings PUT rename 更加
 * 乜都唔驗。全部收口嚟呢度。
 */

// 3-30 個字，細楷英數 + 連字號，頭尾唔准連字號
export const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

/**
 * Route namespace — middleware 用嚟判斷「首個 path segment 唔係租戶 slug」。
 * ⚠️ 呢度唔可以擺真租戶 slug（例如 maysshop）：擺咗佢個 path biolink
 * （/{slug}）就永遠 resolve 唔到。
 */
export const ROUTE_RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "admin",
  "api",
  "auth",
  "login",
  "signup",
  "settings",
  "checkout",
  "cart",
  "about",
  "contact",
  "terms",
  "privacy",
  "start",
  "_next",
  "favicon.ico",
  "categories",
  "collections",
  "faq",
  "orders",
  "product",
  "products",
  "profile",
  "returns",
  "search",
  "shipping",
  "track",
  "pricing",
  "landing",
]);

/**
 * 平台自留名 — 唔係 route，但俾租戶攞咗會自我指向（wowlix.wowlix.com /
 * www）、撞 sample 店（maysshop）或者留返做 demo / app 用途。
 */
export const PLATFORM_RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "wowlix",
  "www",
  "demo",
  "app",
  "maysshop",
]);

/** 註冊 / 改名唔准用嘅完整名單（route + 平台自留）。 */
export const REGISTRATION_RESERVED_SLUGS: ReadonlySet<string> = new Set([
  ...ROUTE_RESERVED_SLUGS,
  ...PLATFORM_RESERVED_SLUGS,
]);

export const SLUG_FORMAT_MESSAGE =
  "Slug 格式唔啱：3-30 個字，只可以用細楷英文、數字同連字號，頭尾唔可以係連字號";
export const SLUG_RESERVED_MESSAGE = "呢個名係保留字，唔可以用";
