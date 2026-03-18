import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/universal-panel`;

Deno.test("check_credits returns structured response for uniplay panel", async () => {
  // This test validates the edge function contract without real credentials.
  // It should return a login failure (since we use dummy creds) but with a well-formed JSON response.
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      action: "check_credits",
      url: "https://gestordefender.com",
      username: "test_dummy_user_e2e",
      password: "test_dummy_pass_e2e",
      providerId: "uniplay",
    }),
  });

  const body = await response.json();

  // The function should return 200 even on login failure (error is in the body)
  assertEquals(response.status, 200);
  assertExists(body, "Response body should exist");

  // With dummy credentials, we expect either:
  // - success: false with an error message (login failed)
  // - success: true with credits data (unlikely with dummy creds)
  if (body.success === false) {
    assertExists(body.error, "Failed response should include error message");
    console.log(`✅ Expected login failure: ${body.error}`);
  } else {
    // If somehow it succeeded (unlikely), validate the credits structure
    assertExists(body.credits !== undefined || body.creditsFound !== undefined, "Should have credits info");
    console.log(`✅ Unexpected success - credits: ${body.credits}`);
  }

  console.log(`📋 browserbaseSessionId: ${body.browserbaseSessionId || "n/a"}`);
  console.log(`📋 method: ${body.method || "n/a"}`);
});

Deno.test("check_credits rejects missing parameters", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      action: "check_credits",
      // Missing url, username, password
    }),
  });

  const body = await response.json();
  await console.log(`📋 Missing params response: ${JSON.stringify(body).substring(0, 300)}`);

  // Should return an error (either 400 or 500 with error in body)
  const hasError = response.status >= 400 || body.error || body.success === false;
  assertEquals(hasError, true, "Should reject request with missing parameters");
});

Deno.test("OPTIONS request returns CORS headers", async () => {
  const response = await fetch(FUNCTION_URL, { method: "OPTIONS" });
  await response.text(); // consume body

  assertEquals(response.status, 200);
  const allowOrigin = response.headers.get("access-control-allow-origin");
  assertEquals(allowOrigin, "*", "Should allow all origins");
});
