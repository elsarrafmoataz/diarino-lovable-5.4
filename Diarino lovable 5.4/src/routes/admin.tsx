import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم - DIAR TOK" },
      { name: "description", content: "لوحة تحكم المسؤول لإدارة منصة ديار توك" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

function Admin() {
  return (
    <iframe
      src="/admin.html"
      title="DIAR TOK Admin"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        border: "none",
      }}
    />
  );
}
