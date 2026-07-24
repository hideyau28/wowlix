/**
 * Tenant-specific static content for info pages.
 * Keyed by tenant slug. Falls back to "default" (maysshop content).
 *
 * Content here is static copy — not DB-driven — because each tenant
 * has fundamentally different business context (region, policies, etc.).
 */

import { OG_DEFAULT_IMAGE } from "@/lib/site-url";

export type TenantAboutContent = {
  mission: string;
  missionBody: string;
  whyChooseUs: string;
  whyChooseUsItems: string[];
  getInTouch: string;
  getInTouchBody: string;
  contactLinks: { label: string; href: string; text: string }[];
  footer: string;
};

export type TenantContactContent = {
  intro: string;
  whatsapp: { number: string; label: string; description: string };
  email: { address: string; description: string };
  instagram?: { handle: string; description: string };
  businessHours: string;
  responseTime?: string;
  footer: string;
};

export type FAQItem = {
  question: string;
  answer: string;
};

export type TenantShippingContent = {
  intro: string;
  shipsFrom: string;
  options: { name: string; time: string; price: string }[];
  destinations: string;
  processingTime: string;
  dutiesNote: string;
  trackingNote: string;
};

export type TenantReturnsContent = {
  intro: string;
  policy: string;
  acceptedReasons: string[];
  conditions: string[];
  contactNote: string;
  refundTimeline: string;
};

// ─── About content ────────────────────────────────────────────

const aboutDefault: TenantAboutContent = {
  mission: "Our Mission",
  missionBody:
    "{storeName} is dedicated to providing quality products and an excellent shopping experience for customers in Hong Kong. We carefully curate every item to ensure quality and value.",
  whyChooseUs: "Why Choose Us?",
  whyChooseUsItems: [
    "100% authentic products",
    "Fast local delivery",
    "Dedicated customer service",
    "Secure payment methods",
  ],
  getInTouch: "Get in Touch",
  getInTouchBody: "For any enquiries, feel free to contact us:",
  contactLinks: [
    {
      label: "Email",
      href: "mailto:wowlix@flowstudiohk.com",
      text: "wowlix@flowstudiohk.com",
    },
    {
      label: "Website",
      href: "https://wowlix.com",
      text: "https://wowlix.com",
    },
  ],
  footer: "This Platform is powered by Wowlix and operated by Flow Studio HK.",
};

const aboutSolemena: TenantAboutContent = {
  mission: "About Bull Kicks",
  missionBody:
    "Bull Kicks is a sneaker destination connecting Asia's best kicks to the Middle East. Based in Hong Kong — the sneaker capital of Asia — we source and authenticate the most sought-after pairs before shipping them to your doorstep.",
  whyChooseUs: "Why Choose Us?",
  whyChooseUsItems: [
    "Every pair is authenticated before shipping",
    "Specializing in limited editions, Asia exclusives, and hard-to-find large sizes (US 10.5–13)",
    "Ships to UAE, Kuwait, Bahrain, Oman, and Qatar",
    "Based in Hong Kong — the sneaker capital of Asia",
    "Secure payment via Visa, Mastercard, Amex, Apple Pay, and Google Pay",
  ],
  getInTouch: "Get in Touch",
  getInTouchBody: "Have questions? We'd love to hear from you.",
  contactLinks: [
    {
      label: "WhatsApp",
      href: "https://wa.me/85291234567",
      text: "+852 9123 4567",
    },
    {
      label: "Email",
      href: "mailto:hello@bullkicks.com",
      text: "hello@bullkicks.com",
    },
    {
      label: "Instagram",
      href: "https://instagram.com/bullkicks",
      text: "@bullkicks",
    },
  ],
  footer: "Bull Kicks is operated independently. Powered by Wowlix.",
};

// ─── Contact content ──────────────────────────────────────────

const contactDefault: TenantContactContent = {
  intro:
    "Have a question? Get in touch with us through any of the channels below.",
  whatsapp: {
    number: "85254323686",
    label: "WhatsApp Us",
    description:
      "The fastest way to reach us. We typically reply during business hours.",
  },
  email: {
    address: "wowlix@flowstudiohk.com",
    description: "For detailed enquiries or document submissions:",
  },
  businessHours:
    "Monday to Friday: 10:00 AM - 6:00 PM (excluding public holidays)",
  footer: "This Platform is powered by Wowlix and operated by Flow Studio HK.",
};

const contactSolemena: TenantContactContent = {
  intro:
    "Have a question about your order, sizing, or shipping? Reach out to us — we're here to help.",
  whatsapp: {
    number: "85291234567",
    label: "WhatsApp Us",
    description: "The fastest way to reach us. We reply within 24 hours.",
  },
  email: {
    address: "hello@bullkicks.com",
    description:
      "For order enquiries, authentication questions, or partnerships:",
  },
  instagram: {
    handle: "bullkicks",
    description: "Follow us for the latest drops and restocks.",
  },
  businessHours:
    "We respond within 24 hours. Orders are processed Monday to Saturday.",
  responseTime: "Response time: Within 24 hours",
  footer: "Bull Kicks is operated independently. Powered by Wowlix.",
};

// ─── FAQ content ──────────────────────────────────────────────

const faqSolemena: FAQItem[] = [
  {
    question: "Are your sneakers authentic?",
    answer:
      "Yes, every pair is verified before shipping. We provide a Certificate of Authenticity with each order.",
  },
  {
    question: "Where do you ship from?",
    answer: "All orders ship from Hong Kong.",
  },
  {
    question: "What shipping options do you have?",
    answer:
      "SF Economy (5–8 days, $28), Aramex Standard (3–7 days, $65), DHL Express (2–4 days, $135). All prices in USD.",
  },
  {
    question: "Do I have to pay import duties?",
    answer:
      "Yes, import duties and VAT are the buyer's responsibility. UAE charges 5% duty + 5% VAT. Rates vary by country.",
  },
  {
    question: "Can you ship to Saudi Arabia?",
    answer:
      "We currently ship to UAE, Kuwait, Bahrain, Oman, and Qatar. Saudi Arabia direct shipping coming soon.",
  },
  {
    question: "What is your return policy?",
    answer:
      "All items are final sale due to their limited-edition nature. Returns accepted only for wrong item/size shipped. Authentication seal must remain intact.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "Credit/debit cards (Visa, Mastercard, Amex), Apple Pay, and Google Pay.",
  },
  {
    question: "Do you offer installment payments?",
    answer: "Buy Now Pay Later options (Tabby/Tamara) coming soon.",
  },
];

const faqDefault: FAQItem[] = [
  {
    question: "Are your products authentic?",
    answer: "Yes, we guarantee 100% authentic products.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept FPS, PayMe, credit/debit cards, and bank transfer.",
  },
  {
    question: "How long does delivery take?",
    answer:
      "Local delivery within Hong Kong typically takes 1–3 business days.",
  },
  {
    question: "What is your return policy?",
    answer:
      "Returns must be requested within 7 days of delivery. Items must be in original condition with packaging intact.",
  },
];

// ─── Shipping content ─────────────────────────────────────────

const shippingDefault: TenantShippingContent = {
  intro: "We offer fast and reliable local delivery within Hong Kong.",
  shipsFrom: "Hong Kong",
  options: [
    { name: "SF Express (Locker)", time: "1–2 days", price: "HK$30" },
    { name: "SF Express (Home Delivery)", time: "1–2 days", price: "HK$50" },
    { name: "Meetup", time: "By arrangement", price: "Free" },
  ],
  destinations: "Hong Kong",
  processingTime: "1–2 business days",
  dutiesNote: "N/A — local delivery only.",
  trackingNote:
    "Tracking number provided via WhatsApp for all SF Express orders.",
};

const shippingSolemena: TenantShippingContent = {
  intro:
    "All orders are shipped from Hong Kong to the Middle East. We partner with trusted international carriers to ensure your sneakers arrive safely.",
  shipsFrom: "Hong Kong",
  options: [
    { name: "SF Economy", time: "5–8 business days", price: "$28 USD" },
    { name: "Aramex Standard", time: "3–7 business days", price: "$65 USD" },
    { name: "DHL Express", time: "2–4 business days", price: "$135 USD" },
  ],
  destinations: "UAE, Kuwait, Bahrain, Oman, and Qatar",
  processingTime: "1–2 business days",
  dutiesNote:
    "Import duties and VAT are the responsibility of the buyer. UAE charges 5% duty + 5% VAT. Rates vary by country.",
  trackingNote:
    "A tracking number is provided via email for all orders once shipped.",
};

// ─── Returns content ──────────────────────────────────────────

const returnsDefault: TenantReturnsContent = {
  intro:
    "We want you to be happy with your purchase. If something isn't right, here's how we can help.",
  policy: "Return or exchange requests must be made within 7 days of delivery.",
  acceptedReasons: [
    "Item arrived damaged",
    "Wrong item received",
    "Wrong size received",
  ],
  conditions: [
    "Items must be in original condition with packaging intact",
    "Personal hygiene products and opened items are not eligible",
    "Contact us via WhatsApp or email to initiate a return",
  ],
  contactNote: "Please contact customer service to arrange returns.",
  refundTimeline:
    "Refunds are processed within 5–7 business days after the returned item is received and inspected.",
};

const returnsSolemena: TenantReturnsContent = {
  intro:
    "Due to the limited-edition nature of our products, all items are final sale. We only accept returns in specific circumstances.",
  policy: "All items are final sale.",
  acceptedReasons: ["Wrong item shipped", "Wrong size shipped"],
  conditions: [
    "Authentication seal must remain intact for any return eligibility",
    "Return requests must be submitted within 7 days of delivery",
    "Contact us via WhatsApp or email to initiate a return",
    "Items must be unworn and in original packaging",
  ],
  contactNote:
    "To initiate a return, contact us via WhatsApp (+852 9123 4567) or email (hello@bullkicks.com).",
  refundTimeline:
    "Refunds are processed within 5–7 business days after the approved return is received.",
};

// ─── SEO content ──────────────────────────────────────────────

export type TenantSEO = {
  title: string;
  description: string;
  ogImage: string;
};

const seoMaysshop: TenantSEO = {
  title: "{storeName} - 香港波鞋專門店",
  description: "探索最新波鞋及運動裝備，正品保證！",
  ogImage: OG_DEFAULT_IMAGE,
};

const seoDefault: TenantSEO = {
  title: "{storeName} | WoWlix",
  description: "Shop quality products at {storeName}. Powered by WoWlix.",
  ogImage: OG_DEFAULT_IMAGE,
};

const seoSolemena: TenantSEO = {
  title: "Bull Kicks | Authenticated Sneakers from Asia to the Middle East",
  description:
    "Shop authenticated sneakers shipped from Hong Kong. Limited editions, Asia exclusives, and large sizes (US 10.5-13). Ships to UAE and GCC countries.",
  ogImage: "https://placehold.co/1200x630/1A1A2E/FFFFFF?text=Bull+Kicks",
};

// ─── Lookup functions ─────────────────────────────────────────

const contentMap = {
  about: { default: aboutDefault, "solemena-test": aboutSolemena } as Record<
    string,
    TenantAboutContent
  >,
  contact: {
    default: contactDefault,
    "solemena-test": contactSolemena,
  } as Record<string, TenantContactContent>,
  faq: { default: faqDefault, "solemena-test": faqSolemena } as Record<
    string,
    FAQItem[]
  >,
  shipping: {
    default: shippingDefault,
    "solemena-test": shippingSolemena,
  } as Record<string, TenantShippingContent>,
  returns: {
    default: returnsDefault,
    "solemena-test": returnsSolemena,
  } as Record<string, TenantReturnsContent>,
  seo: {
    default: seoDefault,
    maysshop: seoMaysshop,
    "solemena-test": seoSolemena,
  } as Record<string, TenantSEO>,
};

export function getAboutContent(slug: string): TenantAboutContent {
  return contentMap.about[slug] || contentMap.about.default;
}

export function getContactContent(slug: string): TenantContactContent {
  return contentMap.contact[slug] || contentMap.contact.default;
}

export function getFAQContent(slug: string): FAQItem[] {
  return contentMap.faq[slug] || contentMap.faq.default;
}

export function getShippingContent(slug: string): TenantShippingContent {
  return contentMap.shipping[slug] || contentMap.shipping.default;
}

export function getReturnsContent(slug: string): TenantReturnsContent {
  return contentMap.returns[slug] || contentMap.returns.default;
}

export function getSEOContent(slug: string): TenantSEO {
  return contentMap.seo[slug] || contentMap.seo.default;
}
