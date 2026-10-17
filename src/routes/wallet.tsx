import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, Wallet } from "lucide-react";
import { SiteFrame } from "@/components/site-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthUser } from "@/hooks/use-auth-user";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/metadata";
import { siteConfig } from "@/lib/site-config";
import { startPaystarkTopup, verifyPaystarkTopup } from "@/lib/paystark.functions";
import type { Database } from "@/integrations/supabase/types";

type Tx = Database["public"]["Tables"]["wallet_transactions"]["Row"];
type Order = Database["public"]["Tables"]["order_items"]["Row"];
type PendingPayment = { reference: string; amount: number; authorizationUrl?: string };

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
  const [amount, setAmount] = useState("1000");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const startTopup = useServerFn(startPaystarkTopup);
  const verifyTopup = useServerFn(verifyPaystarkTopup);

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
    const { data: pending } = await supabase
      .from("payment_intents")
      .select("reference,amount,raw")
      .eq("provider", "paystack")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setPendingPayment(
      pending
        ? {
            reference: pending.reference,
            amount: Number(pending.amount),
            ...(typeof pending.raw === "object" &&
            pending.raw !== null &&
            "authorization_url" in pending.raw &&
            typeof pending.raw["authorization_url"] === "string"
              ? { authorizationUrl: pending.raw["authorization_url"] }
              : {}),
          }
        : null,
    );
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
                <form
                  className="space-y-3"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    setPaymentBusy(true);
                    setMessage("");
                    try {
                      const started = await startTopup({ data: { amount: Number(amount) } });
                      setPendingPayment(started);
                      setMessage("Payment started. Complete checkout, then check its status here.");
                    } catch (error) {
                      setMessage(
                        error instanceof Error ? error.message : "Payment could not be started.",
                      );
                    } finally {
                      setPaymentBusy(false);
                    }
                  }}
                >
                  <label className="block text-sm font-semibold" htmlFor="funding-amount">
                    Fund Wallet (NGN)
                    <Input
                      id="funding-amount"
                      className="mt-2 max-w-48"
                      type="number"
                      min="100"
                      max="1000000"
                      step="0.01"
                      required
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      disabled={paymentBusy || Boolean(pendingPayment)}
                    />
                  </label>
                  <Button type="submit" disabled={paymentBusy || Boolean(pendingPayment)}>
                    {paymentBusy ? "Starting…" : "Continue to Paystack"}
                  </Button>
                </form>
              </div>
            </div>
            {pendingPayment && (
              <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
                <p className="min-w-0 flex-1 text-sm">
                  {siteConfig.paymentProviderName} payment of ₦
                  {pendingPayment.amount.toLocaleString()} is pending.
                </p>
                {pendingPayment.authorizationUrl && (
                  <Button asChild variant="outline">
                    <a
                      href={pendingPayment.authorizationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open checkout <ArrowUpRight />
                    </a>
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={paymentBusy}
                  onClick={async () => {
                    setPaymentBusy(true);
                    setMessage("");
                    try {
                      const result = await verifyTopup({
                        data: { reference: pendingPayment.reference },
                      });
                      setMessage(
                        result.error ??
                          (result.status === "success"
                            ? "Payment confirmed. Your wallet is updated."
                            : "Payment is still pending."),
                      );
                      if (result.status === "success" || result.status === "failed") {
                        setPendingPayment(null);
                        await refresh();
                      }
                    } catch (error) {
                      setMessage(
                        error instanceof Error
                          ? error.message
                          : "Payment status could not be checked.",
                      );
                    } finally {
                      setPaymentBusy(false);
                    }
                  }}
                >
                  Check payment
                </Button>
              </div>
            )}
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
                        {tx.description?.replace(/PayStark/gi, "Paystack") ?? "Wallet transaction"}
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
