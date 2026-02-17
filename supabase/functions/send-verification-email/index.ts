import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { email, userId } = await req.json();

    if (!email || !userId) {
      return new Response(
        JSON.stringify({ error: "email and userId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a random verification token
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const token = Array.from(tokenBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Store token hash and expiry in profiles (24 hour expiry)
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const tokenHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        verification_token: tokenHash,
        verification_token_expires_at: expiresAt,
        email_verified: false,
      })
      .eq("id", userId);

    if (updateError) {
      throw new Error(`Failed to store verification token: ${updateError.message}`);
    }

    // Build verification URL
    const verificationUrl = `https://clusterapp.lovable.app/verify-email?token=${token}&uid=${userId}`;

    // Send email via Resend
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background-color:#111;border-radius:12px;overflow:hidden;border:1px solid #222;">
    <div style="padding:32px 32px 24px;text-align:center;">
      <img src="https://clusterapp.lovable.app/favicon.png" alt="Cluster" width="48" height="48" style="border-radius:8px;">
      <h1 style="color:#fff;font-size:24px;margin:16px 0 8px;">Verify your email</h1>
      <p style="color:#888;font-size:15px;line-height:1.5;margin:0 0 24px;">
        Welcome to Cluster! Click the button below to verify your email address and start trading.
      </p>
      <a href="${verificationUrl}" style="display:inline-block;background-color:#6366f1;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:600;">
        Verify Email
      </a>
      <p style="color:#555;font-size:13px;margin-top:24px;line-height:1.5;">
        This link expires in 24 hours.<br>If you didn't create a Cluster account, you can ignore this email.
      </p>
    </div>
    <div style="border-top:1px solid #222;padding:16px 32px;text-align:center;">
      <p style="color:#444;font-size:12px;margin:0;">© ${new Date().getFullYear()} Cluster. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Cluster <seif@clusterapp.space>",
        to: [email],
        subject: "Verify your Cluster account",
        html: emailHtml,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      throw new Error(`Resend API error [${resendRes.status}]: ${JSON.stringify(resendData)}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error sending verification email:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
