import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "استعادة كلمة المرور - DIAR TOK" },
      { name: "description", content: "أرسل رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  return (
    <div dir="rtl" style={wrap}>
      <div style={card}>
        <h1 style={title}>استعادة كلمة المرور</h1>
        <p style={sub}>أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة تعيين كلمة المرور.</p>
        {status === "sent" ? (
          <div style={ok}>تم إرسال رابط الاستعادة إلى بريدك. تحقق من صندوق الوارد.</div>
        ) : (
          <form onSubmit={onSubmit}>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={input}
            />
            {error && <div style={err}>{error}</div>}
            <button type="submit" disabled={status === "loading"} style={btn}>
              {status === "loading" ? "جارٍ الإرسال..." : "إرسال رابط الاستعادة"}
            </button>
          </form>
        )}
        <div style={{ marginTop: 16, fontSize: 13 }}>
          <Link to="/" style={{ color: "#0891b2" }}>← العودة لتسجيل الدخول</Link>
        </div>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = { position: "fixed", inset: 0, background: "linear-gradient(135deg,#0f172a,#0891b2)", display: "grid", placeItems: "center", padding: 20, fontFamily: "system-ui,sans-serif" };
const card: React.CSSProperties = { width: "100%", maxWidth: 400, background: "#fff", padding: 32, borderRadius: 20, boxShadow: "0 20px 50px rgba(0,0,0,.3)" };
const title: React.CSSProperties = { fontSize: 22, fontWeight: 900, margin: "0 0 8px", color: "#0f172a" };
const sub: React.CSSProperties = { fontSize: 14, color: "#64748b", margin: "0 0 20px" };
const input: React.CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 14, marginBottom: 12, boxSizing: "border-box" };
const btn: React.CSSProperties = { width: "100%", padding: "12px 16px", borderRadius: 10, border: "none", background: "#0891b2", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" };
const err: React.CSSProperties = { background: "#fef2f2", color: "#b91c1c", padding: "8px 10px", borderRadius: 8, fontSize: 13, marginBottom: 10 };
const ok: React.CSSProperties = { background: "#ecfdf5", color: "#065f46", padding: "12px 14px", borderRadius: 10, fontSize: 14 };