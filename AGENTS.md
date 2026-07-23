# AGENTS.md — hk-marketplace agent rules

Fast iteration without sacrificing quality. Follow strictly.

---

## Operating model

```
Yau ←→ Codex.ai (規劃/spec/架構)
              ↓ Task Package or Quick Fix
         Codex (執行/commit)
              ↓
         Yau (驗收)
```

- **Codex.ai**: 出 spec、設計 schema、寫 Task Package、架構決策
- **Codex**: 寫 code、跑 build/test、commit
- **Yau**: 最終驗收，決定 merge / deploy

---

## Hard rules

1. **Scope control** — Only touch files directly required for the task. Expand scope? Stop and ask.
2. **One task = one commit** — Small and reversible. No drive-by refactors.
3. **No secrets** — Never add API keys, tokens, `.env.local`, or any credentials to code or commits.
4. **Plan → Implement → Verify** — Plan first, verify after. If verification fails, fix or revert before committing.
5. **Backward compatibility** — Keep fallbacks for legacy fields. Don't break existing data.

---

## Task formats

### Quick Fix（一句搞掂）
For: typos, style tweaks, copy changes, single-file fixes.

```
QUICK FIX: [一句描述]
File: [路徑]
Verify: npm run ci:build
```

### Task Package（正式改動）
For: new features, multi-file changes, DB migrations, API changes.

```
TASK PACKAGE

Objective:

Risk: Low / Medium / High

Files/areas touched:
-

Constraints:
- No breaking changes
- Keep smoke green
- Follow existing patterns

Non-goals:
-

Acceptance criteria:
-

Steps:
1)
2)
3)

Verify:
- npm run ci:build
- npm run smoke:local (if orders/API affected)

Rollback:
- git revert <commit>
```

---

## Priority (P0 / P1 / P2)

- **P0 (must)**: security, data integrity, auth, migration safety, CI green, smoke pass
- **P1 (should)**: observability, DX, error messages, docs updates
- **P2 (nice)**: UI polish, refactors, perf tuning

---

## Scope rules

- One feature/domain per task. No bundling unrelated changes.
- File count 冇硬限制 — 按 task 實際需要，但保持最小化。
- New requirement mid-task = new task.
- Blocked after one question? Proceed with safest default, document assumptions.

---

## DB migration safety

Migrations 係最危險嘅操作。必須遵守：

1. **先 schema 後 data** — Schema change 同 data migration 分開 commit
2. **Additive first** — 加 column/table 先，之後先改 code 用新 field，最後先刪舊嘢
3. **Nullable by default** — 新 column 加 `?` 或 default value，避免 NOT NULL 炸現有 data
4. **Test on branch DB** — 大改動先喺 Neon branch 試，唔好直接改 production
5. **Backup before destructive ops** — DROP / DELETE / rename 之前一定要有 backup 或 reversible plan
6. **Migration 命名清晰** — e.g. `add_tenant_id_to_products`, 唔好用 auto-generated 名

---

## Verification

Default:
```bash
npm run ci:build
```

Orders/API changes:
```bash
npm run smoke:local
```

DB changes:
```bash
npx prisma migrate dev --name <descriptive_name>
npx prisma generate
npm run ci:build
```

---

## Delivery output (5 lines)

1. Done / Not done + why
2. Files changed (list)
3. Commands run + results
4. Risks / notes (max 3 bullets)
5. Next step (one command)

---

## Code style

- Minimal, readable code
- Explicit types where helpful
- Avoid adding dependencies unless necessary
- 廣東話 comments OK for business logic, English for technical

---

## Landing Page 設計指引

所有 landing page 改動必須參考 `docs/LANDING-DESIGN-SYSTEM.md`。

<frontend_aesthetics>
You tend to converge toward generic outputs. Avoid "AI slop" aesthetic. Focus on:

Typography: Choose beautiful, unique fonts. NEVER use Inter, Roboto, Arial, system fonts.
Color & Theme: Commit to cohesive aesthetic. Use CSS variables. Dominant colors with sharp accents.
Motion: CSS animations for page load stagger reveals. High-impact moments over scattered micro-interactions.
Backgrounds: Create atmosphere and depth. Layer gradients, geometric patterns, contextual effects.

Avoid: purple gradients on white, predictable layouts, cookie-cutter components.
Make unexpected choices that feel genuinely designed for the context.
</frontend_aesthetics>

---

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`gh` CLI, repo hideyau28/wowlix). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical labels (`needs-triage` / `needs-info` / `ready-for-agent` / `ready-for-human` / `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
