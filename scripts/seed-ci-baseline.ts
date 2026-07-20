import "dotenv/config";
import { prisma } from "../lib/prisma";

/**
 * CI / provision 嘅最小 smoke baseline seed。
 *
 * 點解需要：呢個 repo 嘅 base 表係 schema-first（`prisma db push`）建，唔係由
 * migration 由零建 —— migration files 只係 layer 喺上面嘅 data-migration。所以 CI /
 * 新環境喺 `db push` 之後係一個「空 DB」（冇任何 tenant / product）。跟住
 * `npm run smoke:prod` 會打 store-settings / orders / products，全部經
 * resolveTenant("maysshop")（見 lib/tenant.ts 嘅 DEFAULT_SLUG）—— 空 DB 冇呢間
 * tenant 就 throw → 500 → smoke fail。orders 落單仲會查 active product + 扣 stock。
 *
 * 所以呢個 script 種返 smoke 需要嘅最小 baseline：
 *   1) default tenant（slug=maysshop，status=active）
 *   2) 一件 active product（綁 tenantId + 有 stock，畀 orders smoke 落單扣數）
 *
 * 點解唔行 register API 種 tenant：register 當 "maysshop" 係 reserved slug（會 400）。
 * 點解唔靠 scripts/seed-products.ts：嗰個 script create product 冇俾 tenantId，喺
 *   multi-tenant schema 會炸 —— 修佢唔喺呢個 task scope，所以呢度自己種一件。
 *
 * Idempotent：tenant 用 upsert；product 只喺當前 tenant 冇 active product 先建。
 * 本地真 maysshop / 已有 product 都唔會被覆蓋或加多。
 */
const DEFAULT_SLUG = "maysshop";

async function main(): Promise<void> {
  const tenant = await prisma.tenant.upsert({
    where: { slug: DEFAULT_SLUG },
    update: {},
    create: {
      slug: DEFAULT_SLUG,
      name: "May's Shop",
      status: "active",
    },
    select: { id: true, slug: true, status: true },
  });
  console.log(
    `[seed] tenant ready: id=${tenant.id} slug=${tenant.slug} status=${tenant.status}`,
  );

  const existing = await prisma.product.findFirst({
    where: { tenantId: tenant.id, active: true, hidden: false, deletedAt: null },
    select: { id: true },
  });

  if (existing) {
    console.log(`[seed] active product already exists (id=${existing.id}) — skip`);
    return;
  }

  const product = await prisma.product.create({
    data: {
      title: "CI Smoke Product",
      price: 199,
      active: true,
      stock: 1000, // orders smoke 落單 qty 2，stock guard 要夠扣
      tenantId: tenant.id,
    },
    select: { id: true },
  });
  console.log(
    `[seed] created baseline product id=${product.id} (stock=1000) for tenant ${tenant.slug}`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[seed] seed-ci-baseline failed:", err);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
