/**
 * 平台（WoWlix 本身）嘅 about / faq / contact 文案 —— 單一真相。
 *
 * 點解要呢個檔：呢三頁本身係租戶店共用 route，內容靠 `getXContent(tenant.slug)`
 * 攞，平台 host 上 tenant 解做 default 店（maysshop）→ 出咗人哋間店嘅文案
 *（live 實測 title「About Us - B」、body 係波鞋店嘢）。呢度擺平台自己嘅文案，
 * 頁面加一個 `isPlatformMode()` branch render 佢，租戶店嗰邊一 pixel 唔郁。
 *
 * ⚠️ 全部 claim 必須同 WoWlix 真做到嘅嘢對齊（Yau 零容忍「講咗做唔到」）：
 *  - 0% 平台佣金 = 已鎖 forever-promise（客人直接過數，錢唔經平台）
 *  - 信用卡收款 = 仲未開放（ENABLE_CARD_CHECKOUT gate）—— FAQ 一定要老實講
 *  - 平台聯絡 = WhatsApp 54323686 + wowlix@flowstudiohk.com（冇 IG/FB/Threads）
 *
 * 改文案就改呢度，改完 build 就出到街（呢三頁係 ƒ dynamic，唔使特別 redeploy
 * 邏輯，但 platform copy 屬「文案」拍板位 —— 出 prod 前要 Yau 過目）。
 */

export type PlatformLang = "zh" | "en";

/** wa.me 格式（852 + 8 位）。畫面顯示用 formatWhatsApp()。 */
export const PLATFORM_WHATSAPP = "85254323686";
export const PLATFORM_EMAIL = "wowlix@flowstudiohk.com";

/** 54323686 → "5432 3686"（人睇嘅顯示）。 */
export const PLATFORM_WHATSAPP_DISPLAY = "5432 3686";

export const platformAbout: Record<
  PlatformLang,
  {
    title: string;
    intro: string;
    body: string;
    whyTitle: string;
    why: string[];
    contactTitle: string;
    contactBody: string;
    footer: string;
  }
> = {
  zh: {
    title: "關於 WoWlix",
    intro: "讓香港每個 IG 小店，2 分鐘就有一個專業網店。",
    body: "WoWlix 係為香港 Instagram 小店而做嘅開店工具。你唔使識砌網站、唔使請人 —— 揀模板、擺產品、set 收款，一條 link（wowlix.com/你個店名）就開得成，客人撳入嚟直接落單。我哋唔想做一個「乜都有但你揦手唔成」嘅大平台，只想做好一件事：幫你把 followers 變成生意。",
    whyTitle: "點解揀 WoWlix",
    why: [
      "0% 平台佣金 —— 你賣幾多全部係你嘅。客人用轉數快、PayMe、AlipayHK 或銀行轉帳直接過數俾你，錢唔經我哋手。",
      "2 分鐘開店，免費開始，唔使信用卡。",
      "一條 link 搞掂 —— 擺落 IG bio，商品、落單、收款、追蹤全部喺一頁。",
      "廣東話 + 英文，為香港客人而設。",
    ],
    contactTitle: "搵我哋",
    contactBody:
      "有問題想傾？WhatsApp 54323686 最快，或者 email wowlix@flowstudiohk.com。",
    footer: "WoWlix 由 Flow Studio HK 營運。",
  },
  en: {
    title: "About WoWlix",
    intro:
      "Give every Hong Kong Instagram shop a professional online store in 2 minutes.",
    body: "WoWlix is a store builder made for Hong Kong Instagram sellers. No web-design skills, no hiring — pick a template, add your products, set up payment, and one link (wowlix.com/yourshop) is your store. Customers tap in and order directly. We're not trying to be an everything-platform you can never finish setting up; we do one thing well: turn your followers into customers.",
    whyTitle: "Why WoWlix",
    why: [
      "0% platform commission — every dollar you make is yours. Customers pay you directly via FPS, PayMe, AlipayHK or bank transfer; the money never passes through us.",
      "Open in 2 minutes, free to start, no credit card.",
      "One link does it all — put it in your IG bio: products, orders, payment and tracking, all on one page.",
      "Cantonese + English, built for Hong Kong shoppers.",
    ],
    contactTitle: "Get in touch",
    contactBody:
      "Questions? WhatsApp +852 5432 3686 is fastest, or email wowlix@flowstudiohk.com.",
    footer: "WoWlix is operated by Flow Studio HK.",
  },
};

export const platformFaq: Record<
  PlatformLang,
  { question: string; answer: string }[]
> = {
  zh: [
    {
      question: "WoWlix 係咩？",
      answer:
        "香港 IG 小店開店平台。揀模板、擺產品、set 收款，一條 link 就開到網店，客人直接落單。",
    },
    {
      question: "開店要幾錢？",
      answer:
        "免費開始。之後有 Lite（$78 一個月）同 Pro（$198 一個月），再加一個免費計劃。",
    },
    {
      question: "係咪真係 0% 佣金？",
      answer:
        "係。客人用轉數快、PayMe、AlipayHK 或銀行轉帳直接過數俾你，錢唔經平台，我哋一蚊佣金都唔收。",
    },
    {
      question: "我點收錢？",
      answer:
        "而家支援轉數快、PayMe、AlipayHK 同銀行轉帳，全部客人直接過數俾你。信用卡收款我哋仲整緊，暫時未開放。",
    },
    { question: "開店要幾耐？", answer: "大約 2 分鐘。" },
    {
      question: "我需要識砌網站嗎？",
      answer: "唔使。揀模板、擺相、打字就得。",
    },
    {
      question: "支唔支援廣東話？",
      answer: "支援。後台同你間店都可以中英雙語。",
    },
    {
      question: "點聯絡你哋？",
      answer: "WhatsApp 54323686，或者 email wowlix@flowstudiohk.com。",
    },
  ],
  en: [
    {
      question: "What is WoWlix?",
      answer:
        "A store builder for Hong Kong Instagram shops. Pick a template, add products, set up payment — one link and your store is live, with customers ordering directly.",
    },
    {
      question: "How much does it cost?",
      answer:
        "Free to start. Paid plans are Lite (HK$78/mo) and Pro (HK$198/mo), alongside a free tier.",
    },
    {
      question: "Is it really 0% commission?",
      answer:
        "Yes. Customers pay you directly via FPS, PayMe, AlipayHK or bank transfer. The money never touches our platform and we take zero commission.",
    },
    {
      question: "How do I get paid?",
      answer:
        "We currently support FPS, PayMe, AlipayHK and bank transfer — all paid directly to you. Credit-card checkout is still in the works and not available yet.",
    },
    { question: "How long does setup take?", answer: "About 2 minutes." },
    {
      question: "Do I need any web-design skills?",
      answer: "No. Pick a template, add photos and text — that's it.",
    },
    {
      question: "Do you support Cantonese?",
      answer:
        "Yes. Both the dashboard and your storefront support Cantonese and English.",
    },
    {
      question: "How do I reach you?",
      answer:
        "WhatsApp +852 5432 3686, or email wowlix@flowstudiohk.com.",
    },
  ],
};

export const platformContact: Record<
  PlatformLang,
  {
    title: string;
    intro: string;
    whatsappTitle: string;
    whatsappBody: string;
    whatsappCta: string;
    emailTitle: string;
    emailBody: string;
    footer: string;
  }
> = {
  zh: {
    title: "聯絡 WoWlix",
    intro: "有問題想搵我哋？WhatsApp 最快。",
    whatsappTitle: "WhatsApp",
    whatsappBody: "撳掣直接同我哋傾。",
    whatsappCta: "WhatsApp 聯絡我們",
    emailTitle: "電郵",
    emailBody: "想詳細啲？可以電郵我哋：",
    footer: "WoWlix 由 Flow Studio HK 營運。",
  },
  en: {
    title: "Contact WoWlix",
    intro: "Got a question? WhatsApp is the fastest way to reach us.",
    whatsappTitle: "WhatsApp",
    whatsappBody: "Message us directly.",
    whatsappCta: "Chat on WhatsApp",
    emailTitle: "Email",
    emailBody: "Prefer email? Reach us at:",
    footer: "WoWlix is operated by Flow Studio HK.",
  },
};
