import { test as setup, expect } from "@playwright/test";
import { APP, saveSharedTenant, uid } from "../helpers";

/**
 * 開一間共用測試店俾 login / forgot / legal / 404 spec 用。
 * 直接打 register API（唔行 wizard —— wizard 由 open-store.spec 覆蓋）。
 * slug 一律 e2e-* 前綴：local dev DB 積落嚟嘅測試店憑前綴清（HANDOFF 待清名單）。
 */
setup("register shared e2e tenant", async ({ request }) => {
  const id = uid();
  const tenant = {
    name: `E2E Shared ${id}`,
    slug: `e2e-shared-${id}`,
    email: `e2e-shared-${id}@example.com`,
    password: "E2e-passw0rd-1234",
    tenantId: "",
  };

  const res = await request.post(`${APP}/api/tenant/register`, {
    data: {
      name: tenant.name,
      slug: tenant.slug,
      email: tenant.email,
      password: tenant.password,
      whatsapp: "+85291234567",
      paymentMethods: ["fps"],
      fpsId: "91234567",
      templateId: "matcha",
    },
  });

  expect(res.ok(), `register API 應該 200，實際 ${res.status()}`).toBeTruthy();
  const json = await res.json();
  expect(json.ok).toBeTruthy();
  expect(json.data?.slug).toBe(tenant.slug);

  tenant.tenantId = json.data.tenantId;
  saveSharedTenant(tenant);
});
