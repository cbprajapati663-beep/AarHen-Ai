// ============================================================
// AARHEN CORE V5
// CYBERSECURITY LEARNING BRAIN
// ============================================================

const SAFE_TOPICS = [
    "cybersecurity fundamentals",
    "network security",
    "web security",
    "secure coding",
    "authentication",
    "authorization",
    "encryption",
    "privacy",
    "malware analysis",
    "incident response",
    "vulnerability management",
    "security monitoring",
    "owasp",
    "penetration testing",
    "ctf",
    "security labs"
];

const RISKY_ACTIONS = [
    "external_target_testing",
    "credential_attack",
    "unauthorized_access",
    "malware_deployment",
    "persistence",
    "evasion",
    "data_exfiltration",
    "destructive_action"
];


// ------------------------------------------------------------
// Classify cybersecurity request
// ------------------------------------------------------------

function classifyRequest(request) {

    const text = String(request || "")
        .toLowerCase()
        .trim();

    if (!text) {
        return {
            success: false,
            error: "Cybersecurity request is empty."
        };
    }


    const matchedTopics = SAFE_TOPICS.filter(topic =>
        text.includes(topic)
    );


    const matchedRisks = RISKY_ACTIONS.filter(action =>
        text.includes(action.replace(/_/g, " "))
    );


    let category = "general-security";

    if (matchedRisks.length > 0) {
        category = "restricted-security-action";
    }
    else if (matchedTopics.length > 0) {
        category = "defensive-security-learning";
    }


    return {

        success: true,

        category,

        matchedTopics,

        matchedRisks,

        requiresApproval:
            matchedRisks.length > 0

    };
}


// ------------------------------------------------------------
// Create cybersecurity learning task
// ------------------------------------------------------------

function createLearningTask({
    topic = "",
    goal = "",
    authorized = false
} = {}) {

    if (!topic.trim()) {
        return {
            success: false,
            error: "Security topic is required."
        };
    }


    return {

        success: true,

        topic,

        goal,

        authorized: Boolean(authorized),

        mode: authorized
            ? "authorized-lab"
            : "learning-only",

        status: "created",

        externalExecution:
            false

    };
}


// ------------------------------------------------------------
// Security checklist
// ------------------------------------------------------------

function getSecurityChecklist() {

    return [

        "Use strong authentication",

        "Apply least-privilege access",

        "Keep software updated",

        "Protect secrets and API keys",

        "Validate user input",

        "Use secure password handling",

        "Enable logging and monitoring",

        "Back up important data",

        "Review permissions regularly",

        "Test only systems you are authorized to test"

    ];
}


// ------------------------------------------------------------
// Check whether external testing needs approval
// ------------------------------------------------------------

function checkExternalTesting(target) {

    if (!target || !String(target).trim()) {

        return {
            success: false,
            error: "Target is required."
        };
    }


    return {

        success: true,

        target: String(target),

        action:
            "security_testing_against_external_target",

        requiresApproval: true,

        status:
            "awaiting-user-authorization",

        message:
            "External security testing requires explicit authorization."

    };
}


// ------------------------------------------------------------
// Module exports
// ------------------------------------------------------------

module.exports = {

    SAFE_TOPICS,

    RISKY_ACTIONS,

    classifyRequest,

    createLearningTask,

    getSecurityChecklist,

    checkExternalTesting

};
