// ── Quick Groq Key Tester ─────────────────────────────────────────────────
// Run from the backend folder: node test-groq.js
// Tests the Groq API directly and prints the RAW response / error.
// ─────────────────────────────────────────────────────────────────────────────
require("dotenv").config();

const KEY          = process.env.GROQ_API_KEY || "";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODELS       = ["llama-3.1-8b-instant"];

console.log("\n=====================================================");
console.log(" GROQ KEY TESTER — Socialyze");
console.log("=====================================================");
console.log(`Key loaded : ${KEY ? `YES — ends in ...${KEY.slice(-6)}` : "❌ NO KEY FOUND IN .env"}`);
console.log(`Key length : ${KEY.length} chars`);
console.log("");

async function testModel(modelName) {
  console.log(`\n----- Testing model: ${modelName} -----`);
  try {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(GROQ_API_URL, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${KEY}`,
      },
      body: JSON.stringify({
        model:       modelName,
        max_tokens:  20,
        temperature: 0,
        messages:    [{ role: "user", content: "Reply with exactly the word GROQ_OK and nothing else." }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      console.error(`❌ FAILED`);
      console.error(`   status  : ${response.status}`);
      console.error(`   body    : ${errBody.slice(0, 300)}`);
      return false;
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || "(empty)";
    console.log(`✅ SUCCESS — response: "${text.trim()}"`);
    return true;
  } catch (err) {
    console.error(`❌ FAILED`);
    console.error(`   message : ${err.message}`);
    console.error(`   name    : ${err.name}`);
    return false;
  }
}

(async () => {
  let anySuccess = false;
  for (const m of MODELS) {
    const ok = await testModel(m);
    if (ok) { anySuccess = true; break; }
  }

  console.log("\n=====================================================");
  if (anySuccess) {
    console.log(" ✅ At least one model works — Groq IS accessible.");
    console.log(" The server should work. Restart server.js.");
  } else {
    console.log(" ❌ ALL MODELS FAILED — follow these steps:");
    console.log("");
    console.log("   1. Go to: https://console.groq.com/keys");
    console.log("   2. Create or copy your API key");
    console.log("   3. Open backend/.env and set GROQ_API_KEY=<your key>");
    console.log("   4. Save, then run: node test-groq.js again to confirm");
    console.log("   5. Then restart: node server.js");
  }
  console.log("=====================================================\n");
})();
