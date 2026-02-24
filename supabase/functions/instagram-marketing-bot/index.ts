import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// AES-256-GCM decrypt (same pattern as brokerage accounts)
async function decryptToken(encryptedData: string, secret: string): Promise<string> {
  const data = JSON.parse(atob(encryptedData));
  const { iv, ciphertext, tag } = data;

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret.padEnd(32, "0").slice(0, 32)),
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const ivBuffer = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
  const ciphertextBuffer = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const tagBuffer = Uint8Array.from(atob(tag), (c) => c.charCodeAt(0));
  const combined = new Uint8Array(ciphertextBuffer.length + tagBuffer.length);
  combined.set(ciphertextBuffer);
  combined.set(tagBuffer, ciphertextBuffer.length);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBuffer },
    keyMaterial,
    combined
  );

  return new TextDecoder().decode(decrypted);
}

// Encrypt token for storage
async function encryptToken(plaintext: string, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret.padEnd(32, "0").slice(0, 32)),
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    keyMaterial,
    new TextEncoder().encode(plaintext)
  );

  // last 16 bytes = tag
  const encryptedBytes = new Uint8Array(encrypted);
  const ciphertext = encryptedBytes.slice(0, encryptedBytes.length - 16);
  const tag = encryptedBytes.slice(encryptedBytes.length - 16);

  return btoa(JSON.stringify({
    iv: btoa(String.fromCharCode(...iv)),
    ciphertext: btoa(String.fromCharCode(...ciphertext)),
    tag: btoa(String.fromCharCode(...tag)),
  }));
}

async function takeScreenshot(pageUrl: string, browserlessApiKey: string): Promise<Uint8Array> {
  const response = await fetch(
    `https://production-sfo.browserless.io/screenshot?token=${browserlessApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: pageUrl,
        options: { type: "jpeg", quality: 85, fullPage: false },
        viewport: { width: 1080, height: 1080 },
        waitForTimeout: 5000,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Browserless screenshot failed: ${response.status} ${await response.text()}`);
  }

  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

// Generate an authenticated URL using a magic link that redirects to the target page
async function getAuthenticatedUrl(
  supabase: any,
  userId: string,
  targetUrl: string
): Promise<string> {
  // Get user email
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
  if (userError || !userData?.user?.email) {
    console.warn("Could not get user email for auth bypass, using unauthenticated URL");
    return targetUrl;
  }

  // Generate a magic link that redirects to the target page
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: userData.user.email,
    options: {
      redirectTo: targetUrl,
    },
  });

  if (linkError || !linkData?.properties?.action_link) {
    console.warn("Could not generate magic link, using unauthenticated URL:", linkError?.message);
    return targetUrl;
  }

  console.log(`Generated auth link for ${targetUrl}`);
  return linkData.properties.action_link;
}

async function generateCaption(
  pages: string[],
  captionTemplate: string | null,
  lovableApiKey: string
): Promise<string> {
  const systemPrompt = `You are a social media expert for an AI trading platform called ClusterApp. 
Write engaging Instagram captions with relevant hashtags for screenshots of the platform's features.
Keep captions concise (under 200 chars), exciting, and professional. Always end with 5-8 relevant hashtags.
Focus on themes like: AI trading, fintech innovation, algorithmic investing, data-driven decisions.`;

  const userPrompt = `Write an Instagram caption for screenshots of these platform pages: ${pages.join(", ")}.
${captionTemplate ? `Start with this template: "${captionTemplate}"` : ""}
Make it engaging and include trading/fintech hashtags.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    console.error("AI caption generation failed:", response.status);
    return captionTemplate || "🚀 Discover the future of AI-powered trading. #AITrading #Fintech #AlgoTrading #InvestSmart";
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "🚀 AI-powered trading at its finest. #AITrading #Fintech";
}

async function uploadToStorage(
  supabase: any,
  imageBytes: Uint8Array,
  filename: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from("marketing-assets")
    .upload(`screenshots/${filename}`, imageBytes, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from("marketing-assets")
    .getPublicUrl(`screenshots/${filename}`);

  return urlData.publicUrl;
}

function formatIGError(action: string, data: any): string {
  if (data?.error) {
    const e = data.error;
    const parts = [`IG API error (code ${e.code ?? '?'}): ${e.message ?? 'Unknown error'}`];
    if (e.type) parts.push(`[type: ${e.type}]`);
    if (e.is_transient) parts.push('(transient — retry may work)');
    return parts.join(' ');
  }
  return `Failed to ${action}: ${JSON.stringify(data)}`;
}

// Poll a media container until it's FINISHED (or error/timeout)
async function waitForContainerReady(
  containerId: string,
  igToken: string,
  maxAttempts = 15,
  delayMs = 3000
): Promise<void> {
  const graphBase = "https://graph.facebook.com/v21.0";
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      `${graphBase}/${containerId}?fields=status_code,status&access_token=${igToken}`
    );
    const data = await res.json();
    const status = data.status_code ?? data.status;
    console.log(`Container ${containerId} status: ${status} (attempt ${i + 1}/${maxAttempts})`);

    if (status === "FINISHED") return;
    if (status === "ERROR") {
      throw new Error(`Media container ${containerId} failed: ${JSON.stringify(data)}`);
    }
    // IN_PROGRESS or other — wait and retry
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`Media container ${containerId} not ready after ${maxAttempts} attempts`);
}

async function postToInstagram(
  igAccountId: string,
  igToken: string,
  imageUrls: string[],
  caption: string
): Promise<string> {
  const graphBase = "https://graph.facebook.com/v21.0";

  // Create individual media containers
  const containerIds: string[] = [];
  for (const imageUrl of imageUrls) {
    const res = await fetch(
      `${graphBase}/${igAccountId}/media?image_url=${encodeURIComponent(imageUrl)}&is_carousel_item=true&access_token=${igToken}`,
      { method: "POST" }
    );
    const data = await res.json();
    if (!data.id) {
      throw new Error(formatIGError("create media container", data));
    }
    containerIds.push(data.id);
  }

  // Wait for all containers to finish processing
  console.log(`Waiting for ${containerIds.length} media container(s) to finish processing...`);
  for (const cid of containerIds) {
    await waitForContainerReady(cid, igToken);
  }

  // If only one image, post as single
  if (containerIds.length === 1) {
    const singleRes = await fetch(
      `${graphBase}/${igAccountId}/media?image_url=${encodeURIComponent(imageUrls[0])}&caption=${encodeURIComponent(caption)}&access_token=${igToken}`,
      { method: "POST" }
    );
    const singleData = await singleRes.json();
    if (!singleData.id) throw new Error(formatIGError("create single media", singleData));

    await waitForContainerReady(singleData.id, igToken);

    const publishRes = await fetch(
      `${graphBase}/${igAccountId}/media_publish?creation_id=${singleData.id}&access_token=${igToken}`,
      { method: "POST" }
    );
    const publishData = await publishRes.json();
    if (!publishData.id) throw new Error(formatIGError("publish single post", publishData));
    return publishData.id;
  }

  // Create carousel container
  const carouselRes = await fetch(
    `${graphBase}/${igAccountId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_type: "CAROUSEL",
        caption,
        children: containerIds,
        access_token: igToken,
      }),
    }
  );
  const carouselData = await carouselRes.json();
  if (!carouselData.id) {
    throw new Error(formatIGError("create carousel", carouselData));
  }

  // Wait for carousel container to be ready
  await waitForContainerReady(carouselData.id, igToken);

  // Publish carousel
  const publishRes = await fetch(
    `${graphBase}/${igAccountId}/media_publish?creation_id=${carouselData.id}&access_token=${igToken}`,
    { method: "POST" }
  );
  const publishData = await publishRes.json();
  if (!publishData.id) {
    throw new Error(formatIGError("publish carousel", publishData));
  }

  return publishData.id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const BROWSERLESS_API_KEY = Deno.env.get("BROWSERLESS_API_KEY");
  const ENCRYPTION_SECRET = Deno.env.get("ENCRYPTION_SECRET")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let body: { config_id?: string; manual?: boolean; action?: string; token?: string } = {};
  try {
    body = await req.json();
  } catch (_) {}

  // Handle encrypt_token action early
  if (body.action === "encrypt_token" && body.token) {
    try {
      const encrypted = await encryptToken(body.token, ENCRYPTION_SECRET);
      return new Response(JSON.stringify({ encrypted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const configId = body.config_id;
  const isManual = body.manual === true;

  try {
    // Fetch configs
    let query = supabase
      .from("marketing_bot_config")
      .select("*")
      .eq("is_active", true);

    if (configId) {
      query = supabase.from("marketing_bot_config").select("*").eq("id", configId);
    } else {
      // Only fetch configs that are due
      query = query.lte("next_post_at", new Date().toISOString());
    }

    const { data: configs, error: configsError } = await query;
    if (configsError) throw configsError;

    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({ message: "No configs due for posting" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const config of configs) {
      const logEntry: any = {
        user_id: config.user_id,
        pages_captured: config.pages_to_capture,
        status: "error",
      };

      try {
        if (!config.instagram_account_id || !config.ig_access_token_encrypted) {
          throw new Error("Instagram account ID or access token not configured");
        }

        if (!BROWSERLESS_API_KEY) {
          throw new Error("BROWSERLESS_API_KEY secret not configured");
        }

        // Decrypt IG token
        const igToken = await decryptToken(config.ig_access_token_encrypted, ENCRYPTION_SECRET);

        // Pick a random stock to feature in this post
        let featuredStock: string | null = null;
        try {
          const { data: randomStock } = await supabase
            .from("stocks")
            .select("symbol")
            .order("id", { ascending: false }) // Use a column to randomise via JS
            .limit(50);
          if (randomStock && randomStock.length > 0) {
            const pick = randomStock[Math.floor(Math.random() * randomStock.length)];
            featuredStock = pick.symbol;
            console.log(`Random featured stock: ${featuredStock}`);
          }
        } catch (e) {
          console.warn("Could not pick random stock:", e);
        }

        // Screenshot each page
        const pages: string[] = Array.isArray(config.pages_to_capture) ? config.pages_to_capture : [];
        // Append the featured stock page if we picked one
        if (featuredStock) {
          pages.push(`/trade/stocks/${featuredStock}`);
        }
        const baseUrl = "https://clusterapp.lovable.app";

        const imageUrls: string[] = [];
        for (const page of pages.slice(0, 10)) {
          const targetUrl = `${baseUrl}${page}`;
          const timestamp = Date.now();
          const safePageName = page.replace(/\//g, "_").replace(/[^a-z0-9_]/gi, "");
          const filename = `${config.user_id}_${safePageName}_${timestamp}.jpg`;

          // Generate authenticated URL so Browserless can access protected pages
          const authUrl = await getAuthenticatedUrl(supabase, config.user_id, targetUrl);
          console.log(`Screenshotting: ${targetUrl} (via auth link)`);
          const imageBytes = await takeScreenshot(authUrl, BROWSERLESS_API_KEY);
          const publicUrl = await uploadToStorage(supabase, imageBytes, filename);
          imageUrls.push(publicUrl);
        }

        if (imageUrls.length === 0) {
          throw new Error("No pages could be screenshotted");
        }

        // Generate AI caption (include featured stock context)
        const captionPages = featuredStock
          ? [...pages, `Featured stock: $${featuredStock}`]
          : pages;
        const caption = await generateCaption(
          captionPages,
          config.caption_template,
          LOVABLE_API_KEY
        );

        // Post to Instagram
        const igPostId = await postToInstagram(
          config.instagram_account_id,
          igToken,
          imageUrls,
          caption
        );

        // Update config timestamps
        const intervalMs = (config.interval_hours || 24) * 60 * 60 * 1000;
        await supabase
          .from("marketing_bot_config")
          .update({
            last_posted_at: new Date().toISOString(),
            next_post_at: new Date(Date.now() + intervalMs).toISOString(),
          })
          .eq("id", config.id);

        logEntry.status = "success";
        logEntry.instagram_post_id = igPostId;
        logEntry.caption = caption;
        results.push({ config_id: config.id, status: "success", igPostId });
      } catch (err: any) {
        console.error(`Error processing config ${config.id}:`, err);
        logEntry.error_message = err.message || String(err);
        results.push({ config_id: config.id, status: "error", error: err.message });
      }

      // Insert log
      await supabase.from("marketing_bot_logs").insert(logEntry);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Fatal error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
