import { createFileRoute, redirect } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { SiteFrame } from "@/components/site-frame";
import { requireAdminDashboard } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    try {
      await requireAdminDashboard();
    } catch (error) {
      const isUnauthenticated = error instanceof Error && error.message.includes("Unauthorized");
      throw redirect({ to: isUnauthenticated ? "/auth" : "/" });
    }
  },
  component: AdminDashboard,
});

function AdminDashboard() {
  return (
    <SiteFrame>
      <main className="mx-auto min-h-[65vh] max-w-7xl px-5 py-10 sm:px-8">
        <ShieldCheck aria-hidden="true" className="size-8 text-primary" />
        <h1 className="section-heading mt-4">Admin Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Administrator access is verified from the assigned database role.
        </p>
      </main>
    </SiteFrame>
  );
}
