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

/** wa.me href 格式（852 + 8 位）。畫面顯示用 PLATFORM_WHATSAPP_DISPLAY。 */
export const PLATFORM_WHATSAPP = "85254323686";
export const PLATFORM_EMAIL = "wowlix@flowstudiohk.com";

/** 本地顯示（zh 面用）。 */
export const PLATFORM_WHATSAPP_DISPLAY = "5432 3686";

/** 國際格式（en 面用）—— 一樣由上面個常數砌，唔好再手打號碼。 */
export const PLATFORM_WHATSAPP_INTL = `+852 ${PLATFORM_WHATSAPP_DISPLAY}`;

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
    intro: "幫香港每間 IG 小店，2 分鐘 set 起專業網店。",
    body: "WoWlix 係專為香港 IG 小店而設嘅開店工具。唔使識砌網頁、唔使請人 —— 揀模板、上架、set 收款，一條 link（wowlix.com/你個店名）搞掂，客人撳入去直接落單。我哋唔做嗰啲「乜都有但你揦手唔成勢」嘅大平台，淨係專心做好一件事：幫你將 followers 變成生意。",
    whyTitle: "點解揀 WoWlix",
    why: [
      "0% 平台佣金 —— 賣幾多賺幾多。客人用轉數快、PayMe、AlipayHK 或銀行轉帳直接過數俾你，啲錢唔會經我哋手。",
      "2 分鐘極速開店，免費開始，唔使入信用卡。",
      "一條 link 搞掂 —— 放落 IG bio，睇貨、落單、過數、追蹤狀態，一版做晒。",
      "廣東話 + 英文，專為香港客而設。",
    ],
    contactTitle: "聯絡我哋",
    contactBody:
      `有嘢想問？WhatsApp ${PLATFORM_WHATSAPP_DISPLAY} 最快，或者 email ${PLATFORM_EMAIL}。`,
    footer: "WoWlix 由 Flow Studio HK 營運。",
  },
  en: {
    title: "About WoWlix",
    intro:
      "Give every Hong Kong IG shop a professional online store in 2 minutes.",
    body: "WoWlix is a store builder designed for Hong Kong IG shops. No web-design skills, no hiring — pick a template, add products, set up payment, and one link (wowlix.com/yourshop) is all you need. Customers click in and order directly. We're not trying to be an everything-platform you can never finish setting up; we just do one thing well: turn your followers into sales.",
    whyTitle: "Why WoWlix",
    why: [
      "0% platform commission — you keep exactly what you earn. Customers pay you directly via FPS, PayMe, AlipayHK or bank transfer; the money never touches our hands.",
      "Open in 2 minutes, free to start, no credit card required.",
      "One link does it all — put it in your IG bio. Products, ordering, payment and order tracking, all on one page.",
      "Cantonese + English, built for Hong Kong shoppers.",
    ],
    contactTitle: "Get in touch",
    contactBody:
      `Got questions? WhatsApp ${PLATFORM_WHATSAPP_INTL} is the fastest, or email ${PLATFORM_EMAIL}.`,
    footer: "WoWlix is operated by Flow Studio HK.",
  },
};

export const platformFaq: Record<
  PlatformLang,
  { question: string; answer: string }[]
> = {
  zh: [
    {
      question: "WoWlix 係咩嚟？",
      answer:
        "專為香港 IG 小店而設嘅開店平台。揀模板、上架、set 收款，一條 link 搞掂，客人直接落單。",
    },
    {
      question: "收費點計？",
      answer:
        "有免費計劃，另外有 Lite（$78／月）同 Pro（$198／月）。",
    },
    {
      question: "係咪真係 0% 抽佣？",
      answer:
        "係。客人用轉數快、PayMe、AlipayHK 或銀行轉帳直接過數俾你，錢唔經平台，我哋一毫子佣都唔抽。",
    },
    {
      question: "點樣收錢？",
      answer:
        "目前支援轉數快（FPS）、PayMe、AlipayHK 同銀行轉帳，全部由客人直接過數俾你。信用卡收款仲整緊，暫時未開放。",
    },
    { question: "開舖要搞幾耐？", answer: "大約 2 分鐘。" },
    {
      question: "使唔使識寫 code 或者砌網頁？",
      answer: "唔使。揀模板、upload 相、打字就搞掂。",
    },
    {
      question: "支唔支援廣東話？",
      answer: "支援。管理後台同你嘅網店介面都可以中英雙語。",
    },
    {
      question: "點樣搵你哋？",
      answer: `WhatsApp ${PLATFORM_WHATSAPP_DISPLAY}，或者 email ${PLATFORM_EMAIL}。`,
    },
  ],
  en: [
    {
      question: "What is WoWlix?",
      answer:
        "A store builder for Hong Kong IG shops. Pick a template, add products, set up payment — one link and your store is live for direct orders.",
    },
    {
      question: "How much does it cost?",
      answer:
        "We have a free plan, plus Lite (HK$78/mo) and Pro (HK$198/mo).",
    },
    {
      question: "Is it really 0% commission?",
      answer:
        "Yes. Customers pay you directly via FPS, PayMe, AlipayHK or bank transfer. The money never touches our platform, and we take zero commission.",
    },
    {
      question: "How do I get paid?",
      answer:
        "We currently support FPS, PayMe, AlipayHK and bank transfers — all paid directly to you. Credit card payment is still under development and not available yet.",
    },
    { question: "How long does setup take?", answer: "About 2 minutes." },
    {
      question: "Do I need web design skills?",
      answer: "No. Just pick a template, upload photos and add text.",
    },
    {
      question: "Do you support Cantonese?",
      answer:
        "Yes. Both the admin dashboard and your storefront support English and Cantonese.",
    },
    {
      question: "How do I reach you?",
      answer:
        `WhatsApp ${PLATFORM_WHATSAPP_INTL}, or email ${PLATFORM_EMAIL}.`,
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
    intro: "有嘢想問？搵我哋 WhatsApp 最快。",
    whatsappTitle: "WhatsApp",
    whatsappBody: "撳掣直接 WhatsApp 我哋。",
    whatsappCta: "WhatsApp 搵我哋",
    emailTitle: "電郵",
    emailBody: "想詳細啲講？可以 email 我哋：",
    footer: "WoWlix 由 Flow Studio HK 營運。",
  },
  en: {
    title: "Contact WoWlix",
    intro: "Got a question? WhatsApp is the fastest way to reach us.",
    whatsappTitle: "WhatsApp",
    whatsappBody: "Tap to message us directly.",
    whatsappCta: "Chat on WhatsApp",
    emailTitle: "Email",
    emailBody: "Prefer email? Reach us at:",
    footer: "WoWlix is operated by Flow Studio HK.",
  },
};
