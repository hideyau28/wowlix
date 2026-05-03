"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { User, Phone, Mail, MapPin, ChevronRight, LogOut, ShoppingBag, Edit3, Check, X } from "lucide-react";
import { useToast } from "@/components/Toast";

export default function ProfilePage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || "zh-HK";
  const { user, loading, logout, updateProfile } = useAuth();
  const { showToast } = useToast();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push(`/${locale}/login?redirect=/${locale}/profile`);
    }
  }, [loading, user, router, locale]);

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setAddress(user.address || "");
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    const result = await updateProfile({ name, email, address });
    if (result.success) {
      showToast("資料已更新");
      setEditing(false);
    } else {
      showToast(result.error || "更新失敗");
    }
    setSaving(false);
  };

  const handleCancel = () => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setAddress(user.address || "");
    }
    setEditing(false);
  };

  const handleLogout = async () => {
    await logout();
    router.push(`/${locale}`);
  };

  const t = {
    title: locale === "zh-HK" ? "我的帳戶" : "My Account",
    personalInfo: locale === "zh-HK" ? "個人資料" : "Personal Info",
    name: locale === "zh-HK" ? "姓名" : "Name",
    namePlaceholder: locale === "zh-HK" ? "輸入你的姓名" : "Enter your name",
    phone: locale === "zh-HK" ? "電話" : "Phone",
    email: locale === "zh-HK" ? "電郵" : "Email",
    emailPlaceholder: locale === "zh-HK" ? "輸入你的電郵" : "Enter your email",
    address: locale === "zh-HK" ? "預設地址" : "Default Address",
    addressPlaceholder: locale === "zh-HK" ? "輸入送貨地址" : "Enter shipping address",
    edit: locale === "zh-HK" ? "編輯" : "Edit",
    orderHistory: locale === "zh-HK" ? "訂單記錄" : "Order History",
    viewOrders: locale === "zh-HK" ? "查看所有訂單" : "View all orders",
    logout: locale === "zh-HK" ? "登出" : "Logout",
    notSet: locale === "zh-HK" ? "未設定" : "Not set",
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-olive-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="px-4 py-6 pb-28">
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">
          {t.title}
        </h1>

        <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 mb-4">
          <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">{t.personalInfo}</h2>
            {!editing ? (
              <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-sm text-olive-600 hover:text-olive-700 dark:text-olive-500">
                <Edit3 size={14} />
                {t.edit}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={handleCancel} className="p-1.5 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"><X size={18} /></button>
                <button onClick={handleSave} disabled={saving} className="p-1.5 text-olive-600 hover:text-olive-700 dark:text-olive-500 disabled:opacity-50"><Check size={18} /></button>
              </div>
            )}
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            <div className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center"><User size={18} className="text-zinc-500" /></div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">{t.name}</div>
                {editing ? (
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePlaceholder} className="w-full text-sm text-zinc-900 dark:text-zinc-100 bg-transparent border-none p-0 focus:outline-none focus:ring-0" />
                ) : (
                  <div className="text-sm text-zinc-900 dark:text-zinc-100">{user.name || <span className="text-zinc-400">{t.notSet}</span>}</div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center"><Phone size={18} className="text-zinc-500" /></div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">{t.phone}</div>
                <div className="text-sm text-zinc-900 dark:text-zinc-100">
                  {user.phone || (
                    <span className="text-zinc-400 dark:text-zinc-500">—</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center"><Mail size={18} className="text-zinc-500" /></div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">{t.email}</div>
                {editing ? (
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.emailPlaceholder} className="w-full text-sm text-zinc-900 dark:text-zinc-100 bg-transparent border-none p-0 focus:outline-none focus:ring-0" />
                ) : (
                  <div className="text-sm text-zinc-900 dark:text-zinc-100">{user.email || <span className="text-zinc-400">{t.notSet}</span>}</div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center"><MapPin size={18} className="text-zinc-500" /></div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">{t.address}</div>
                {editing ? (
                  <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t.addressPlaceholder} rows={2} className="w-full text-sm text-zinc-900 dark:text-zinc-100 bg-transparent border-none p-0 focus:outline-none focus:ring-0 resize-none" />
                ) : (
                  <div className="text-sm text-zinc-900 dark:text-zinc-100">{user.address || <span className="text-zinc-400">{t.notSet}</span>}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <Link href={`/${locale}/profile/orders`} className="flex items-center justify-between p-4 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 mb-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-olive-100 dark:bg-olive-900/30 flex items-center justify-center">
              <ShoppingBag size={18} className="text-olive-600 dark:text-olive-500" />
            </div>
            <div>
              <div className="font-medium text-zinc-900 dark:text-zinc-100">{t.orderHistory}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">{t.viewOrders}</div>
            </div>
          </div>
          <ChevronRight size={20} className="text-zinc-400" />
        </Link>

        <button onClick={handleLogout} className="flex items-center justify-center gap-2 w-full p-4 rounded-2xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors">
          <LogOut size={18} />
          {t.logout}
        </button>
      </div>
    </div>
  );
}
