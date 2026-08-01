import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

const SKIP_KEY = "diar_skip_auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DIAR TOK - ديار توك" },
      { name: "description", content: "ديار توك - منصة العقارات على شكل ريلز" },
      { property: "og:title", content: "DIAR TOK - ديار توك" },
      { property: "og:description", content: "منصة العقارات على شكل ريلز" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<{ email: string; userId: string; name: string; avatar: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(SKIP_KEY) === "1") {
      setSkipped(true);
    }

    const readUser = (u: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null }) => {
      const md = (u.user_metadata ?? {}) as Record<string, unknown>;
      const name = (md.full_name || md.name || md.user_name || "") as string;
      const avatar = (md.avatar_url || md.picture || "") as string;
      return { email: u.email ?? "", userId: u.id, name, avatar };
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s?.user) {
        setSession(readUser(s.user));
        setSkipped(false);
        sessionStorage.removeItem(SKIP_KEY);
        setTimeout(() => checkAdmin(s.user.id), 0);
      } else {
        setSession(null);
        setIsAdmin(false);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setSession(readUser(data.session.user));
        checkAdmin(data.session.user.id);
      }
      setLoading(false);
    });

    return () => { sub.subscription.unsubscribe(); };
  }, []);

  async function checkAdmin(uid: string) {
    const { data } = await supabase
      .from("user_roles" as never)
      .select("role")
      .eq("user_id", uid)
      .eq("role", "admin")
      .maybeSingle();
    setIsAdmin(!!data);
  }

  async function fullSignOut() {
    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch {
      try { await supabase.auth.signOut(); } catch { /* ignore */ }
    }
    // مسح أي مخلفات جلسة من التخزين المحلي
    try {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("sb-") || k.startsWith("supabase.")) localStorage.removeItem(k);
      });
    } catch { /* ignore */ }
    sessionStorage.removeItem(SKIP_KEY);
    setSession(null);
    setIsAdmin(false);
    setSkipped(false);
    // تسجيل الخروج من جلسة Google في المتصفح (يفتح ثم يغلق)
    try {
      const w = window.open("https://accounts.google.com/Logout", "_blank", "width=400,height=300,noopener");
      if (w) setTimeout(() => { try { w.close(); } catch { /* ignore */ } }, 1500);
    } catch { /* ignore */ }
  }

  // Listen to iframe postMessages
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      const t = (e.data as { type?: string } | null)?.type;
      if (t === "diar:login") {
        sessionStorage.removeItem(SKIP_KEY);
        setSkipped(false);
      } else if (t === "diar:logout") {
        void fullSignOut();
      } else if (t === "diar:admin") {
        navigate({ to: "/admin" });
      } else if (t === "diar:settings") {
        navigate({ to: "/admin/settings" });
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [navigate]);

  function translateOAuthError(raw: string): string {
    const m = raw.toLowerCase();
    if (m.includes("popup") && m.includes("closed")) return "تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية.";
    if (m.includes("popup") && m.includes("block")) return "المتصفح منع النافذة المنبثقة. فعّل النوافذ لهذا الموقع وحاول مجدداً.";
    if (m.includes("unsupported provider") || m.includes("provider is not enabled"))
      return "مزوّد Google غير مفعّل في الخلفية. راجع إعدادات OAuth.";
    if (m.includes("redirect") && (m.includes("uri") || m.includes("mismatch")))
      return "عنوان إعادة التوجيه غير مطابق للمُسجَّل في Google Cloud.";
    if (m.includes("invalid_client") || m.includes("client_id"))
      return "بيانات اعتماد Google غير صحيحة (Client ID/Secret). حدّثها من صفحة الإعدادات.";
    if (m.includes("access_denied") || m.includes("denied"))
      return "تم رفض الإذن من قِبل المستخدم أو من قِبل Google.";
    if (m.includes("network") || m.includes("fetch")) return "تعذر الاتصال بالخادم. تحقق من الإنترنت.";
    if (m.includes("timeout") || m.includes("timed out")) return "انتهت مهلة الاتصال. حاول مرة أخرى.";
    if (m.includes("expired")) return "انقضت صلاحية الجلسة/الرمز. أعد المحاولة.";
    return raw || "تعذر تسجيل الدخول. حاول مرة أخرى.";
  }

  async function signInGoogle() {
    setSigningIn(true);
    setError(null);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setError(translateOAuthError((result.error as Error).message || ""));
        setSigningIn(false);
        return;
      }
      if (result.redirected) return;
    } catch (e) {
      setError(translateOAuthError((e as Error).message || ""));
    } finally {
      setSigningIn(false);
    }
  }

  function skip() {
    sessionStorage.setItem(SKIP_KEY, "1");
    setSkipped(true);
  }

  const iframeSrc = useMemo(() => {
    const p = new URLSearchParams();
    p.set("auth", session ? "1" : "0");
    p.set("admin", isAdmin ? "1" : "0");
    if (session?.email) p.set("email", session.email);
    if (session?.name) p.set("name", session.name);
    if (session?.avatar) p.set("avatar", session.avatar);
    if (session?.userId) p.set("uid", session.userId);
    return `/app.html?${p.toString()}`;
  }, [session, isAdmin]);

  if (loading) {
    return <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", background: "#0f172a", color: "#fff" }}>...جاري التحميل</div>;
  }

  if (!session && !skipped) {
    return <LoginScreen onGoogle={signInGoogle} onSkip={skip} signingIn={signingIn} error={error} />;
  }

  return (
    <IframeApp key={iframeSrc} src={iframeSrc} />
  );
}

function IframeApp({ src }: { src: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  return (
    <iframe
      ref={ref}
      src={src}
      title="DIAR TOK"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: "none" }}
    />
  );
}

function LoginScreen({ onGoogle, onSkip, signingIn, error }: {
  onGoogle: () => void; onSkip: () => void; signingIn: boolean; error: string | null;
}) {
  return (
    <div dir="rtl" style={{
      position: "fixed", inset: 0,
      background: "linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#0891b2 100%)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      fontFamily: 'system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif',
    }}>
      <button
        onClick={onSkip}
        aria-label="تخطى تسجيل الدخول"
        title="تخطى — تصفح فقط"
        style={{
          position: "absolute", top: 16, right: 16,
          background: "rgba(255,255,255,0.12)", color: "#fff",
          border: "1px solid rgba(255,255,255,0.25)",
          padding: "8px 14px", borderRadius: 999,
          fontSize: 13, fontWeight: 700, cursor: "pointer",
          backdropFilter: "blur(8px)", display: "flex", alignItems: "center", gap: 6,
          zIndex: 5,
        }}
      >
        تخطى ⟶
      </button>

      <div style={{
        width: "100%", maxWidth: 380,
        background: "rgba(255,255,255,0.98)",
        borderRadius: 24, padding: "36px 28px",
        boxShadow: "0 25px 60px rgba(0,0,0,0.4)",
        textAlign: "center",
      }}>
        <div style={{
          width: 72, height: 72, margin: "0 auto 16px",
          borderRadius: 20,
          background: "linear-gradient(135deg,#0891b2,#0f172a)",
          display: "grid", placeItems: "center", color: "#fff", fontWeight: 900, fontSize: 26,
        }}>DT</div>
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: "0 0 6px", color: "#0f172a" }}>ديار توك</h1>
        <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 24px" }}>
          سجّل الدخول للنشر والبث والتفاعل الكامل
        </p>

        {error && (
          <div style={{ background: "#fef2f2", color: "#b91c1c", padding: "10px 12px", borderRadius: 10, fontSize: 13, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <button
          onClick={onGoogle}
          disabled={signingIn}
          style={{
            width: "100%", padding: "12px 16px", borderRadius: 12,
            border: "1px solid #e2e8f0", background: "#fff", cursor: signingIn ? "wait" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            fontSize: 15, fontWeight: 700, color: "#0f172a",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          {signingIn ? "جاري تسجيل الدخول..." : "تسجيل الدخول عبر Google"}
        </button>

        <div style={{ marginTop: 18, fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
          أول مستخدم يقوم بتسجيل الدخول يصبح <b style={{ color: "#0891b2" }}>المشرف</b> تلقائيًا.
          <br/>
          يمكنك التصفح بدون تسجيل، لكن النشر والبث يتطلبان تسجيل الدخول.
        </div>

        <div style={{ marginTop: 14, fontSize: 13 }}>
          <a href="/forgot-password" style={{ color: "#0891b2", textDecoration: "none", fontWeight: 600 }}>
            نسيت كلمة المرور؟
          </a>
        </div>
      </div>
    </div>
  );
}
