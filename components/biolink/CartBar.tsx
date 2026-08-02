"use client";

import { useState, useEffect, useRef } from "react";
import { formatPrice } from "@/lib/biolink-helpers";
import { useTemplate } from "@/lib/template-context";
import { getAccentForeground } from "@/lib/cover-templates";

type Props = {
  count: number;
  total: number;
  currency?: string;
  whatsapp: string | null;
  onCheckout?: () => void;
};

export default function CartBar({
  count,
  total,
  currency = "HKD",
  whatsapp,
  onCheckout,
}: Props) {
  const tmpl = useTemplate();
  const [popping, setPopping] = useState(false);
  const [pulsing, setPulsing] = useState(false);
  const prevCountRef = useRef(count);

  useEffect(() => {
    if (count > prevCountRef.current) {
      setPopping(true);
      setPulsing(true);
    }
    prevCountRef.current = count;
  }, [count]);

  const handleCheckout = () => {
    if (onCheckout) {
      onCheckout();
      return;
    }
    if (!whatsapp) return;
    const phone = whatsapp.replace(/[^0-9]/g, "");
    const msg = encodeURIComponent(
      `Hi! 我想落單，購物車有 ${count} 件商品，總計 ${formatPrice(total, currency)}`,
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  };

  return (
    <>
      <div
        className="fixed bottom-0 left-0 right-0 z-40"
        style={{ animation: "cartBarIn 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}
      >
        <div className="max-w-[480px] mx-auto">
          <div
            className="mx-3 mb-3 flex items-center justify-between px-4 py-3 rounded-2xl border shadow-2xl shadow-black/50"
            style={{
              backgroundColor: tmpl.card,
              borderColor: tmpl.subtext + "20",
              animation: pulsing
                ? "cartBarPulse 0.5s ease-out forwards"
                : undefined,
            }}
            onAnimationEnd={(e) => {
              if (e.animationName === "cartBarPulse") setPulsing(false);
            }}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <svg
                  className="w-5 h-5"
                  style={{ color: tmpl.text }}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                  />
                </svg>
                <span
                  className="absolute -top-2 -right-2 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                  style={{
                    backgroundColor: tmpl.accent,
                    color: tmpl.text,
                    animation: popping
                      ? "badgePop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards"
                      : undefined,
                  }}
                  onAnimationEnd={() => setPopping(false)}
                >
                  {count > 9 ? "9+" : count}
                </span>
              </div>
              <span className="font-bold text-sm" style={{ color: tmpl.text }}>
                {formatPrice(total, currency)}
              </span>
            </div>
            <button
              onClick={handleCheckout}
              className="px-5 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-transform min-h-[44px]"
              style={{
                backgroundColor: tmpl.accent,
                // tmpl.text 係「頁面底色之上」嘅字色，唔係 accent 之上嘅 ——
                // noir 就係白字疊落橙色掣，2.20:1。
                color: getAccentForeground(tmpl.accent),
              }}
            >
              結帳
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes cartBarIn {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes cartBarPulse {
          0% {
            transform: scale(1);
          }
          30% {
            transform: scale(1.028);
          }
          65% {
            transform: scale(0.988);
          }
          100% {
            transform: scale(1);
          }
        }
        @keyframes badgePop {
          0% {
            transform: scale(1);
          }
          45% {
            transform: scale(1.75);
          }
          72% {
            transform: scale(0.85);
          }
          100% {
            transform: scale(1);
          }
        }
      `}</style>
    </>
  );
}
