"use client";

/**
 * Marketing 兩個 surface（landing + /pricing）共用嘅字體 rule。
 *
 * 點解要獨立一個 component：呢啲 rule 本來淨係寫喺 WowlixLandingPage 個
 * style-jsx-global 入面，所以 /pricing 十三個 .font-wlx-display 元素
 * 一條都食唔到 —— font-feature-settings 係 normal、font-optical-sizing
 * 冇 auto。即係 /pricing 個 h1「簡單透明，0% 佣金。」啲全形標點照樣
 * 佔足一個 em（實測「，」34.8px vs「簡」34.7px），而 Fraunces 照樣
 * render 緊 9pt 內文 master。
 *
 * 抄多份落 StudioPricingPage 就會變兩個真相源、遲早走樣，所以抽埋出嚟。
 * 任何新 marketing surface 都要 render 呢個 component。
 *
 * Scoping：呢度只有 .font-wlx-display 一條 class rule，唔郁 :root。
 * 租戶店冇呢個 class，亦唔會 render 呢個 component（§2）。
 */
export default function MarketingTypeStyles() {
  return (
    <style jsx global>{`
      /* halt = half-width 約物。Noto Serif HK 跟港台慣例將全形標點置中擺喺
         em 格入面 —— 內文啱，但 display 尺寸就變成一個窿（128px 之下「，」
         嘅墨迹只佔 [51.4, 75.9]，即係前後各吊住 ~51px 死空氣）。halt 換半形
         advance 收返實（實測 99.7px 變 47.8px）。
         ⚠️ font-feature-settings 係「取代」唔係「merge」—— root 喺
         app/globals.css set 咗 kern/liga/calt，呢度唔重寫一次就會靜靜雞跌咗。
         （原本寫 'ss01','dlig','kern'：前兩隻 Fraunces 個 GSUB 根本冇，
         實測得 ['liga','rvrn']，而佢哋順手殺埋 liga/calt。）
         font-optical-sizing: auto 要 fonts.ts 傳咗 axes:["opsz"] 先有用。 */
      .font-wlx-display {
        font-optical-sizing: auto;
        font-feature-settings: 'kern', 'liga', 'calt', 'halt';
      }
    `}</style>
  );
}
