import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { SiteFrame } from "@/components/site-frame";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/use-auth-user";
import { adminData } from "@/lib/account.functions";
import { pageHead } from "@/lib/metadata";

type AdminData = Awaited<ReturnType<typeof adminData>>;

export const Route = createFileRoute("/admin")({
  head: () => pageHead("Admin Dashboard", "Manage marketplace products, orders, and customers."),
  component: AdminPage,
});

function AdminPage() {
  const { user, loading, isAdmin, roleLoading, roleError } = useAuthUser();
  const loadAdminData = useServerFn(adminData);
  const [dashboard, setDashboard] = useState<AdminData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || roleLoading) return;
    if (!user || !isAdmin) {
      setDashboard(null);
      setDataLoading(false);
      return;
    }

    let active = true;
    setDataLoading(true);
    setDataError(null);
    void loadAdminData()
      .then((result) => {
        if (active) setDashboard(result);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setDataError(
          error instanceof Error
            ? error.message
            : "Administrator dashboard data could not be loaded.",
        );
      })
      .finally(() => {
        if (active) setDataLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user, loading, isAdmin, roleLoading, loadAdminData]);

  return (
    <SiteFrame>
      <main className="mx-auto min-h-[65vh] max-w-7xl px-5 py-10 sm:px-8">
        <div className="flex items-center gap-3">
          <ShieldCheck aria-hidden="true" className="size-8 text-primary" />
          <div>
            <p className="text-xs uppercase text-primary">BESTPLUG MARKETPLACE</p>
            <h1 className="section-heading mt-1">Admin Dashboard</h1>
          </div>
        </div>

        {loading || roleLoading || dataLoading ? (
          <p className="mt-8 text-muted-foreground" role="status">
            Verifying administrator access…
          </p>
        ) : !user ? (
          <div className="mt-8 rounded-lg border border-border p-6">
            <p>You must sign in with an authorized administrator account to continue.</p>
            <Button asChild className="mt-4">
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        ) : roleError ? (
          <p className="mt-8 rounded-lg border border-destructive p-4 text-sm" role="alert">
            {roleError}
          </p>
        ) : !isAdmin ? (
          <p className="mt-8 rounded-lg border border-destructive p-4 text-sm" role="alert">
            This account is not authorized to access the Admin Dashboard.
          </p>
        ) : dataError ? (
          <p className="mt-8 rounded-lg border border-destructive p-4 text-sm" role="alert">
            {dataError}
          </p>
        ) : dashboard ? (
          <>
            <section className="mt-7 grid gap-4 sm:grid-cols-3" aria-label="Marketplace totals">
              {[
                ["Products", dashboard.products.length],
                ["Recent orders", dashboard.orders.length],
                ["Recent customers", dashboard.profiles.length],
              ].map(([label, count]) => (
                <article key={label} className="rounded-lg border border-border p-5">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="brand-title mt-2 text-3xl font-semibold text-primary">{count}</p>
                </article>
              ))}
            </section>

            <section className="mt-10">
              <h2 className="text-xl font-semibold">Products</h2>
              {dashboard.products.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No products found.</p>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-3 font-semibold">Product</th>
                        <th className="p-3 font-semibold">Price</th>
                        <th className="p-3 font-semibold">Stock</th>
                        <th className="p-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.products.map((product) => (
                        <tr key={product.id} className="border-t border-border">
                          <td className="p-3">{product.title}</td>
                          <td className="p-3">₦{Number(product.price).toLocaleString("en-NG")}</td>
                          <td className="p-3">{product.stock}</td>
                          <td className="p-3">{product.published ? "Published" : "Draft"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="mt-10">
              <h2 className="text-xl font-semibold">Recent orders</h2>
              {dashboard.orders.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No orders found.</p>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-3 font-semibold">Order</th>
                        <th className="p-3 font-semibold">Total</th>
                        <th className="p-3 font-semibold">Status</th>
                        <th className="p-3 font-semibold">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.orders.map((order) => (
                        <tr key={order.id} className="border-t border-border">
                          <td className="p-3 font-mono text-xs">{order.id}</td>
                          <td className="p-3">₦{Number(order.total).toLocaleString("en-NG")}</td>
                          <td className="p-3">{order.status}</td>
                          <td className="p-3">{new Date(order.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="mt-10">
              <h2 className="text-xl font-semibold">Recent customers</h2>
              {dashboard.profiles.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No customer profiles found.</p>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-3 font-semibold">Name</th>
                        <th className="p-3 font-semibold">Customer ID</th>
                        <th className="p-3 font-semibold">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.profiles.map((profile) => (
                        <tr key={profile.id} className="border-t border-border">
                          <td className="p-3">{profile.display_name ?? "Marketplace customer"}</td>
                          <td className="p-3 font-mono text-xs">{profile.id}</td>
                          <td className="p-3">
                            {new Date(profile.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : (
          <p className="mt-8 text-muted-foreground" role="status">
            Administrator dashboard data is not available.
          </p>
        )}
      </main>
    </SiteFrame>
  );
}
