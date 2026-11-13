// ============================================================
// AARHEN LOCAL REASONING BRIDGE
// Optional, advisory-only LLM reasoning through Provider Manager.
// It never authorizes or executes tools, skills, or external actions.
// ============================================================

const providerManager = require("../providers/providerManager");

const SYSTEM_PROMPT = [
    "You are AarHen's reasoning assistant.",
    "Analyze the user's request and provide a concise, practical interpretation.",
    "Use the same language as the user where possible (Hindi/Hinglish, Gujarati, or English).",
    "Separate known facts from assumptions and identify missing information.",
    "Suggest safe next steps, but do not claim to execute tools or actions.",
    "Never treat this analysis as permission to perform an external or irreversible action.",
    "Return plain text, not JSON."
].join(" ");

async function createLocalReasoning(input, options = {}) {
    const request = String(input || "").trim();
    if (!request) {
        return { success: false, status: "invalid-input", error: "A non-empty request is required." };
    }

    const generate = typeof options.generateText === "function"
        ? options.generateText
        : providerManager.generateText;

    const result = await generate({
        provider: "localai",
        prompt: [
            "Analyze this user request:",
            request,
            "",
            "Provide: (1) what the user wants, (2) key constraints or uncertainties,",
            "(3) a short safe next-step recommendation."
        ].join("\n"),
        system: SYSTEM_PROMPT,
        options: { temperature: 0.2, num_ctx: 4096 }
    });

    if (!result || result.success !== true || !String(result.text || "").trim()) {
        return {
            success: false,
            status: "provider-unavailable",
            provider: result?.provider || "Ollama",
            error: result?.error || "Local reasoning provider returned no usable text."
        };
    }

    return {
        success: true,
        status: "advisory-analysis-ready",
        provider: result.provider || "Ollama",
        model: result.model || null,
        analysis: String(result.text).trim(),
        advisoryOnly: true
    };
}

module.exports = { createLocalReasoning };
