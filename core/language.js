// ============================================================
// AARHEN CORE V5
// Multilingual Engine
// ============================================================

const LANGUAGES = {
    hindi: { name: "Hindi", code: "hi" },
    english: { name: "English", code: "en" },
    gujarati: { name: "Gujarati", code: "gu" },
    hinglish: { name: "Hinglish", code: "hi-en" }
};

const HINGLISH_WORDS = new Set([
    "hai", "hain", "haan", "kya", "kaise", "kaisa", "kaisi",
    "mujhe", "mujhko", "mera", "meri", "mere", "tum", "aap",
    "karna", "karo", "kare", "batao", "chahiye", "nahi", "nahin",
    "accha", "achha", "theek", "kyun", "kab", "kahan", "kaun",
    "ho", "hoga", "hogi", "raha", "rahi", "rahe", "kar", "aur"
]);

function tokenize(value) {
    return value.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
}

function detectLanguage(text) {
    const value = String(text ?? "");

    if (/[\u0A80-\u0AFF]/u.test(value)) {
        return "gujarati";
    }

    if (/[\u0900-\u097F]/u.test(value)) {
        return "hindi";
    }

    const tokens = tokenize(value);
    const score = tokens.reduce(
        (count, token) => count + (HINGLISH_WORDS.has(token) ? 1 : 0),
        0
    );

    return score >= 2 ? "hinglish" : "english";
}

function resolveLanguage(requestedLanguage, text) {
    const requested = String(requestedLanguage ?? "").trim().toLowerCase();

    if (requested && Object.prototype.hasOwnProperty.call(LANGUAGES, requested)) {
        return requested;
    }

    return detectLanguage(text);
}

function getLanguageInfo(language) {
    const key = String(language ?? "").trim().toLowerCase();
    return LANGUAGES[key] || LANGUAGES.english;
}

module.exports = {
    LANGUAGES,
    detectLanguage,
    resolveLanguage,
    getLanguageInfo
};
