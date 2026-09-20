// ============================================================
// AARHEN CORE V5
// Multilingual Engine
// ============================================================

const LANGUAGES = {
    hindi: {
        name: "Hindi",
        code: "hi"
    },

    english: {
        name: "English",
        code: "en"
    },

    gujarati: {
        name: "Gujarati",
        code: "gu"
    },

    hinglish: {
        name: "Hinglish",
        code: "hi-en"
    }
};

function detectLanguage(text) {

    const value = String(text);

    if (/[\u0A80-\u0AFF]/.test(value)) {
        return "gujarati";
    }

    if (/[\u0900-\u097F]/.test(value)) {
        return "hindi";
    }

    const hinglishWords = [
        "hai",
        "haan",
        "kya",
        "kaise",
        "mujhe",
        "mera",
        "meri",
        "karna",
        "karo",
        "batao",
        "chahiye",
        "nahi"
    ];

    const lower = value.toLowerCase();

    const score = hinglishWords.filter(word =>
        lower.includes(word)
    ).length;

    if (score >= 2) {
        return "hinglish";
    }

    return "english";
}

function resolveLanguage(requestedLanguage, text) {

    if (
        requestedLanguage &&
        LANGUAGES[requestedLanguage.toLowerCase()]
    ) {
        return requestedLanguage.toLowerCase();
    }

    return detectLanguage(text);
}

function getLanguageInfo(language) {

    return LANGUAGES[language] || LANGUAGES.english;
}

module.exports = {
    LANGUAGES,
    detectLanguage,
    resolveLanguage,
    getLanguageInfo
};
