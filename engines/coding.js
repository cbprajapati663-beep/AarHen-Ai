// ============================================================
// AARHEN CORE V5
// CODING BRAIN
// ============================================================


// ------------------------------------------------------------
// Detect programming language
// ------------------------------------------------------------

function detectLanguage(code) {

    const text = String(code || "");

    if (
        text.includes("const ") ||
        text.includes("let ") ||
        text.includes("require(") ||
        text.includes("=>")
    ) {
        return "javascript";
    }

    if (
        text.includes("def ") ||
        text.includes("import ") ||
        text.includes("print(")
    ) {
        return "python";
    }

    if (
        text.includes("<html") ||
        text.includes("<div") ||
        text.includes("<body")
    ) {
        return "html";
    }

    if (
        text.includes("SELECT ") ||
        text.includes("INSERT ") ||
        text.includes("UPDATE ")
    ) {
        return "sql";
    }

    if (
        text.includes("public static void main") ||
        text.includes("System.out.println")
    ) {
        return "java";
    }

    return "unknown";
}


// ------------------------------------------------------------
// Detect basic code type
// ------------------------------------------------------------

function detectCodeType(code) {

    const text = String(code || "")
        .toLowerCase();


    if (
        text.includes("function ") ||
        text.includes("def ") ||
        text.includes("=>")
    ) {
        return "function";
    }


    if (
        text.includes("class ")
    ) {
        return "class";
    }


    if (
        text.includes("<html") ||
        text.includes("<div")
    ) {
        return "webpage";
    }


    if (
        text.includes("select ") ||
        text.includes("insert ") ||
        text.includes("update ")
    ) {
        return "database-query";
    }


    return "general-code";
}


// ------------------------------------------------------------
// Basic code analysis
// ------------------------------------------------------------

function analyzeCode(code) {

    const text = String(code || "");

    if (!text.trim()) {
        return {
            success: false,
            error: "Code is empty."
        };
    }


    const language =
        detectLanguage(text);

    const codeType =
        detectCodeType(text);


    const lines =
        text.split("\n").length;


    const characters =
        text.length;


    const warnings = [];


    // Basic warning checks

    if (
        text.includes("eval(")
    ) {
        warnings.push(
            "eval() detected. Review carefully before execution."
        );
    }


    if (
        text.includes("child_process")
    ) {
        warnings.push(
            "System command execution capability detected."
        );
    }


    if (
        text.includes("password")
    ) {
        warnings.push(
            "Possible credential-related data detected."
        );
    }


    if (
        text.includes("api_key") ||
        text.includes("apikey") ||
        text.includes("secret")
    ) {
        warnings.push(
            "Possible secret/API credential detected."
        );
    }


    return {

        success: true,

        language,

        codeType,

        lines,

        characters,

        warnings,

        warningCount:
            warnings.length

    };
}


// ------------------------------------------------------------
// Create coding task
// ------------------------------------------------------------

function createTask({
    task = "",
    language = "unknown",
    goal = ""
} = {}) {

    if (!task.trim()) {
        return {
            success: false,
            error: "Coding task is required."
        };
    }


    return {

        success: true,

        task,

        language,

        goal,

        status: "created",

        requiresExecutionApproval: true

    };
}


// ------------------------------------------------------------
// Explain code structure
// ------------------------------------------------------------

function explainStructure(code) {

    const analysis =
        analyzeCode(code);


    if (!analysis.success) {
        return analysis;
    }


    return {

        success: true,

        summary:
            `Detected ${analysis.language} ${analysis.codeType}.`,

        language:
            analysis.language,

        codeType:
            analysis.codeType,

        lines:
            analysis.lines,

        warnings:
            analysis.warnings

    };
}


// ------------------------------------------------------------
// Module exports
// ------------------------------------------------------------

module.exports = {

    detectLanguage,

    detectCodeType,

    analyzeCode,

    createTask,

    explainStructure

};
