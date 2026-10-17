import { createFileRoute } from "@tanstack/react-router";
import {
  getPaystarkConfig,
  isRecord,
  verifyPaystarkTransaction,
  verifyPaystarkWebhookSignature,
} from "@/lib/paystark.server";

export const Route = createFileRoute("/api/public/paystark-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature = request.headers.get("x-paystack-signature") ?? "";
        const secret = process.env["PAYSTARK_SECRET_KEY"];
        if (!secret) return Response.json({ error: "Webhook is not configured." }, { status: 503 });
        if (!(await verifyPaystarkWebhookSignature(rawBody, signature, secret))) {
          return Response.json({ error: "Invalid signature." }, { status: 401 });
        }

        let event: unknown;
        try {
          event = JSON.parse(rawBody);
        } catch {
          return Response.json({ error: "Invalid event." }, { status: 400 });
        }
        if (!isRecord(event) || event["event"] !== "charge.success" || !isRecord(event["data"])) {
          return Response.json({ received: true, credited: false });
        }
        const reference = event["data"]["reference"];
        if (typeof reference !== "string") {
          return Response.json({ error: "Invalid payment reference." }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: intent } = await supabaseAdmin
          .from("payment_intents")
          .select("reference,amount,status")
          .eq("provider", "paystark")
          .eq("reference", reference)
          .maybeSingle();
        if (!intent) return Response.json({ received: true, credited: false });
        if (intent.status === "success") {
          return Response.json({ received: true, credited: false, alreadyCredited: true });
        }
        if (intent.status !== "pending") return Response.json({ received: true, credited: false });

        const checked = await verifyPaystarkTransaction(
          getPaystarkConfig(),
          intent.reference,
          Math.round(Number(intent.amount) * 100),
        );
        if (!checked.confirmed) return Response.json({ received: true, credited: false });
        const { data: settlement, error } = await supabaseAdmin.rpc("settle_paystark_payment", {
          _reference: intent.reference,
          _amount: Number(intent.amount),
          ...(checked.providerReference ? { _provider_reference: checked.providerReference } : {}),
          _provider_data: JSON.parse(JSON.stringify(checked.payload)),
        });
        if (error) {
          console.error("PayStark settlement failed", { reference: intent.reference });
          return Response.json({ error: "Settlement could not be completed." }, { status: 500 });
        }
        return Response.json({
          received: true,
          credited: settlement?.[0]?.credited ?? false,
          alreadyCredited: settlement?.[0]?.already_credited ?? false,
        });
      },
    },
  },
});
