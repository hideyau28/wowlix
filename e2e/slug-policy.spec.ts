import { test, expect } from "@playwright/test";
import { APP, uid } from "./helpers";

/**
 * Slug policy 單一真相（lib/slug-policy.ts）—— 三個入口行同一套規矩：
 * check-slug / register / tenant-settings PUT rename。
 *
 * 純 API spec，冇 page —— 唔食 fixtures 個 consoleGuard（佢綁住 page fixture）。
 * request fixture 會自動保住 register auto-login 個 tenant-admin-token cookie，
 * 之後嘅 PUT 就係以「啱啱開店嗰個租戶 admin」身份行。
 */

test("check-slug 同 register 一致：平台字 / route 字一律唔可用", async ({
  request,
}) => {
  // 以前 check-slug 揸住份 stale list：話 "wowlix"/"landing" 可用，
  // wizard 綠燈、行到最後 register 先 400
  for (const slug of [
    "wowlix",
    "www",
    "demo",
    "maysshop",
    "pricing",
    "product",
    "landing",
  ]) {
    const res = await request.get(
      `${APP}/api/tenant/check-slug?slug=${slug}`,
    );
    expect(res.ok(), `check-slug ${slug} 應該 200`).toBeTruthy();
    const json = await res.json();
    expect(json.data?.available, `"${slug}" 應該唔可用`).toBe(false);
  }
});

test("register 唔准開 route-字死店", async ({ request }) => {
  // "pricing" 係 route segment —— 以前 register 唔擋，開到但 path routing
  // 永遠 resolve 唔到，出世就係死店
  const res = await request.post(`${APP}/api/tenant/register`, {
    data: {
      name: "E2E Dead Store",
      slug: "pricing",
      email: `e2e-dead-${uid()}@example.com`,
      password: "E2e-passw0rd-1234",
    },
  });
  expect(res.status()).toBe(400);
});

test("tenant-settings PUT rename 行足 register 同一套規矩", async ({
  request,
}) => {
  const id = uid();
  const slug = `e2e-slugpol-${id}`;

  const reg = await request.post(`${APP}/api/tenant/register`, {
    data: {
      name: `E2E SlugPol ${id}`,
      slug,
      email: `${slug}@example.com`,
      password: "E2e-passw0rd-1234",
      paymentMethods: ["fps"],
      fpsId: "91234567",
    },
  });
  expect(reg.status(), "register 應該 200").toBe(200);
  const regJson = await reg.json();
  expect(regJson.data?.autoLogin, "之後嘅 PUT 靠 auto-login cookie").toBe(true);

  const put = (data: Record<string, unknown>) =>
    request.put(`${APP}/api/admin/tenant-settings`, { data });

  // 保留字：route 字 + 平台字（以前呢度乜都唔驗，改做 "landing" 會遮死自己間店）
  expect((await put({ slug: "landing" })).status()).toBe(400);
  expect((await put({ slug: "wowlix" })).status()).toBe(400);
  // 大楷要先 normalize 做細楷再查 —— "WOWLIX" 一樣係保留字
  expect((await put({ slug: "WOWLIX" })).status()).toBe(400);

  // 格式
  expect((await put({ slug: "bad slug!" })).status()).toBe(400);
  expect((await put({ slug: "ab" })).status()).toBe(400);

  // 已有人用（setup project seed 咗 e2e-default）
  expect((await put({ slug: "e2e-default" })).status()).toBe(409);

  // slug 冇改到 → 唔使過新規，其他 field 照儲（settings form 成個 object
  // PUT 返嚟係常態，唔可以逼歷史 slug 改名先俾儲存）
  const noop = await put({ slug, tagline: "slug 冇郁" });
  expect(noop.status()).toBe(200);
  expect((await noop.json()).data?.slug).toBe(slug);

  // 合法 rename → 200，而且 normalize 細楷
  const renamed = await put({ slug: `${slug.toUpperCase()}-V2` });
  expect(renamed.status()).toBe(200);
  expect((await renamed.json()).data?.slug).toBe(`${slug}-v2`);
});
