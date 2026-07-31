import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function mask(v: string | null | undefined): string | null {
  if (!v) return null;
  if (v.length <= 8) return "•".repeat(v.length);
  return v.slice(0, 4) + "•".repeat(Math.max(4, v.length - 8)) + v.slice(-4);
}

async function assertAdmin(context: { supabase: any; userId: string }): Promise<void> {
  const { data: role, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error("Forbidden: role check failed");
  if (!role) throw new Error("Forbidden: admin role required");
}

export const getOAuthStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);

    const { data } = await context.supabase
      .from("oauth_settings")
      .select("google_client_id, google_client_secret, updated_at")
      .eq("id", "default")
      .maybeSingle();

    const envClientId = process.env.GOOGLE_OAUTH_CLIENT_ID ?? null;
    const envClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? null;

    const dbClientId = data?.google_client_id ?? null;
    const dbClientSecret = data?.google_client_secret ?? null;

    return {
      env: {
        clientIdConfigured: !!envClientId,
        clientSecretConfigured: !!envClientSecret,
        clientIdMasked: mask(envClientId),
      },
      db: {
        clientIdMasked: mask(dbClientId),
        clientSecretConfigured: !!dbClientSecret,
        updatedAt: data?.updated_at ?? null,
      },
      connected: !!envClientId && !!envClientSecret,
    };
  });

// CSRF: مصدر رمز مؤقت (15 دقيقة) للمشرف - يُستخدم مرة واحدة عند حفظ الإعدادات
export const issueAdminCsrfToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    // حذف الرموز القديمة/المنتهية لنفس المستخدم
    await context.supabase
      .from("admin_csrf_tokens")
      .delete()
      .eq("user_id", context.userId);
    const rand = (): string => {
      const arr = new Uint8Array(32);
      crypto.getRandomValues(arr);
      return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
    };
    const token = rand();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { error } = await context.supabase
      .from("admin_csrf_tokens")
      .insert({ token, user_id: context.userId, expires_at: expiresAt });
    if (error) throw new Error(error.message);
    return { token, expiresAt };
  });

export const saveOAuthSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { clientId: string; clientSecret: string; csrfToken: string }) => {
    if (!d || typeof d.clientId !== "string" || typeof d.clientSecret !== "string" || typeof d.csrfToken !== "string") {
      throw new Error("Invalid input");
    }
    const clientId = d.clientId.trim();
    const clientSecret = d.clientSecret.trim();
    const csrfToken = d.csrfToken.trim();
    if (clientId.length < 10 || clientId.length > 300) throw new Error("Client ID غير صالح");
    if (clientSecret.length < 10 || clientSecret.length > 300) throw new Error("Client Secret غير صالح");
    if (csrfToken.length < 16 || csrfToken.length > 200) throw new Error("رمز CSRF غير صالح");
    return { clientId, clientSecret, csrfToken };
  })
  .handler(async ({ data, context }) => {
    // فحص صلاحية المشرف (طبقة أولى)
    await assertAdmin(context);

    // فحص رمز CSRF (طبقة ثانية) - يجب أن يكون مملوكاً لنفس المستخدم وغير منتهٍ
    const { data: tok, error: tokErr } = await context.supabase
      .from("admin_csrf_tokens")
      .select("token, user_id, expires_at")
      .eq("token", data.csrfToken)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (tokErr) throw new Error("تعذر التحقق من رمز الحماية");
    if (!tok) throw new Error("رمز الحماية غير صحيح أو منتهي - أعد تحميل الصفحة");
    if (new Date(tok.expires_at).getTime() < Date.now()) {
      await context.supabase.from("admin_csrf_tokens").delete().eq("token", data.csrfToken);
      throw new Error("انتهت صلاحية رمز الحماية - أعد تحميل الصفحة");
    }
    // استهلاك الرمز (استخدام لمرة واحدة)
    await context.supabase.from("admin_csrf_tokens").delete().eq("token", data.csrfToken);

    // إعادة التحقق من الصلاحية بعد الاستهلاك (طبقة ثالثة، حماية من TOCTOU)
    await assertAdmin(context);

    const { error } = await context.supabase
      .from("oauth_settings")
      .upsert({
        id: "default",
        google_client_id: data.clientId,
        google_client_secret: data.clientSecret,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      });
    if (error) throw new Error(error.message);

    // تسجيل الحدث في سجل التدقيق
    const email =
      (context.claims as { email?: string } | null | undefined)?.email ??
      (context.claims as { user_metadata?: { email?: string } } | null | undefined)?.user_metadata?.email ??
      null;
    await context.supabase.from("oauth_settings_audit").insert({
      updated_by: context.userId,
      updated_by_email: email,
      action: "update_google_oauth",
      client_id_masked: mask(data.clientId),
    });

    return { ok: true };
  });

export const getOAuthAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("oauth_settings_audit")
      .select("id, updated_by, updated_by_email, action, client_id_masked, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });
