// ============================================================
// AARHEN LOCAL OLLAMA TEXT PROVIDER
// Uses Ollama's local HTTP API; no cloud API key required.
// ============================================================

const DEFAULT_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "aarhen-local";
const DEFAULT_TIMEOUT_MS = 120000;

function createOllamaTextProvider() {
    function getConfig() {
        const raw = String(process.env.AARHEN_OLLAMA_URL || DEFAULT_BASE_URL).trim();
        return {
            baseUrl: raw.replace(/\/+$/, ""),
            model: String(process.env.AARHEN_OLLAMA_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL,
            timeoutMs: Math.max(1000, Math.min(Number(process.env.AARHEN_OLLAMA_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS, 300000)),
            enabled: process.env.AARHEN_OLLAMA_ENABLED === "true"
        };
    }

    async function generateText({ prompt, system = "", model, options = {} } = {}) {
        const config = getConfig();
        if (!config.enabled) {
            return { success: false, provider: "Ollama", error: "Local Ollama provider is disabled. Set AARHEN_OLLAMA_ENABLED=true." };
        }
        if (!String(prompt || "").trim()) {
            return { success: false, provider: "Ollama", error: "Prompt is required." };
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), config.timeoutMs);
        try {
            const response = await fetch(`${config.baseUrl}/api/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: controller.signal,
                body: JSON.stringify({
                    model: String(model || config.model),
                    stream: false,
                    messages: [
                        ...(system ? [{ role: "system", content: String(system) }] : []),
                        { role: "user", content: String(prompt) }
                    ],
                    options: {
                        temperature: Number.isFinite(Number(options.temperature)) ? Number(options.temperature) : 0.3,
                        num_ctx: Number.isFinite(Number(options.num_ctx)) ? Math.max(512, Math.min(Number(options.num_ctx), 32768)) : 4096
                    }
                })
            });

            let data;
            try { data = await response.json(); } catch { data = {}; }
            if (!response.ok) {
                return { success: false, provider: "Ollama", model: String(model || config.model), error: data?.error || `Ollama returned HTTP ${response.status}.` };
            }

            const text = String(data?.message?.content || "").trim();
            if (!text) {
                return { success: false, provider: "Ollama", model: String(model || config.model), error: "Ollama returned an empty response." };
            }
            return {
                success: true,
                provider: "Ollama",
                model: String(data.model || model || config.model),
                text,
                done: data.done === true,
                totalDurationMs: Number.isFinite(data.total_duration) ? Math.round(data.total_duration / 1e6) : null,
                status: "text-generation-completed"
            };
        } catch (error) {
            const timedOut = error?.name === "AbortError";
            return {
                success: false,
                provider: "Ollama",
                model: String(model || config.model),
                error: timedOut ? `Ollama request timed out after ${config.timeoutMs}ms.` : `Cannot connect to local Ollama at ${config.baseUrl}. Make sure Ollama is running. (${error.message})`,
                code: timedOut ? "OLLAMA_TIMEOUT" : "OLLAMA_CONNECTION_FAILED"
            };
        } finally {
            clearTimeout(timer);
        }
    }

    function getProviderStatus() {
        const config = getConfig();
        return {
            success: true,
            provider: "Ollama Local Text Provider",
            connected: config.enabled,
            connectionVerified: false,
            status: config.enabled ? "configured-not-yet-probed" : "disabled",
            supportsTextGeneration: true,
            providerType: "text-generation",
            baseUrl: config.baseUrl,
            model: config.model,
            note: "Configured state is not proof that the Ollama server is reachable; a real request verifies connectivity."
        };
    }

    return { generateText, getProviderStatus };
}

module.exports = { createOllamaTextProvider };
