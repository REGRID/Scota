import { getActiveGeminiApiKey } from "../src/lib/aiConfig"

async function checkModels() {
  const apiKey = await getActiveGeminiApiKey()
  console.log("Has API Key:", Boolean(apiKey), "Length:", apiKey.length)

  if (!apiKey) {
    console.log("API Key is empty in database and .env!")
    process.exit(1)
  }

  // 1. Query Google Gemini API to List All Models for this key
  console.log("\nFetching list of available models from Google API...")
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
    const listData = await listRes.json()
    
    if (!listRes.ok) {
      console.error("Failed to list models:", listData)
      process.exit(1)
    }

    const models = (listData.models || [])
      .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m: any) => ({
        name: m.name.replace("models/", ""),
        displayName: m.displayName,
        description: m.description?.slice(0, 80),
      }))

    console.log(`Found ${models.length} models supporting generateContent:`)
    console.table(models)

    // 2. Test generateContent for the top candidate models
    console.log("\n--- Testing generateContent on available models ---")
    for (const m of models) {
      const modelName = m.name
      try {
        const testRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: "Ping test" }] }],
              generationConfig: { maxOutputTokens: 5 },
            }),
          }
        )

        if (testRes.ok) {
          const testData = await testRes.json()
          console.log(`✅ [ACTIVE & WORKING] ${modelName}:`, testData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "OK")
        } else {
          const err = await testRes.text()
          console.log(`❌ [FAILED ${testRes.status}] ${modelName}:`, err.slice(0, 100))
        }
      } catch (err: any) {
        console.log(`❌ [ERROR] ${modelName}:`, err.message)
      }
    }
  } catch (err) {
    console.error("Fetch error:", err)
  }

  process.exit(0)
}

checkModels().catch((err) => {
  console.error(err)
  process.exit(1)
})
