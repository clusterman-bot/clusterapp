import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { name, email, section, message } = await req.json();

    if (!name || !email || !section || !message) {
      return new Response(JSON.stringify({ error: "All fields are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
        <h2 style="margin: 0 0 16px; color: #111;">New Feedback from Cluster</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <tr>
            <td style="padding: 8px 12px; background: #f4f4f5; font-weight: 600; width: 100px; border-radius: 4px 0 0 4px;">Name</td>
            <td style="padding: 8px 12px; background: #fafafa; border-radius: 0 4px 4px 0;">${escapeHtml(name)}</td>
          </tr>
          <tr><td colspan="2" style="height: 4px;"></td></tr>
          <tr>
            <td style="padding: 8px 12px; background: #f4f4f5; font-weight: 600; border-radius: 4px 0 0 4px;">Email</td>
            <td style="padding: 8px 12px; background: #fafafa; border-radius: 0 4px 4px 0;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td>
          </tr>
          <tr><td colspan="2" style="height: 4px;"></td></tr>
          <tr>
            <td style="padding: 8px 12px; background: #f4f4f5; font-weight: 600; border-radius: 4px 0 0 4px;">Section</td>
            <td style="padding: 8px 12px; background: #fafafa; border-radius: 0 4px 4px 0;">${escapeHtml(section)}</td>
          </tr>
        </table>
        <div style="padding: 16px; background: #f4f4f5; border-radius: 8px; white-space: pre-wrap; line-height: 1.5;">${escapeHtml(message)}</div>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Cluster Feedback <feedback@clusterapp.space>",
        to: ["seif@clusterapp.space"],
        reply_to: email,
        subject: `[${section}] Feedback from ${name}`,
        html: htmlBody,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend error: ${err}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
