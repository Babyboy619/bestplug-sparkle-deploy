import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function imageType(bytes: Uint8Array): { extension: string; contentType: string } | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: "jpg", contentType: "image/jpeg" };
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { extension: "png", contentType: "image/png" };
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return { extension: "webp", contentType: "image/webp" };
  }
  return null;
}

export const Route = createFileRoute("/api/profile-avatar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authorization = request.headers.get("authorization");
        const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
        if (!token || !url || !key || !serviceKey) {
          return Response.json({ error: "Authenticated upload is unavailable." }, { status: 401 });
        }

        const authClient = createClient<Database>(url, key, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error: claimsError } = await authClient.auth.getClaims(token);
        const userId = claims?.claims?.sub;
        if (claimsError || typeof userId !== "string") {
          return Response.json(
            { error: "Your session has expired. Sign in again." },
            { status: 401 },
          );
        }

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return Response.json({ error: "Choose a supported image file." }, { status: 400 });
        }
        const file = form.get("avatar");
        if (!(file instanceof File) || file.size < 1 || file.size > 5 * 1024 * 1024) {
          return Response.json({ error: "Choose an image no larger than 5 MB." }, { status: 400 });
        }
        const bytes = new Uint8Array(await file.arrayBuffer());
        const detected = imageType(bytes);
        if (!detected) {
          return Response.json(
            { error: "Only JPEG, PNG, or WebP images are supported." },
            { status: 400 },
          );
        }

        const admin = createClient<Database>(url, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const objectPath = `${userId}/${crypto.randomUUID()}.${detected.extension}`;
        const { error: uploadError } = await admin.storage
          .from("profile-avatars")
          .upload(objectPath, bytes, { contentType: detected.contentType, upsert: false });
        if (uploadError) {
          return Response.json(
            { error: "The profile photo could not be uploaded." },
            { status: 500 },
          );
        }
        const { data: publicUrl } = admin.storage.from("profile-avatars").getPublicUrl(objectPath);
        const { error: profileError } = await admin
          .from("profiles")
          .update({ avatar_url: publicUrl.publicUrl })
          .eq("id", userId);
        if (profileError) {
          await admin.storage.from("profile-avatars").remove([objectPath]);
          return Response.json({ error: "The profile photo could not be saved." }, { status: 500 });
        }
        return Response.json({ avatarUrl: publicUrl.publicUrl });
      },
    },
  },
});
