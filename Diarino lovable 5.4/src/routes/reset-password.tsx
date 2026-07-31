import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "تعيين كلمة مرور جديدة - DIAR TOK" },
      { name: "description", content: "تعيين كلمة مرور جديدة لحسابك." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Supabase places recovery tokens in URL hash; the client auto-processes them.
    const hash = window.location.hash;
    const isRecovery = hash.includes("type=recovery") || hash.includes("access_token");
    if (isRecovery) {
      setReady(true);
    } else {
      supabase.auth.getSession().then(({ data }) => {
        setReady(!!data.session);
        if (!data.session) setError("رابط الاستعادة غير صالح أو منتهي. اطلب رابطاً جديداً.");
      });
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل.");
    if (password !== confirm) return setError("كلمتا المرور غير متطابقتين.");
    setStatus("loading");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setStatus("done");
      setTimeout(() => navigate({ to: "/" }), 1500);
    }
  }

  return (
    <div dir="rtl" style={wrap}>
      <div style={card}>
        <h1 style={title}>تعيين كلمة مرور جديدة</h1>
        {status === "done" ? (
          <div style={ok}>تم تحديث كلمة المرور بنجاح. جارٍ التحويل...</div>
        ) : (
          <form onSubmit={onSubmit}>
            <input type="password" required placeholder="كلمة المرور الجديدة" value={password} onChange={(e) => setPassword(e.target.value)} style={input} disabled={!ready} />
            <input type="password" required placeholder="تأكيد كلمة المرور" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={input} disabled={!ready} />
            {error && <div style={err}>{error}</div>}
            <button type="submit" disabled={!ready || status === "loading"} style={btn}>
              {status === "loading" ? "جارٍ الحفظ..." : "حفظ كلمة المرور"}
            </button>
          </form>
        )}
        <div style={{ marginTop: 16, fontSize: 13 }}>
          <Link to="/" style={{ color: "#0891b2" }}>← العودة للرئيسية</Link>
        </div>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = { position: "fixed", inset: 0, background: "linear-gradient(135deg,#0f172a,#0891b2)", display: "grid", placeItems: "center", padding: 20, fontFamily: "system-ui,sans-serif" };
const card: React.CSSProperties = { width: "100%", maxWidth: 400, background: "#fff", padding: 32, borderRadius: 20, boxShadow: "0 20px 50px rgba(0,0,0,.3)" };
const title: React.CSSProperties = { fontSize: 22, fontWeight: 900, margin: "0 0 20px", color: "#0f172a" };
const input: React.CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 14, marginBottom: 12, boxSizing: "border-box" };
const btn: React.CSSProperties = { width: "100%", padding: "12px 16px", borderRadius: 10, border: "none", background: "#0891b2", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" };
const err: React.CSSProperties = { background: "#fef2f2", color: "#b91c1c", padding: "8px 10px", borderRadius: 8, fontSize: 13, marginBottom: 10 };
const ok: React.CSSProperties = { background: "#ecfdf5", color: "#065f46", padding: "12px 14px", borderRadius: 10, fontSize: 14 };