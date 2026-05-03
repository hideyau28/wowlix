"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { type Locale, locales } from "@/lib/i18n";
import type { Translations } from "@/lib/translations";
import { getCartItemCount, getCart } from "@/lib/cart";
import {
  Moon,
  ShoppingCart,
  Sun,
  Menu,
  Search,
  User,
  LogOut,
  ShoppingBag,
  ChevronDown,
} from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { useAuth } from "@/lib/auth-context";
import { useTenantBranding } from "@/lib/tenant-branding";
import MobileMenu from "./MobileMenu";
import SearchOverlay from "./SearchOverlay";
import CartDrawer from "./CartDrawer";

function swapLocale(pathname: string, nextLocale: Locale) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return `/${nextLocale}`;
  if ((locales as readonly string[]).includes(parts[0])) {
    parts[0] = nextLocale;
    return "/" + parts.join("/");
  }
  // Path-based route without locale prefix (e.g. /maysshop) — prepend locale
  return "/" + nextLocale + "/" + parts.join("/");
}

export default function TopNav({
  locale,
  t,
  storeName: initialStoreName = "WoWlix",
  languages,
}: {
  locale: Locale;
  t: Translations;
  storeName?: string;
  languages?: string[];
}) {
  const pathname = usePathname() || `/${locale}`;
  const router = useRouter();
  const [cartCount, setCartCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [cartBounce, setCartBounce] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [storeLogo, setStoreLogo] = useState<string | null>(null);
  const storeName = initialStoreName;
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { resolved, cycleMode } = useTheme();
  const { user, loading: authLoading, logout } = useAuth();
  const { branding: tenantBranding, loading: brandingLoading } =
    useTenantBranding();

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen]);

  const handleLogout = async () => {
    await logout();
    setUserMenuOpen(false);
    router.push(`/${locale}`);
  };

  useEffect(() => {
    const updateCartCount = () => {
      const cart = getCart();
      setCartCount(getCartItemCount(cart));
    };

    const handleCartBounce = () => {
      setCartBounce(true);
      setTimeout(() => setCartBounce(false), 300);
    };

    updateCartCount();

    const openDrawerOnAdd = () => setCartDrawerOpen(true);

    window.addEventListener("storage", updateCartCount);
    window.addEventListener("cartUpdated", updateCartCount);
    window.addEventListener("cartBounce", handleCartBounce);
    window.addEventListener("cartFlyStart", openDrawerOnAdd);

    return () => {
      window.removeEventListener("storage", updateCartCount);
      window.removeEventListener("cartUpdated", updateCartCount);
      window.removeEventListener("cartBounce", handleCartBounce);
      window.removeEventListener("cartFlyStart", openDrawerOnAdd);
    };
  }, []);

  // Use tenant branding for logo only (store name is already correct from SSR prop).
  useEffect(() => {
    if (brandingLoading) return;
    if (tenantBranding.logoUrl && !storeLogo) {
      setStoreLogo(tenantBranding.logoUrl);
    }
  }, [brandingLoading, tenantBranding.logoUrl]);

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const query = formData.get("q") as string;
    if (query?.trim()) {
      router.push(`/${locale}/search?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <>
      <div className="sticky top-0 z-50 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          {/* Logo */}
          <Link
            href={`/${locale}`}
            className="flex items-center gap-2 shrink-0"
          >
            {storeLogo ? (
              <img
                src={storeLogo}
                alt={storeName}
                className="h-8 w-auto max-w-[120px] object-contain"
              />
            ) : (
              <span className="text-base font-bold tracking-wide text-zinc-900 dark:text-zinc-100">
                {storeName}
              </span>
            )}
          </Link>

          {/* Desktop search bar */}
          <form
            onSubmit={handleSearchSubmit}
            className="hidden flex-1 md:block"
          >
            <input
              name="q"
              placeholder={t.nav.search}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
          </form>

          {/* Spacer for mobile (pushes icons to the right) */}
          <div className="flex-1 md:hidden" />

          {/* Mobile search icon */}
          <button
            onClick={() => setSearchOpen(true)}
            className="md:hidden rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            aria-label="Search"
          >
            <Search size={20} />
          </button>

          {/* Desktop controls */}
          <div className="hidden md:flex items-center gap-2">
            <button
              type="button"
              onClick={cycleMode}
              className="rounded-lg border border-zinc-200 bg-white p-1 text-zinc-600 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
              aria-label="Toggle theme"
            >
              {resolved === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            {/* User menu */}
            {!authLoading &&
              (user ? (
                <div ref={userMenuRef} className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    <User size={14} />
                    <span className="max-w-[80px] truncate">
                      {user.name ||
                        user.phone?.replace("+852", "") ||
                        user.email ||
                        ""}
                    </span>
                    <ChevronDown
                      size={12}
                      className={`transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {userMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 z-50">
                      <Link
                        href={`/${locale}/profile`}
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        <User size={14} />
                        {locale === "zh-HK" ? "我的帳戶" : "My Account"}
                      </Link>
                      <Link
                        href={`/${locale}/profile/orders`}
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        <ShoppingBag size={14} />
                        {locale === "zh-HK" ? "訂單記錄" : "Order History"}
                      </Link>
                      <div className="border-t border-zinc-100 dark:border-zinc-800 my-1" />
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        <LogOut size={14} />
                        {locale === "zh-HK" ? "登出" : "Logout"}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href={`/${locale}/login`}
                  className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <User size={14} />
                  {locale === "zh-HK" ? "登入" : "Login"}
                </Link>
              ))}
          </div>

          {/* Language toggle - hidden when tenant has only 1 language */}
          {(!languages || languages.length > 1) && (
            <Link
              href={swapLocale(pathname, locale === "zh-HK" ? "en" : "zh-HK")}
              className="text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
            >
              {locale === "zh-HK" ? "EN" : "繁"}
            </Link>
          )}

          {/* Cart - always visible, opens drawer */}
          <button
            data-cart-icon
            className={`relative flex items-center gap-1 transition-transform duration-150 ${
              cartBounce ? "scale-125" : "scale-100"
            }`}
            style={{ color: "var(--tmpl-accent, #2D6A4F)" }}
            onClick={() => setCartDrawerOpen(true)}
            aria-label="Cart"
          >
            <ShoppingCart size={20} />
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-900 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900">
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            )}
          </button>

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen(true)}
            className="md:hidden rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            aria-label="Menu"
          >
            <Menu size={20} />
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      <MobileMenu
        locale={locale}
        t={t}
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        languages={languages}
      />

      {/* Search Overlay */}
      <SearchOverlay
        locale={locale}
        t={t}
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
      />

      {/* Cart Drawer */}
      <CartDrawer
        locale={locale}
        isOpen={cartDrawerOpen}
        onClose={() => setCartDrawerOpen(false)}
      />
    </>
  );
}
