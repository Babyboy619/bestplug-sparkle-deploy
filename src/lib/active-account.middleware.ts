import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const requireActiveAccount = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) {
      console.error("Account status verification failed:", error);
      throw new Error("Account status could not be verified.");
    }
    if (!data) throw new Error("This account is suspended or deactivated.");
    return next();
  });
