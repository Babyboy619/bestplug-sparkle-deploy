import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const referenceSchema = z.object({
  reference: z
    .string()
    .trim()
    .min(8)
    .max(80)
    .regex(/^[A-Za-z0-9._-]+$/),
});

function getConfig() {
  const secret = process.env["NEURAPAY_SECRET_KEY"];
  const businessId = process.env["NEURAPAY_BUSINESS_ID"];
  const webhookSecret = process.env["NEURAPAY_WEBHOOK_SECRET"] ?? "";
  if (!secret || !businessId) throw new Error("Wallet transfers are temporarily unavailable.");
  return { secret, businessId, webhookSecret, baseUrl: process.env["NEURAPAY_BASE_URL"] };
}

export const verifyNeuraPayTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => referenceSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: intent, error: intentError } = await context.supabase
      .from("payment_intents")
      .select("id,user_id,reference,provider,provider_reference,amount,status")
      .eq("reference", data.reference)
      .eq("user_id", context.userId)
      .eq("provider", "neurapay")
      .maybeSingle();

    if (intentError || !intent) throw new Error("This transfer reference could not be found.");
    if (intent.status === "success") {
      return {
        success: true,
        status: "successful",
        amount: Number(intent.amount),
        alreadyCredited: true,
      };
    }
    if (intent.status !== "pending")
      return {
        success: false,
        status: intent.status,
        error: "This transfer is no longer pending.",
      };

    const env = getConfig();
    const neurapay = await import("@/lib/neurapay.server");
    const gateway = neurapay.makeNeuraPayConfig(
      env.secret,
      env.businessId,
      env.webhookSecret,
      env.baseUrl,
    );
    const checked = await neurapay.verifyNeuraPayTransaction(
      gateway,
      intent.reference,
      Number(intent.amount),
    );
    if (!checked.confirmed) {
      if (checked.reason === "amount_mismatch" || checked.reason === "currency_mismatch") {
        return {
          success: false,
          status: "failed",
          error: "The amount or currency did not match. Please contact support.",
        };
      }
      return {
        success: false,
        status: checked.status,
        error:
          checked.reason === "unavailable"
            ? "NeuraPay has not confirmed the transfer yet. Please try again shortly."
            : checked.reason === "not_paid"
              ? "This transfer was not completed."
              : "We have not received this transfer yet. Try again after your bank confirms it.",
      };
    }

    const { data: settlement, error: settlementError } = await supabaseAdmin.rpc(
      "settle_neurapay_payment",
      {
        _reference: intent.reference,
        _amount: Number(intent.amount),
        ...(checked.providerReference ? { _provider_reference: checked.providerReference } : {}),
        _provider_data: JSON.parse(JSON.stringify(checked.payload)),
      },
    );
    if (settlementError)
      throw new Error(
        "The transfer was confirmed but the wallet update needs another check. Please retry shortly.",
      );
    const outcome = settlement?.[0];
    return {
      success: true,
      status: "successful",
      amount: Number(intent.amount),
      alreadyCredited: outcome?.already_credited ?? false,
    };
  });
