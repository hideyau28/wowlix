export const meta = {
  name: 'wowlix-motion-overdrive',
  description: 'Loop rounds of motion choreography on the WoWlix marketing surfaces (CSS-only) until a 4-judge median hits 10/10 or plateaus',
  whenToUse: 'Heavy motion upgrade for landing + /pricing, judged and iterated',
}

const REPO = '/Users/ngyau/wowlix'

const LAW = [
  'You are working on the WoWlix marketing surfaces. Working dir: ' + REPO,
  '',
  'READ FIRST, IN ORDER (do not skip):',
  '1. ' + REPO + '/docs/LANDING-DESIGN-SYSTEM.md — project design law. §0 hard bans, §2 accent==ink + scoping, §5 motion contract, §6 signature moment, §8 踩過嘅坑.',
  '2. ' + REPO + '/components/marketing/WowlixLandingPage.tsx — the landing (single file, all motion lives in its style-jsx-global block, classes prefixed .wlx-).',
  '3. ' + REPO + '/components/marketing/StudioPricingPage.tsx — /pricing (separate .studio-* motion system).',
  '',
  'MOTION LAW (violations = the work is rejected):',
  '- NO animation libraries. CSS + IntersectionObserver only. Framer/GSAP are banned by §0.',
  '- Animate ONLY transform / opacity / clip-path (clip-path has project precedent in wlxWipe and .wlx-stagger). NEVER blur or filter (was shipped once on /pricing and removed for §5). Never layout props (width/height/top/left/margin).',
  '- Every scroll-driven effect (animation-timeline: view() or scroll()) MUST be inside @supports (animation-timeline: view()) or scroll(), AND gated behind .wlx-js (landing) / .studio-js (pricing). Safari/Firefox must see the finished static state. No-JS must see everything.',
  '- Every new animation/transition class MUST get a reset inside the existing @media (prefers-reduced-motion: reduce) block.',
  '- ⚠️ view()/scroll() timelines FREEZE if any ancestor is overflow: hidden (hidden creates a scroll container that never scrolls; progress locks). The section wrappers were converted to overflow-clip for exactly this reason. NEVER change overflow-clip back to overflow-hidden. If you need clipping on a new ancestor of a scroll-driven element, use overflow-clip.',
  '- ⚠️ view() is useless on elements already inside the first viewport at load (their entry range is over before any scroll). This killed a plan on /pricing (cards at docTop 515px, currentTime null). Do not propose view() entrances for above-the-fold elements or short pages; verify docTop first.',
  '- ⚠️ Collision rule (§8 pitfall 2): an element may have ONE source of animation per property. .wlx-stagger elements already TRANSITION transform (reveal) — never add a transform ANIMATION to them. Elements with wlxFadeUp/wlxLineWipe already animate transform+opacity — to add a scroll effect on the same element you must merge into ONE animation list (like the hero phone: animation: wlxFadeUp ..., wlxRiseSlow ...; animation-timeline: auto, scroll(root)). Tailwind v4 rotate-2/translate-x utilities are independent rotate/translate properties, NOT transform — they stack safely with transform animations (verified).',
  '- ⚠️ The style-jsx-global block is a JS template literal: NO BACKTICK may appear anywhere inside it, including CSS comments (§8 pitfall 4 — build explodes).',
  '- The #stores signature section (§6): sticky phone + IO cross-fade is untouchable. Do not add overflow of any kind to it, do not convert it to scroll-timeline, do not wrap the sticky in new containers. Enhancing ELEMENTS AROUND it (captions, dots) is allowed if the sticky mechanism is untouched.',
  '- Tenant stores must not change by one pixel: touch nothing outside components/marketing/** . Never touch app/globals.css base :root, never touch fonts.ts preload settings.',
  '- Pricing data stays in plans.ts. Copy (wording) changes are FORBIDDEN in this workflow — motion only.',
  '',
  'TASTE LAW (distilled from the loaded motion skill — treat as requirements):',
  '- Differentiated choreography: each section moves in a way that fits WHAT it shows. A uniform fade-and-rise on every section is the number-one AI tell. The current page is guilty of this (every section = .wlx-reveal + .wlx-stagger fade-up). Raising the grade means giving sections their OWN motion identity, not adding more fade.',
  '- Easing: ease-out only — quart cubic-bezier(0.25,1,0.5,1), quint cubic-bezier(0.22,1,0.36,1), expo cubic-bezier(0.16,1,0.3,1). No bounce, no elastic, no ease-in-out for entrances. Exits run ~75% of entrance duration.',
  '- Timing: feedback 100-150ms, state changes 200-300ms, entrances 500-800ms. Total stagger across one group ≤ 500ms.',
  '- will-change only on elements with known heavy animation, never sprayed.',
  '- Scroll-coupling is the premium feel: elements responding CONTINUOUSLY at different rates (parallax depth, wipes, settles) — not one-shot reveals that die after firing. Existing inventory: nav progress line (wlxProgress), hero phone parallax (wlxRiseSlow), 5 watermark drifts (wlxMarkDrift), stat numeral wipe (wlxWipe), bento image rise (wlxBleedRise), mobile shot settle (wlxShotSettle), 18s ambient drift (wlxDrift), magnetic CTA on pointer:fine. Do not duplicate these; build on them.',
  '- Motion must never block reading or interaction. The page is a bilingual (zh-HK/en) commerce landing read on mid-range phones — compositor-only, 60fps.',
].join('\n')

const MOVE_SCHEMA = {
  type: 'object',
  properties: {
    moves: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          file: { type: 'string', description: 'WowlixLandingPage.tsx or StudioPricingPage.tsx' },
          target: { type: 'string', description: 'Exact element: line number + selector/className today' },
          spec: { type: 'string', description: 'Implementation spec precise enough to apply without questions: exact CSS (keyframes, class, timeline, range, easing, duration), exact className edits, where the reduced-motion reset goes.' },
          why: { type: 'string', description: 'What story/feeling this adds; why THIS section earns THIS motion' },
          collisionCheck: { type: 'string', description: 'Name the existing animation/transition on the target element and why this does not collide (or how it merges)' },
          effort: { type: 'string', enum: ['trivial', 'small', 'medium'] },
        },
        required: ['title', 'file', 'target', 'spec', 'why', 'collisionCheck', 'effort'],
      },
    },
  },
  required: ['moves'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    refuted: { type: 'boolean' },
    reason: { type: 'string' },
    correction: { type: 'string', description: 'If fixable, the corrected spec. Empty if clean or unsalvageable.' },
  },
  required: ['refuted', 'reason'],
}

const SCORE_SCHEMA = {
  type: 'object',
  properties: {
    overall: { type: 'number', description: '0-10, one decimal allowed. 10 = flawless execution WITHIN the CSS-only/mono constraints (not absolute vs commissioned-photography sites).' },
    dims: {
      type: 'object',
      properties: {
        choreography: { type: 'number' },
        scrollCoupling: { type: 'number' },
        microInteraction: { type: 'number' },
        performance: { type: 'number' },
        robustness: { type: 'number' },
        restraint: { type: 'number', description: 'heavy yet not exhausting; motion fatigue check' },
      },
      required: ['choreography', 'scrollCoupling', 'microInteraction', 'performance', 'robustness', 'restraint'],
    },
    topGaps: { type: 'array', items: { type: 'string' }, description: 'The 2-4 concrete gaps costing the most points, specific enough to act on' },
  },
  required: ['overall', 'dims', 'topGaps'],
}

const LENSES = [
  {
    key: 'hero-masthead',
    brief: 'LENS: Hero + nav. The masthead entrance (wlxFadeUp + wlxLineWipe per line) is good but ends at load; after that the hero only has phone parallax. Consider: scroll-away choreography (masthead/announce pill translating+fading at DIFFERENT rates as the user scrolls off the hero — merge into existing animation lists per the collision rule), phone screen content parallaxing subtly INSIDE the bezel (the inner Image, not the sticky mechanism), nav elevating (shadow/border via opacity on a pseudo-layer or bg change via existing transition) once scrolled. Propose 2-4 moves.',
  },
  {
    key: 'stats-signature',
    brief: 'LENS: Stats(01) + the #stores signature. Stats: the numeral wipe now works; consider scroll-driven count-up via @property (register an integer custom property in the style block with @property, animate it with view() timeline, render via counter-reset + ::after content: counter() — verify syntax carefully; this is Chromium-only and must sit inside the existing @supports gate; static fallback = full number, which is what the markup already shows). The border-l hairlines on each stat could draw in (scaleY via view()). #stores: DO NOT touch the sticky/IO mechanism; allowed: caption blocks getting per-caption motion identity as they pass (their text is plain, no stagger conflict — verify), the three dots row is aria-hidden and desktop-only. Propose 2-4 moves.',
  },
  {
    key: 'bento-island',
    brief: 'LENS: Features bento (02) + dark testimonial island (04). Bento: the 2x2 tile image rises (wlxBleedRise); small tiles have nothing but the uniform stagger — give tiles differentiated hover depth (icon nudge, image desaturation shift already exists on hover for the big tile) and consider a subtle per-tile view() drift at different ranges so the grid feels layered while scrolling. Island: the paper/0.05 watermark drifts; the 64px decorative quote marks could draw/settle (transform-only), the pull-quote could get a clip-path line-wipe on reveal (it is .wlx-stagger — clip-path TRANSITION already exists there, so extend the EXISTING transition, never add an animation). Propose 2-5 moves.',
  },
  {
    key: 'pricing-cta-footer',
    brief: 'LENS: Landing pricing teaser (05) + final dark CTA + footer. Pricing cards carry the uniform stagger only. Final CTA is the emotional close: consider an ink-appropriate signature moment — e.g. the dark section itself revealed by a scroll-driven clip-path inset wipe from the seam (the section ABOVE it is cream; a straight-edge wipe reads as ink flooding the page — verify the section has no overflow-hidden ancestor and gate it), the paper-glow CTA button breathing subtly (opacity of the glow layer only), footer link hover craft (150ms translate). Propose 2-4 moves.',
  },
  {
    key: 'micro-global',
    brief: 'LENS: Global micro-interaction layer. Buttons/links/cards across BOTH files: press states (active:scale exists on primary CTAs only — audit the rest), focus-visible motion (mono system: subtle offset ring appearance, NO invented colors, respect the dual-tone Chromium default finding — only add what does not fight it), language toggle and nav links (they have transition-colors 200ms — consider underline draw via scaleX on a pseudo... note style-jsx cannot see Tailwind pseudo utilities; implement via the global block with plain CSS on nav classes). Every micro-interaction: 100-150ms, ease-out. Propose 3-5 moves, smallest effort first.',
  },
  {
    key: 'pricing-page',
    brief: 'LENS: /pricing (StudioPricingPage.tsx). Zero scroll-linked motion and view() entrances are proven useless there (short page, everything above fold — see LAW). What IS available: entrance choreography on load (the .studio-reveal one-shots exist; differentiate them — hero h1 could line-wipe like the landing does, price numerals could wipe via clip-path transition after reveal), FAQ items get hover/expand micro-motion (they are static divs today — check the markup; if they are not accordions do NOT invent accordions, just hover), recommended-card ring/scale settle on load (transform-only, once). Keep the .studio-* namespace. Propose 2-4 moves.',
  },
]

const JUDGES = [
  {
    key: 'law',
    prompt: 'You are the DESIGN.md constraint lawyer. Read docs/LANDING-DESIGN-SYSTEM.md and the LAW block above, then judge the proposed move ONLY on rule compliance: banned properties (blur/filter/layout), missing @supports or .wlx-js/.studio-js gates, missing reduced-motion reset, overflow-hidden ancestors for view() targets, above-fold view() entrances, animation collisions (read the actual target element in the file and check what already animates/transitions it), backticks in the style block, touching the #stores sticky mechanism, touching anything outside components/marketing, copy changes. Verify claims against the REAL file — do not trust the collisionCheck field. Refute with correction when fixable.',
  },
  {
    key: 'taste',
    prompt: 'You are a motion director reviewing for a luxury editorial brand. Judge the proposed move ONLY on taste: does it fit the Ink & Bone print-object identity (motion should feel like paper, ink, print production — settles, wipes, weight — not like a tech demo)? Is it differentiated or is it another uniform fade? Does the easing/duration follow the taste law (ease-out only, entrance 500-800, feedback 100-150)? Would it read as premium on the tenth visit or become annoying? Would removing it lose anything? Refute anything decorative, bouncy, cliched (pulse badges, floating icons, tilt cards, shimmer), or that fights reading. Be harsh — a 9/10 page is easy to make worse.',
  },
  {
    key: 'eng',
    prompt: 'You are the engineer who ships this on a mid-range Android phone. Read the actual target code first. Judge ONLY implementability and performance: is the spec complete enough to apply without questions? Compositor-only (transform/opacity/clip-path)? Does it trigger layout or large paint areas? Does the selector actually exist? Will it survive npm run ci:build (valid CSS inside a styled-jsx template literal, valid Tailwind classes)? Does it break at 375px or in the en locale? Does @property/counter syntax (if used) actually work as written — check syntax character by character? Refute with correction when fixable.',
  },
]

const SCORERS = [
  { key: 'motion-director', persona: 'Motion director from a luxury fashion/editorial digital studio. You care about narrative, differentiation, and whether the scroll tells a story.' },
  { key: 'perf-engineer', persona: 'Performance engineer testing on a mid-range Android over 4G. You care about compositor-only work, paint areas, jank risk, and whether heavy motion stays 60fps.' },
  { key: 'a11y-auditor', persona: 'Accessibility auditor. You care about reduced-motion coverage, no-JS visibility, focus states, and that motion never gates content.' },
  { key: 'conversion-cd', persona: 'Conversion-focused creative director for a HK SME audience. You care about whether motion builds trust and desire toward 免費開店, or distracts from it.' },
]

const scoreRubric = [
  'Score the CURRENT state of the WoWlix marketing motion (landing + /pricing) after reading both files end to end.',
  'Rubric — 10 means flawless execution WITHIN the constraints (CSS-only, no libraries, mono palette, Chromium-only scroll effects with static fallbacks). Do NOT deduct for the absence of things the law forbids (WebGL, GSAP, commissioned photography).',
  'Dims: choreography (differentiated per section, narrative), scrollCoupling (continuous response, layered depth), microInteraction (feedback craft on every interactive element), performance (compositor discipline), robustness (gates, resets, fallbacks, collisions), restraint (heavy yet not exhausting).',
  'Evidence rule: every deduction must cite file:line or a concrete measured fact. No vibes-based deductions.',
  'Be strict: 10 must be earned. But be fair: score what is in the code, not what you assume.',
].join('\n')

function dedupe(moves) {
  const seen = new Set()
  const out = []
  for (const m of moves) {
    const k = (m.file + '|' + m.target).toLowerCase().replace(/\s+/g, ' ')
    if (seen.has(k)) continue
    seen.add(k)
    out.push(m)
  }
  return out
}

const TARGET = 10
const MAX_ROUNDS = 4
const history = []
let best = 0
let plateau = 0

// ---- Baseline score (before any changes this workflow makes) ----
phase('Baseline')
log('4 judges scoring the current motion state as baseline')
const baselineVotes = (await parallel(SCORERS.map((s) => () =>
  agent(LAW + '\n\nPERSONA: ' + s.persona + '\n\n' + scoreRubric, {
    label: 'baseline:' + s.key, phase: 'Baseline', schema: SCORE_SCHEMA, effort: 'high',
  })
))).filter(Boolean)
const baselineSorted = baselineVotes.map((v) => v.overall).sort((a, b) => a - b)
const baseline = baselineSorted.length ? baselineSorted[Math.floor(baselineSorted.length / 2)] : 0
const baselineGaps = baselineVotes.flatMap((v) => v.topGaps || [])
log('Baseline median: ' + baseline + '/10')
best = baseline

for (let round = 1; round <= MAX_ROUNDS; round++) {
  if (best >= TARGET) break
  const P = (s) => 'R' + round + ' ' + s
  const gapContext = round === 1
    ? 'Baseline judges named these gaps (address them):\n- ' + baselineGaps.join('\n- ')
    : 'Last round scored ' + history[history.length - 1].median + '/10. Judges named these gaps (address them):\n- ' + history[history.length - 1].gaps.join('\n- ')

  // ---- Ideate ----
  phase(P('Ideate'))
  log('R' + round + ': 6 lenses proposing moves')
  const judged = await pipeline(
    LENSES,
    (lens) => agent(
      LAW + '\n\n' + gapContext + '\n\n' + lens.brief + '\n\nRe-read the CURRENT file state before proposing — earlier rounds may have changed it. Specs must be exact and self-contained.',
      { label: 'ideate:' + lens.key, phase: P('Ideate'), schema: MOVE_SCHEMA, effort: 'high' }
    ),
    (res, lens) => {
      if (!res || !res.moves || !res.moves.length) return []
      log('R' + round + ' ' + lens.key + ': ' + res.moves.length + ' moves → judging')
      return parallel(res.moves.map((mv) => () => {
        const body = JSON.stringify(mv, null, 2)
        return parallel(JUDGES.map((j) => () =>
          agent(LAW + '\n\n' + j.prompt + '\n\nPROPOSED MOVE:\n' + body, {
            label: j.key + ':' + mv.title.slice(0, 22), phase: P('Judge'), schema: VERDICT_SCHEMA,
          })
        )).then((votes) => {
          const v = votes.filter(Boolean)
          // 三個 judge 全部死（API error/limit）= 無判。無判嘅招唔准出街，
          // 唔係「冇人反對」。之前 refutes.length===0 呢個窿令 unjudged move 當 clean。
          if (!v.length) return { ...mv, status: 'dead', killReasons: ['unjudged — all three judges failed'] }
          const refutes = v.filter((x) => x.refuted)
          const corrections = v.filter((x) => x.refuted && x.correction && x.correction.length > 10)
          if (refutes.length === 0) return { ...mv, status: 'clean' }
          if (refutes.length === 1 && corrections.length === 1) return { ...mv, status: 'corrected', spec: mv.spec + '\n\nJUDGE CORRECTION (apply this form):\n' + corrections[0].correction }
          return { ...mv, status: 'dead', killReasons: refutes.map((x) => x.reason.slice(0, 200)) }
        })
      }))
    }
  )

  const all = judged.flat().filter(Boolean)
  const approved = dedupe(all.filter((m) => m.status !== 'dead')).slice(0, 10)
  const dead = all.filter((m) => m.status === 'dead')
  log('R' + round + ': ' + all.length + ' moves → ' + approved.length + ' approved (' + dead.length + ' killed)')
  if (!approved.length) {
    history.push({ round, median: best, gaps: ['no moves survived judging'], moves: [] })
    break
  }

  // ---- Implement (serial per file — same repo, one build at a time) ----
  phase(P('Implement'))
  const byFile = {}
  for (const m of approved) {
    const f = m.file.includes('Pricing') ? 'StudioPricingPage.tsx' : 'WowlixLandingPage.tsx'
    ;(byFile[f] = byFile[f] || []).push(m)
  }
  const implReports = []
  for (const [file, moves] of Object.entries(byFile)) {
    const rep = await agent(
      LAW + '\n\nYou are the implementer. Apply ALL of the following approved motion moves to components/marketing/' + file + '. Where a move has a JUDGE CORRECTION, implement the corrected form.\n\n' +
      JSON.stringify(moves, null, 2) + '\n\n' +
      'Process: Read the current file first. Apply moves one at a time with Edit. Every new class needs its reduced-motion reset added to the existing reduce block. After all edits run: npm run ci:build — it MUST end green; fix anything red before finishing (if a move cannot be made to build, revert THAT move and note it). Then run: git add components/marketing/ && git commit with a conventional feat(landing)/feat(pricing) message in the project style (廣東話 body, list the moves, note any reverted).\n' +
      'Return: a JSON-ish text listing per move: applied|reverted, the exact class/keyframe names you introduced, and for each scroll-driven move the element selector + what property should change on scroll (the verifier will probe these).',
      { label: 'implement:' + file, phase: P('Implement'), effort: 'high' }
    )
    implReports.push({ file, report: rep })
  }

  // ---- Verify in the real browser (single agent — the pane is shared) ----
  phase(P('Verify'))
  const verifyReport = await agent(
    LAW + '\n\nYou are the verifier. A dev server is already running: landing at http://wowlix.localhost:3012/zh-HK and pricing at http://wowlix.localhost:3012/zh-HK/pricing . Use the Browser-pane MCP tools (load via ToolSearch: mcp__Claude_Browser__navigate, mcp__Claude_Browser__javascript_tool, mcp__Claude_Browser__tabs_context). The pane is FLAKY for screenshots — verify with javascript_tool ONLY, never screenshots. Always pass tabId (find it via tabs_context; navigate with force:true first).\n\n' +
    'Implementation reports from this round:\n' + JSON.stringify(implReports, null, 2) + '\n\n' +
    'For EVERY scroll-driven move: sample the element computed transform/clip-path at 3-4 scroll offsets around its section (use requestAnimationFrame double-wait after scrollTo before reading) and confirm the values CHANGE — a mounted timeline with frozen currentTime is a FAIL (this exact bug shipped once). For entrance/hover moves: read computed transition/animation properties and confirm the expected properties are listed with expected durations. Also check: document.documentElement.scrollWidth <= innerWidth at 3 scroll positions (no horizontal scroll), and that .wlx-stagger transitionProperty still contains translate and box-shadow (regression guard). Check both zh-HK and en once.\n' +
    'If the browser pane hangs (30s timeouts twice in a row), fall back to static verification: grep the built CSS for the new keyframes/classes and say browserVerified:false.\n' +
    'Return: per move verified|broken(evidence)|unverifiable, plus the regression-guard results.',
    { label: 'verify', phase: P('Verify'), effort: 'high' }
  )

  // ---- Score ----
  phase(P('Score'))
  const votes = (await parallel(SCORERS.map((s) => () =>
    agent(LAW + '\n\nPERSONA: ' + s.persona + '\n\n' + scoreRubric + '\n\nVerifier measurements from this round (trust these over assumptions):\n' + String(verifyReport).slice(0, 6000), {
      label: 'score:' + s.key, phase: P('Score'), schema: SCORE_SCHEMA, effort: 'high',
    })
  ))).filter(Boolean)
  const sorted = votes.map((v) => v.overall).sort((a, b) => a - b)
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0
  const gaps = votes.flatMap((v) => v.topGaps || []).slice(0, 10)
  log('R' + round + ' median: ' + median + '/10 (individual: ' + sorted.join(', ') + ')')

  history.push({ round, median, individual: sorted, gaps, moves: approved.map((m) => m.title), dead: dead.map((m) => m.title), verify: String(verifyReport).slice(0, 2000) })

  if (median <= best) { plateau++ } else { plateau = 0; best = median }
  if (plateau >= 2) { log('Plateau: two rounds without improvement — stopping honestly.'); break }
}

return { baseline, final: best, target: TARGET, rounds: history }
