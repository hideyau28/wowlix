// 結構性守衛 —— 純檔案掃描，唔使 server / DB / 網絡。
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * 唯一可以直接 call Cloudinary provider 嘅檔案 = lib/upload/cloudinary.ts（seam）。
 *
 * 點解要結構性 test 而唔係淨靠一次 grep 報告：grep 係一次性快照，日後有人新增
 * 一條 route 直接 `import { v2 } from "cloudinary"` + `cloudinary.uploader.upload`
 * （正正係今次 /api/admin/upload 漏網嘅原因），冇 CI gate 就會靜靜雞繞過所有
 * 授權 / 驗檔 / rate-limit / tenant-scoping 防線。呢條 test 令「新增 direct
 * uploader」即刻紅 CI。
 *
 * 收窄喺一個 module 之後，任何 4xx / 授權失敗都結構性證明 uploader 冇被 call。
 */

// 唯一獲准 import cloudinary SDK + call uploader 嘅檔案（相對 repo root）。
const ALLOWED = new Set<string>(["lib/upload/cloudinary.ts"]);

// 掃呢啲 source 目錄嘅 .ts / .tsx（唔掃 e2e / node_modules / .next / 生成物）。
const SCAN_DIRS = ["app", "lib", "components"];
const IGNORE_DIRS = new Set(["node_modules", ".next", ".git", "e2e"]);

function walk(dir: string, acc: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (IGNORE_DIRS.has(ent.name)) continue;
      walk(full, acc);
    } else if (/\.tsx?$/.test(ent.name)) {
      acc.push(full);
    }
  }
}

// import 個 cloudinary package（唔理係 `from "cloudinary"` 定 require）。
const IMPORT_CLOUDINARY = /(from\s+["']cloudinary["']|require\(\s*["']cloudinary["']\s*\))/;
// 直接 call provider uploader（uploader.upload / upload_stream）。
const CALL_UPLOADER = /\.uploader\s*\.\s*(upload|upload_stream)\b/;

test.describe("結構守衛：只有共用 adapter 可直接 call Cloudinary", () => {
  test("[critical] 冇任何 app/lib/components 檔案直接 import / call Cloudinary（除 adapter）", () => {
    const repoRoot = path.resolve(__dirname, "..");
    const files: string[] = [];
    for (const d of SCAN_DIRS) walk(path.join(repoRoot, d), files);

    // sanity：至少要掃到 adapter 本身，否則掃描 path 錯咗（避免假綠）。
    const rels = files.map((f) => path.relative(repoRoot, f).split(path.sep).join("/"));
    expect(rels, "掃描應包含 adapter 本身，否則 path 配置錯").toContain(
      "lib/upload/cloudinary.ts",
    );

    const offenders: string[] = [];
    for (const rel of rels) {
      if (ALLOWED.has(rel)) continue;
      const src = fs.readFileSync(path.join(repoRoot, rel), "utf8");
      if (IMPORT_CLOUDINARY.test(src) || CALL_UPLOADER.test(src)) {
        offenders.push(rel);
      }
    }

    expect(
      offenders,
      `以下檔案直接掂 Cloudinary provider，必須改行 lib/upload/cloudinary.ts adapter：\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
