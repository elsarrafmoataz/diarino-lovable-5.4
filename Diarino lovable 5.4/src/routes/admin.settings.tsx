import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getOAuthStatus,
  saveOAuthSettings,
  issueAdminCsrfToken,
  getOAuthAuditLog,
} from "@/lib/oauth-settings.functions";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [
      { title: "إعدادات OAuth - DIAR TOK" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

type Status = Awaited<ReturnType<typeof getOAuthStatus>>;
type AuditLog = Awaited<ReturnType<typeof getOAuthAuditLog>>;
type AuditItem = AuditLog["items"][number];

function SettingsPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [status, setStatus] = useState<Status | null>(null);
  const [audit, setAudit] = useState<AuditItem[]>([]);
  const [csrf, setCsrf] = useState<{ token: string; expiresAt: string } | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function load() {
    setChecking(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        navigate({ to: "/" });
        return;
      }
      // تأكيد إضافي من صلاحيات المستخدم من جهة العميل قبل عرض الصفحة
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", sess.session.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!role) {
        navigate({ to: "/" });
        return;
      }
      const [s, a, t] = await Promise.all([
        getOAuthStatus(),
        getOAuthAuditLog(),
        issueAdminCsrfToken(),
      ]);
      setStatus(s);
      setAudit(a.items);
      setCsrf(t);
    } catch (e) {
      setMsg({ type: "err", text: (e as Error).message || "تعذر تحميل الإعدادات" });
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!csrf) {
      setMsg({ type: "err", text: "رمز الحماية غير متاح - أعد تحميل الصفحة" });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await saveOAuthSettings({ data: { clientId, clientSecret, csrfToken: csrf.token } });
      setMsg({ type: "ok", text: "تم حفظ الإعدادات بنجاح" });
      setClientId(""); setClientSecret("");
      await load();
    } catch (e) {
      setMsg({ type: "err", text: (e as Error).message || "فشل الحفظ" });
      // الرمز يُستهلك مرة واحدة - أعد إصداره
      try {
        const t = await issueAdminCsrfToken();
        setCsrf(t);
      } catch { /* ignore */ }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div dir="rtl" style={{
      minHeight: "100vh", background: "#0f172a", color: "#fff", padding: 20,
      fontFamily: 'system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif',
    }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>إعدادات Google OAuth</h1>
          <Link to="/admin" style={{ color: "#38bdf8", fontSize: 13, textDecoration: "none" }}>← لوحة التحكم</Link>
        </div>

        {checking ? (
          <div style={{ background: "#1e293b", padding: 20, borderRadius: 12 }}>...جاري التحميل</div>
        ) : (
          <>
            <StatusCard status={status} />

            <div style={{ background: "#1e293b", padding: 20, borderRadius: 12, marginTop: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 12px" }}>تحديث بيانات الاعتماد</h2>
              <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 16px", lineHeight: 1.6 }}>
                أدخل Google Client ID وClient Secret الجديدين. سيتم حفظهما بأمان وتسجيل العملية في سجل التدقيق.
              </p>

              {msg && (
                <div style={{
                  padding: "10px 12px", borderRadius: 8, marginBottom: 12, fontSize: 13,
                  background: msg.type === "ok" ? "#065f46" : "#7f1d1d",
                  color: "#fff",
                }}>{msg.text}</div>
              )}

              <form onSubmit={onSave}>
                {/* رمز CSRF مخفي - يُتحقق منه من جهة الخادم */}
                <input type="hidden" name="csrf_token" value={csrf?.token ?? ""} />
                <label style={labelStyle}>Google Client ID</label>
                <input
                  value={clientId} onChange={(e) => setClientId(e.target.value)}
                  placeholder="xxxx.apps.googleusercontent.com"
                  style={inputStyle} required autoComplete="off"
                />
                <label style={labelStyle}>Google Client Secret</label>
                <input
                  type="password"
                  value={clientSecret} onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="GOCSPX-..."
                  style={inputStyle} required autoComplete="off"
                />
                <button
                  type="submit" disabled={saving || !csrf}
                  style={{
                    marginTop: 12, width: "100%", padding: "12px 16px", borderRadius: 10,
                    background: "#0891b2", color: "#fff", border: "none", fontWeight: 800,
                    fontSize: 14, cursor: saving ? "wait" : "pointer",
                  }}
                >
                  {saving ? "...جاري الحفظ" : "حفظ الإعدادات"}
                </button>
              </form>
            </div>

            <AuditCard items={audit} />
          </>
        )}
      </div>
    </div>
  );
}

function StatusCard({ status }: { status: Status | null }) {
  if (!status) return null;
  const ok = status.connected;
  return (
    <div style={{
      background: ok ? "#064e3b" : "#7c2d12",
      padding: 16, borderRadius: 12,
      border: `1px solid ${ok ? "#10b981" : "#ea580c"}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{
          width: 12, height: 12, borderRadius: "50%",
          background: ok ? "#10b981" : "#f97316",
          boxShadow: `0 0 8px ${ok ? "#10b981" : "#f97316"}`,
        }} />
        <strong style={{ fontSize: 15 }}>
          {ok ? "الربط مفعّل" : "الربط غير مكتمل"}
        </strong>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.8, color: "#e2e8f0" }}>
        <div>Client ID (بيئة التشغيل): {status.env.clientIdConfigured ? status.env.clientIdMasked ?? "✓" : "✗ غير مضبوط"}</div>
        <div>Client Secret (بيئة التشغيل): {status.env.clientSecretConfigured ? "✓ مضبوط" : "✗ غير مضبوط"}</div>
        {status.db.updatedAt && (
          <div style={{ marginTop: 8, color: "#94a3b8", fontSize: 12 }}>
            آخر تحديث في القاعدة: {new Date(status.db.updatedAt).toLocaleString("ar")}
          </div>
        )}
      </div>
    </div>
  );
}

function AuditCard({ items }: { items: AuditItem[] }) {
  return (
    <div style={{ background: "#1e293b", padding: 20, borderRadius: 12, marginTop: 16 }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 12px" }}>
        سجل التدقيق — تحديثات Google OAuth
      </h2>
      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: "#94a3b8" }}>لا توجد تحديثات مسجّلة بعد.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "#94a3b8", textAlign: "right" }}>
                <th style={thStyle}>التاريخ</th>
                <th style={thStyle}>المستخدم</th>
                <th style={thStyle}>الفعل</th>
                <th style={thStyle}>Client ID</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} style={{ borderTop: "1px solid #334155" }}>
                  <td style={tdStyle}>{new Date(it.created_at).toLocaleString("ar")}</td>
                  <td style={tdStyle}>{it.updated_by_email ?? it.updated_by ?? "-"}</td>
                  <td style={tdStyle}>{it.action}</td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12 }}>{it.client_id_masked ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 700, color: "#cbd5e1",
  marginTop: 12, marginBottom: 6,
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  background: "#0f172a", color: "#fff", border: "1px solid #334155",
  fontSize: 13, fontFamily: "inherit",
};
const thStyle: React.CSSProperties = { padding: "8px 6px", fontWeight: 700 };
const tdStyle: React.CSSProperties = { padding: "8px 6px", color: "#e2e8f0" };
