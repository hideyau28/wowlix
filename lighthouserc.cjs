// Lighthouse CI gate — 淨係 CI 用（npx @lhci/cli autorun）。
// a11y / SEO 係硬 gate；performance 喺 CI runner 上噪音大，先 warn。
module.exports = {
  ci: {
    collect: {
      startServerCommand: "npx next start -p 3100",
      startServerReadyPattern: "Ready",
      url: [
        "http://wowlix.localhost:3100/en",
        "http://wowlix.localhost:3100/en/pricing",
      ],
      numberOfRuns: 1,
      settings: { preset: "desktop" },
    },
    assert: {
      assertions: {
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["warn", { minScore: 0.9 }],
        "categories:performance": ["warn", { minScore: 0.6 }],
      },
    },
    upload: { target: "filesystem", outputDir: "e2e/.artifacts/lhci" },
  },
};
