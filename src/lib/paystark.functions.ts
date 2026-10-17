import { createServerFn } from "@tanstack/react-start";
import { topupAmountSchema } from "@/lib/payment-validation";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  getPaystarkConfig,
  initializePaystarkTransaction,
  verifyPaystarkTransaction,
} from "@/lib/paystark.server";
import { z } from "zod";

const referenceSchema = z.object({
  reference: z
    .string()
    .trim()
    .min(8)
    .max(80)
    .regex(/^[A-Za-z0-9._-]+$/),
});

function toMinorUnits(amount: number) {
  return Math.round(amount * 100);
}

export const startPaystarkTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => topupAmountSchema.parse(input))
  .handler(async ({ data, context }) => {
    const config = getPaystarkConfig();
    const emailClaim = context.claims.email;
    const email = typeof emailClaim === "string" ? emailClaim : "";
    if (!email) throw new Error("Your account needs a verified email to start payment.");

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("display_name")
      .eq("id", context.userId)
      .maybeSingle();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const reference = `ps-${crypto.randomUUID()}`;
    const { error: intentError } = await supabaseAdmin.from("payment_intents").insert({
      user_id: context.userId,
      provider: "paystark",
      reference,
      amount: data.amount,
      currency: "NGN",
      status: "pending",
    });
    if (intentError) throw new Error("We could not start this payment. Please try again.");

    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const origin = new URL(getRequest().url).origin;
      const checkout = await initializePaystarkTransaction(config, {
        email,
        amountMinor: toMinorUnits(data.amount),
        reference,
        callbackUrl: new URL("/payments/callback", origin).toString(),
      });
      await supabaseAdmin
        .from("payment_intents")
        .update({
          provider_reference: checkout.accessCode,
          raw: {
            provider_reference: checkout.accessCode,
            authorization_url: checkout.authorizationUrl,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("reference", reference)
        .eq("user_id", context.userId)
        .eq("status", "pending");
      return { reference, authorizationUrl: checkout.authorizationUrl, amount: data.amount };
    } catch (error) {
      await supabaseAdmin
        .from("payment_intents")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("reference", reference)
        .eq("user_id", context.userId)
        .eq("status", "pending");
      throw error instanceof Error
        ? error
        : new Error("PayStark could not start this payment. Please try again.");
    }
  });

export const verifyPaystarkTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => referenceSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: intent, error: intentError } = await context.supabase
      .from("payment_intents")
      .select("reference,amount,status")
      .eq("reference", data.reference)
      .eq("user_id", context.userId)
      .eq("provider", "paystark")
      .maybeSingle();
    if (intentError || !intent) throw new Error("This payment reference could not be found.");
    if (intent.status === "success") {
      return { status: "success", amount: Number(intent.amount), alreadyCredited: true };
    }
    if (intent.status !== "pending")
      return { status: intent.status, amount: Number(intent.amount) };

    const checked = await verifyPaystarkTransaction(
      getPaystarkConfig(),
      intent.reference,
      toMinorUnits(Number(intent.amount)),
    );
    if (!checked.confirmed) {
      if (
        checked.amountMinor !== null &&
        checked.amountMinor !== toMinorUnits(Number(intent.amount))
      ) {
        return {
          status: "failed",
          amount: Number(intent.amount),
          error: "Payment amount did not match.",
        };
      }
      if (!checked.pending) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("payment_intents")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("reference", intent.reference)
          .eq("user_id", context.userId)
          .eq("provider", "paystark")
          .eq("status", "pending");
      }
      if (checked.currency !== null && checked.currency !== "NGN") {
        return {
          status: "failed",
          amount: Number(intent.amount),
          error: "Payment currency did not match.",
        };
      }
      return {
        status: checked.pending ? "pending" : "failed",
        amount: Number(intent.amount),
        error: checked.pending
          ? "Payment is still pending confirmation."
          : "Payment was not confirmed.",
      };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settlement, error } = await supabaseAdmin.rpc("settle_paystark_payment", {
      _reference: intent.reference,
      _amount: Number(intent.amount),
      ...(checked.providerReference ? { _provider_reference: checked.providerReference } : {}),
      _provider_data: JSON.parse(JSON.stringify(checked.payload)),
    });
    if (error) throw new Error("Payment was confirmed but wallet settlement needs another check.");
    return {
      status: "success",
      amount: Number(intent.amount),
      alreadyCredited: settlement?.[0]?.already_credited ?? false,
    };
  });
