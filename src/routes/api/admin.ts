import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/admin")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authorization = request.headers.get("authorization");
        const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!token || !url || !key) {
          return Response.json({ error: "Authentication required." }, { status: 401 });
        }
        const client = createClient<Database>(url, key, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error: claimsError } = await client.auth.getClaims(token);
        if (claimsError || !claims?.claims?.sub) {
          return Response.json({ error: "Authentication required." }, { status: 401 });
        }
        const { data: isAdmin, error } = await client.rpc("has_role", {
          _user_id: claims.claims.sub,
          _role: "admin",
        });
        if (error || isAdmin !== true) {
          return Response.json({ error: "Administrator access required." }, { status: 403 });
        }
        return Response.json({ authorized: true });
      },
    },
  },
});
