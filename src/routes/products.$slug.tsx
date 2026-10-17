import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteFrame } from "@/components/site-frame";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuthUser } from "@/hooks/use-auth-user";
import { supabase } from "@/integrations/supabase/client";
import { addCartItem } from "@/lib/cart";
import { pageHead } from "@/lib/metadata";
import type { Database } from "@/integrations/supabase/types";
type Product = Database["public"]["Tables"]["products"]["Row"];
export const Route = createFileRoute("/products/$slug")({
  head: () =>
    pageHead(
      "Account details",
      "View account details, stock and wallet checkout at BESTPLUG MARKETPLACE.",
    ),
  component: Details,
});
function Details() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuthUser();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState("1");
  const [busy, setBusy] = useState(false);
  const [cartBusy, setCartBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [insufficientFunds, setInsufficientFunds] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setSuccess(false);
    setMessage("");
    setInsufficientFunds(false);
    void supabase
      .from("products")
      .select("*")
      .eq("slug", slug)
      .eq("published", true)
      .is("archived_at", null)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        setProduct(data);
        setLoading(false);
        if (error) setMessage(error.message);
      });
    return () => {
      active = false;
    };
  }, [slug]);
  useEffect(() => {
    if (!user || !product) return;
    void supabase.from("recently_viewed").upsert(
      {
        user_id: user.id,
        product_id: product.id,
        viewed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,product_id" },
    );
  }, [product, user]);
  return (
    <SiteFrame>
      <main className="mx-auto min-h-[65vh] max-w-4xl px-5 py-10">
        <Link className="text-sm text-primary" to="/products">
          ← Marketplace
        </Link>
        {loading ? (
          <p className="mt-8">Loading account…</p>
        ) : !product ? (
          <div className="py-12">
            <h1 className="section-heading">Account unavailable</h1>
            <p className="mt-3 text-muted-foreground">This listing is not available.</p>
          </div>
        ) : (
          <div className="mt-8 grid gap-8 sm:grid-cols-2">
            {product.image_url && (
              <img
                className="aspect-square w-full object-cover"
                src={product.image_url}
                alt={product.title}
              />
            )}
            <div>
              <p className="text-xs uppercase text-primary">BESTPLUG MARKETPLACE</p>
              <h1 className="section-heading mt-3">{product.title}</h1>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                {product.description}
              </p>
              <p className="brand-title mt-6 text-3xl text-primary">
                {new Intl.NumberFormat("en-NG", {
                  style: "currency",
                  currency: product.currency,
                }).format(Number(product.price))}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {product.product_status !== "published"
                  ? "Unavailable"
                  : product.stock > 0
                    ? `${product.stock} available`
                    : "Out of stock"}
              </p>
              {product.metadata &&
                typeof product.metadata === "object" &&
                !Array.isArray(product.metadata) &&
                product.metadata["specifications"] &&
                typeof product.metadata["specifications"] === "object" &&
                !Array.isArray(product.metadata["specifications"]) && (
                  <dl className="mt-5 grid gap-2 border-t border-border pt-4 text-sm sm:grid-cols-2">
                    {Object.entries(product.metadata["specifications"]).map(([label, value]) =>
                      typeof value === "string" ? (
                        <div key={label}>
                          <dt className="text-xs text-muted-foreground">{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ) : null,
                    )}
                  </dl>
                )}
              {product.metadata &&
                typeof product.metadata === "object" &&
                !Array.isArray(product.metadata) &&
                typeof product.metadata["delivery_instructions"] === "string" &&
                product.metadata["delivery_instructions"] && (
                  <p className="mt-4 whitespace-pre-wrap rounded-md border border-border p-3 text-sm">
                    {product.metadata["delivery_instructions"]}
                  </p>
                )}
              <Button
                type="button"
                variant="outline"
                className="mt-5"
                disabled={cartBusy || product.stock === 0 || product.product_status !== "published"}
                onClick={async () => {
                  if (!user) {
                    await navigate({ to: "/auth" });
                    return;
                  }
                  setCartBusy(true);
                  try {
                    await addCartItem(user.id, product.id);
                    window.dispatchEvent(new Event("bestplug-cart-updated"));
                    setMessage("Added to cart.");
                  } catch (error) {
                    setMessage(
                      error instanceof Error
                        ? error.message
                        : "This product could not be added to your cart.",
                    );
                  } finally {
                    setCartBusy(false);
                  }
                }}
              >
                <ShoppingCart aria-hidden="true" /> {cartBusy ? "Adding…" : "Add to Cart"}
              </Button>
              {user ? (
                <form
                  className="mt-6 space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setConfirmOpen(true);
                  }}
                >
                  <label className="block text-sm">
                    Quantity
                    <Input
                      className="mt-2 w-24"
                      type="number"
                      min="1"
                      max={Math.min(20, product.stock)}
                      step="1"
                      required
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </label>
                  <Button
                    type="submit"
                    disabled={
                      busy ||
                      product.stock === 0 ||
                      product.product_status !== "published" ||
                      success
                    }
                  >
                    {success ? "Purchase complete" : "Review purchase"}
                  </Button>
                </form>
              ) : (
                <Button asChild className="mt-6">
                  <Link to="/auth">Sign in to purchase</Link>
                </Button>
              )}
              {success && (
                <Button asChild variant="outline" className="mt-3">
                  <Link to="/wallet">View delivered details</Link>
                </Button>
              )}
              {insufficientFunds && (
                <Button asChild variant="outline" className="mt-3">
                  <Link to="/wallet">Fund your wallet</Link>
                </Button>
              )}
              <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm purchase</DialogTitle>
                    <DialogDescription>
                      Review the current listing and quantity before paying from your wallet.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2 rounded-md border border-border bg-card p-4 text-sm">
                    <p className="font-semibold">{product.title}</p>
                    <p className="text-muted-foreground">Quantity: {Number(quantity)}</p>
                    <p className="flex justify-between gap-4 border-t border-border pt-2 font-semibold">
                      <span>Total</span>
                      <span>
                        {new Intl.NumberFormat("en-NG", {
                          style: "currency",
                          currency: product.currency,
                        }).format(Number(product.price) * Number(quantity))}
                      </span>
                    </p>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setConfirmOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      disabled={
                        busy ||
                        product.stock === 0 ||
                        product.product_status !== "published" ||
                        success
                      }
                      onClick={async () => {
                        setBusy(true);
                        setMessage("");
                        setInsufficientFunds(false);
                        try {
                          const wallet = await supabase.rpc("ensure_user_wallet");
                          if (wallet.error) {
                            setMessage(wallet.error.message);
                            setInsufficientFunds(
                              wallet.error.message.includes("Insufficient wallet balance"),
                            );
                            setConfirmOpen(false);
                            return;
                          }
                          const { error } = await supabase.rpc("purchase_with_wallet", {
                            _product_id: product.id,
                            _quantity: Number(quantity),
                          });
                          if (error) {
                            setMessage(error.message);
                            setInsufficientFunds(
                              error.message.includes("Insufficient wallet balance"),
                            );
                            setConfirmOpen(false);
                            return;
                          }
                          setMessage(
                            "Purchase complete. Your account details are in Wallet & orders.",
                          );
                          setSuccess(true);
                          setProduct({ ...product, stock: product.stock - Number(quantity) });
                          setConfirmOpen(false);
                        } catch {
                          setMessage("The purchase could not be completed. Please try again.");
                          setConfirmOpen(false);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {busy ? "Processing…" : "Confirm and pay"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
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
