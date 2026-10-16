import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUpRight, Wallet } from "lucide-react";
import { SiteFrame } from "@/components/site-frame";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/use-auth-user";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/metadata";
import { siteConfig } from "@/lib/site-config";
import type { Database } from "@/integrations/supabase/types";

type Tx = Database["public"]["Tables"]["wallet_transactions"]["Row"];
type Order = Database["public"]["Tables"]["order_items"]["Row"];

export const Route = createFileRoute("/wallet")({
  head: () =>
    pageHead(
      "Wallet & orders",
      "Manage your BestPlug wallet, transaction history, and delivered purchases.",
    ),
  component: WalletPage,
});

function WalletPage() {
  const { user, loading } = useAuthUser();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState("");

  async function refresh() {
    const wallet = await supabase.rpc("ensure_user_wallet");
    if (wallet.error) {
      setMessage(wallet.error.message);
      return;
    }
    setBalance(Number(wallet.data?.[0]?.balance ?? 0));
    const [tx, items] = await Promise.all([
      supabase
        .from("wallet_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("order_items").select("*").order("created_at", { ascending: false }).limit(30),
    ]);
    setTransactions(tx.data ?? []);
    setOrders(items.data ?? []);
  }

  useEffect(() => {
    if (user) void refresh();
  }, [user]);

  return (
    <SiteFrame>
      <main className="mx-auto min-h-[65vh] max-w-7xl px-5 py-10 sm:px-8">
        <p className="text-xs uppercase text-primary">Your account</p>
        <h1 className="section-heading mt-2">Wallet & orders</h1>
        {loading ? (
          <p className="mt-8 text-muted-foreground">Loading your account…</p>
        ) : !user ? (
          <div className="mt-8 border-y border-border py-10">
            <Wallet className="size-8 text-primary" />
            <h2 className="mt-4 text-xl font-semibold">Your wallet is waiting.</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to see your balance and purchases.
            </p>
            <Button asChild className="mt-5">
              <Link to="/auth">
                Sign in
                <ArrowUpRight />
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-7 grid gap-8 border-y border-border py-7 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Available balance</p>
                <p className="brand-title mt-3 text-4xl font-semibold text-primary">
                  ₦{balance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">{user.email}</p>
              </div>
              <div className="self-center border-l-2 border-primary pl-5">
                <h2 className="font-semibold">
                  {siteConfig.paymentProviderName} wallet funding is not available yet.
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Payment setup is awaiting the provider’s official API documentation and
                  credentials. Your balance and existing transactions are unaffected.
                </p>
              </div>
            </div>
            {message && (
              <p role="status" className="mt-4 text-sm text-primary">
                {message}
              </p>
            )}
            <section id="transactions" className="scroll-mt-24 py-8">
              <h2 className="text-xl font-semibold">Transaction history</h2>
              {transactions.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No transactions yet.</p>
              ) : (
                transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="mt-4 flex justify-between gap-3 border-b border-border pb-4 text-sm"
                  >
                    <div>
                      <p>
                        {tx.description?.replace(/NeuraPay/gi, "payment provider") ??
                          "Wallet transaction"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString()} · {tx.status}
                      </p>
                    </div>
                    <p className="shrink-0 text-primary">
                      {tx.type === "credit" ? "+" : "−"}₦{Number(tx.amount).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </section>
            <section id="orders" className="scroll-mt-24 pb-8">
              <h2 className="text-xl font-semibold">Your purchases</h2>
              {orders.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No purchases yet.</p>
              ) : (
                orders.map((item) => (
                  <article key={item.id} className="mt-4 border border-border p-4">
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Quantity: {item.quantity} · ₦{Number(item.unit_price).toLocaleString()}
                    </p>
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-primary">
                        Delivered account details
                      </summary>
                      <pre className="mt-3 whitespace-pre-wrap break-all text-sm">
                        {item.delivered_payload ?? "Delivery pending"}
                      </pre>
                    </details>
                  </article>
                ))
              )}
            </section>
          </>
        )}
      </main>
    </SiteFrame>
  );
}
