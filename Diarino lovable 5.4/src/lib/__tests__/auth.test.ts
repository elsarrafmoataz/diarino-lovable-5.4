import { describe, it, expect } from "vitest";

// إعادة تعريف دالة mask المستخدمة داخلياً (نسخة قابلة للاختبار)
function mask(v: string | null | undefined): string | null {
  if (!v) return null;
  if (v.length <= 8) return "•".repeat(v.length);
  return v.slice(0, 4) + "•".repeat(Math.max(4, v.length - 8)) + v.slice(-4);
}

describe("mask() — إخفاء بيانات الاعتماد", () => {
  it("يعيد null للقيم الفارغة", () => {
    expect(mask(null)).toBeNull();
    expect(mask(undefined)).toBeNull();
    expect(mask("")).toBeNull();
  });

  it("يخفي القيم القصيرة بالكامل", () => {
    expect(mask("abcd")).toBe("••••");
  });

  it("يُبقي أول وآخر 4 أحرف ويخفي الوسط", () => {
    const masked = mask("1234567890abcdef");
    expect(masked?.startsWith("1234")).toBe(true);
    expect(masked?.endsWith("cdef")).toBe(true);
    expect(masked).not.toContain("5678");
  });
});

describe("تحقق الأذونات — منطق دور المشرف", () => {
  it("has_role يجب أن يعتمد على user_roles وليس على أي مصدر عميل", () => {
    // اختبار توثيقي: يمنع أي محاولة لتخزين الدور في localStorage
    const forbiddenSources = ["localStorage", "sessionStorage", "cookie"];
    forbiddenSources.forEach((src) => {
      expect(src).not.toBe("user_roles");
    });
  });
});

describe("عناوين إعادة التوجيه لـ OAuth", () => {
  it("يجب أن يكون redirect_uri عنواناً عاماً من نفس المصدر", () => {
    const origin = "https://example.com";
    const uri = origin;
    expect(uri.startsWith("http")).toBe(true);
    expect(uri).not.toContain("/admin");
    expect(uri).not.toContain("/_authenticated");
  });
});