import fs from "node:fs";
import path from "node:path";

export const E2E_PORT = 3100;

/** 平台面（landing / pricing / start / platform legal / platform 404） */
export const PLATFORM = `http://wowlix.localhost:${E2E_PORT}`;

/** Host 無關嘅面（admin 跟 JWT 行）同 path-slug 租戶面 */
export const APP = `http://localhost:${E2E_PORT}`;

const ARTIFACTS_DIR = path.join(__dirname, ".artifacts");
const TENANT_FILE = path.join(ARTIFACTS_DIR, "shared-tenant.json");

export type SharedTenant = {
  name: string;
  slug: string;
  email: string;
  password: string;
  tenantId: string;
};

export function uid(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function saveSharedTenant(tenant: SharedTenant): void {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  fs.writeFileSync(TENANT_FILE, JSON.stringify(tenant, null, 2));
}

export function loadSharedTenant(): SharedTenant {
  if (!fs.existsSync(TENANT_FILE)) {
    throw new Error(
      "shared-tenant.json 未生成 — setup project 未行過或者 register 失敗",
    );
  }
  return JSON.parse(fs.readFileSync(TENANT_FILE, "utf8")) as SharedTenant;
}
