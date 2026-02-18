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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { token, uid } = await req.json();

    if (!token || !uid) {
      return new Response(
        JSON.stringify({ error: "token and uid are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hash the provided token to compare with stored hash
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const tokenHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Fetch the profile
    const { data: profile, error: fetchError } = await supabase
      .from("profiles")
      .select("verification_token, verification_token_expires_at, email_verified, pending_email")
      .eq("id", uid)
      .single();

    if (fetchError || !profile) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (profile.email_verified) {
      return new Response(
        JSON.stringify({ success: true, message: "Email already verified" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile.verification_token) {
      return new Response(
        JSON.stringify({ error: "No verification token found. Please request a new one." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiry
    if (
      profile.verification_token_expires_at &&
      new Date(profile.verification_token_expires_at) < new Date()
    ) {
      return new Response(
        JSON.stringify({ error: "Verification link has expired. Please request a new one." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Compare token hashes
    if (profile.verification_token !== tokenHash) {
      return new Response(
        JSON.stringify({ error: "Invalid verification token." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If there's a pending email change, update the auth email via admin API
    if (profile.pending_email) {
      const { error: authUpdateError } = await supabase.auth.admin.updateUserById(uid, {
        email: profile.pending_email,
      });

      if (authUpdateError) {
        console.error("Failed to update auth email:", authUpdateError);
        throw new Error(`Failed to update auth email: ${authUpdateError.message}`);
      }
    }

    // Mark as verified, clear token and pending_email
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        email_verified: true,
        verification_token: null,
        verification_token_expires_at: null,
        pending_email: null,
      })
      .eq("id", uid);

    if (updateError) {
      throw new Error(`Failed to update profile: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Email verified successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error verifying email:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
