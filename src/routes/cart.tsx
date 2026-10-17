import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { SiteFrame } from "@/components/site-frame";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/use-auth-user";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/metadata";
import type { Database } from "@/integrations/supabase/types";

type Product = Pick<
  Database["public"]["Tables"]["products"]["Row"],
  "id" | "title" | "slug" | "price" | "currency" | "stock" | "image_url" | "published"
>;
type CartLine = { productId: string; quantity: number; product: Product | null };

export const Route = createFileRoute("/cart")({
  head: () => pageHead("Cart", "Review your cart and securely checkout with your wallet."),
  component: CartPage,
});

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(amount);
}

function CartPage() {
  const { user, loading: authLoading } = useAuthUser();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [orderReference, setOrderReference] = useState<string | null>(null);
  const [checkoutReference, setCheckoutReference] = useState<string | null>(null);

  const loadCart = useCallback(async () => {
    if (!user) {
      setLines([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: cartRows, error } = await supabase
      .from("cart_items")
      .select("product_id,quantity")
      .eq("user_id", user.id);
    if (error || !cartRows?.length) {
      setLines([]);
      setLoading(false);
      if (error) setMessage("Your cart could not be loaded. Please refresh.");
      return;
    }
    const ids = cartRows.map((row) => row.product_id);
    const { data: products } = await supabase
      .from("products")
      .select("id,title,slug,price,currency,stock,image_url,published")
      .in("id", ids);
    const byId = new Map((products ?? []).map((product) => [product.id, product as Product]));
    setLines(
      cartRows.map((row) => ({
        productId: row.product_id,
        quantity: row.quantity,
        product: byId.get(row.product_id) ?? null,
      })),
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadCart();
  }, [loadCart]);

  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = lines.reduce(
    (sum, line) => sum + (line.product ? Number(line.product.price) * line.quantity : 0),
    0,
  );
  const unavailable = lines.some(
    (line) => !line.product?.published || !line.product || line.product.stock < line.quantity,
  );

  async function setQuantity(productId: string, quantity: number) {
    if (!user) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("set_cart_item_quantity", {
      _product_id: productId,
      _quantity: quantity,
    });
    if (error) {
      setMessage(
        error.message.includes("stock")
          ? "That quantity is no longer available."
          : "Quantity could not be updated.",
      );
    } else {
      window.dispatchEvent(new Event("bestplug-cart-updated"));
      setCheckoutReference(null);
      await loadCart();
    }
    setBusy(false);
  }

  async function removeItem(productId: string) {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("cart_items")
      .delete()
      .eq("user_id", user.id)
      .eq("product_id", productId);
    if (error) setMessage("Cart item could not be removed.");
    else {
      window.dispatchEvent(new Event("bestplug-cart-updated"));
      setCheckoutReference(null);
      await loadCart();
    }
    setBusy(false);
  }

  async function clearCart() {
    if (!user || !window.confirm("Clear all items from your cart?")) return;
    setBusy(true);
    const { error } = await supabase.from("cart_items").delete().eq("user_id", user.id);
    if (error) setMessage("Your cart could not be cleared.");
    else {
      window.dispatchEvent(new Event("bestplug-cart-updated"));
      setLines([]);
      setCheckoutReference(null);
      setOrderReference(null);
      setMessage("Cart cleared.");
    }
    setBusy(false);
  }

  async function checkout() {
    if (!user || unavailable || lines.length === 0) return;
    setBusy(true);
    setMessage("");
    const reference = checkoutReference ?? `cart-${crypto.randomUUID()}`;
    setCheckoutReference(reference);
    try {
      const { data: orderId, error } = await supabase.rpc("purchase_cart_with_wallet", {
        _request_reference: reference,
      });
      if (error) {
        setMessage(
          error.message.includes("Insufficient wallet balance")
            ? "Your wallet balance is too low for this order. Fund your wallet to continue."
            : error.message.includes("unavailable") ||
                error.message.includes("no longer available") ||
                error.message.includes("out of stock")
              ? "A product became unavailable. Review your cart and update its quantity."
              : "Checkout could not be completed. Your cart has been kept.",
        );
        return;
      }
      setOrderReference(orderId);
      window.dispatchEvent(new Event("bestplug-cart-updated"));
      setLines([]);
      setMessage("Order placed successfully. Your products are available in Wallet & orders.");
      setCheckoutReference(null);
    } catch {
      setMessage("Checkout could not be completed. Check your orders before retrying.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SiteFrame>
      <main className="mx-auto min-h-[65vh] max-w-6xl px-4 py-8 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-5">
          <div>
            <p className="text-xs font-semibold uppercase text-primary">Shopping</p>
            <h1 className="section-heading mt-2">Cart</h1>
            <p className="mt-2 text-sm text-muted-foreground">{itemCount} items</p>
          </div>
          {lines.length > 0 && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void clearCart()}
            >
              <Trash2 aria-hidden="true" /> Clear cart
            </Button>
          )}
        </div>

        {authLoading || loading ? (
          <p className="py-10 text-sm text-muted-foreground">Loading cart…</p>
        ) : !user ? (
          <div className="py-12 text-center">
            <ShoppingCart className="mx-auto size-8 text-muted-foreground" />
            <h2 className="mt-4 font-semibold">Sign in to use your cart</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your cart is saved to your account.
            </p>
            <Button asChild className="mt-5">
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        ) : lines.length === 0 ? (
          <div className="py-12 text-center">
            <ShoppingCart className="mx-auto size-8 text-muted-foreground" />
            <h2 className="mt-4 font-semibold">Your cart is empty</h2>
            <p className="mt-2 text-sm text-muted-foreground">Add available products to shop.</p>
            <Button asChild className="mt-5">
              <Link to="/products">
                Continue shopping <ArrowRight />
              </Link>
            </Button>
            {orderReference && (
              <p className="mt-4 text-xs text-muted-foreground">
                Order reference: {orderReference}
              </p>
            )}
          </div>
        ) : (
          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <section
              aria-label="Cart items"
              className="divide-y divide-border border-y border-border"
            >
              {lines.map((line) => (
                <article key={line.productId} className="flex gap-3 py-4 sm:gap-5">
                  {line.product?.image_url ? (
                    <img
                      src={line.product.image_url}
                      alt=""
                      className="size-20 shrink-0 rounded-md object-cover sm:size-24"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="size-20 shrink-0 rounded-md bg-secondary sm:size-24"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    {line.product ? (
                      <Link
                        to="/products/$slug"
                        params={{ slug: line.product.slug }}
                        className="font-semibold hover:text-primary"
                      >
                        {line.product.title}
                      </Link>
                    ) : (
                      <p className="font-semibold">Unavailable product</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {line.product
                        ? formatMoney(Number(line.product.price))
                        : "Current listing unavailable"}
                      {line.product && line.product.stock < line.quantity && " · Stock changed"}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Decrease quantity"
                        disabled={busy || line.quantity <= 1}
                        onClick={() => void setQuantity(line.productId, line.quantity - 1)}
                      >
                        <Minus />
                      </Button>
                      <span className="min-w-8 text-center tabular-nums">{line.quantity}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Increase quantity"
                        disabled={
                          busy || !line.product || line.quantity >= Math.min(20, line.product.stock)
                        }
                        onClick={() => void setQuantity(line.productId, line.quantity + 1)}
                      >
                        <Plus />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => void removeItem(line.productId)}
                      >
                        <Trash2 /> Remove
                      </Button>
                    </div>
                  </div>
                  {line.product && (
                    <p className="shrink-0 text-sm font-semibold">
                      {formatMoney(Number(line.product.price) * line.quantity)}
                    </p>
                  )}
                </article>
              ))}
            </section>
            <aside className="h-fit rounded-lg border border-border bg-card p-5">
              <h2 className="font-semibold">Order summary</h2>
              <div className="mt-4 flex justify-between gap-3 text-sm text-muted-foreground">
                <span>Total quantity</span>
                <span>{itemCount}</span>
              </div>
              <div className="mt-3 flex justify-between gap-3 text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatMoney(subtotal)}</span>
              </div>
              <div className="mt-4 flex justify-between gap-3 border-t border-border pt-4 font-semibold">
                <span>Total</span>
                <span>{formatMoney(subtotal)}</span>
              </div>
              <Button
                className="mt-5 w-full"
                disabled={busy || unavailable}
                onClick={() => void checkout()}
              >
                {busy ? "Processing…" : "Checkout with wallet"}
              </Button>
              <Button asChild variant="outline" className="mt-2 w-full">
                <Link to="/products">Continue shopping</Link>
              </Button>
              {unavailable && (
                <p className="mt-3 text-xs text-destructive">
                  Update unavailable or out-of-stock items before checkout.
                </p>
              )}
              {orderReference && (
                <p className="mt-3 break-all text-xs text-muted-foreground">
                  Order reference: {orderReference}
                </p>
              )}
            </aside>
          </div>
        )}
        {message && (
          <p role="status" className="mt-5 text-sm text-primary">
            {message}
          </p>
        )}
      </main>
    </SiteFrame>
  );
}
