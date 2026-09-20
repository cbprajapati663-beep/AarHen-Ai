// ============================================================
// AARHEN CORE V5
// SKILL ROUTER
// ============================================================

const registry = require("./registry");


// ------------------------------------------------------------
// Default skill definitions
// ------------------------------------------------------------

const DEFAULT_SKILLS = [

    {
        name: "Finance",
        description: "Vehicle finance and EMI related tasks",
        category: "finance",
        keywords: [
            "loan",
            "emi",
            "interest",
            "finance",
            "refinance",
            "vehicle loan"
        ]
    },

    {
        name: "Calculator",
        description: "Mathematical calculations",
        category: "calculation",
        keywords: [
            "calculate",
            "calculator",
            "plus",
            "minus",
            "multiply",
            "divide",
            "percentage",
            "average"
        ]
    },

    {
        name: "Knowledge",
        description: "Search saved knowledge",
        category: "knowledge",
        keywords: [
            "knowledge",
            "remembered",
            "learned",
            "information",
            "what do you know"
        ]
    },

    {
        name: "Research",
        description: "Web research requests",
        category: "research",
        keywords: [
            "search",
            "research",
            "latest",
            "news",
            "internet",
            "online",
            "find information"
        ]
    },

    {
        name: "Coding",
        description: "Programming and code related tasks",
        category: "coding",
        keywords: [
            "code",
            "coding",
            "javascript",
            "python",
            "html",
            "css",
            "program",
            "debug"
        ]
    },

    {
        name: "Cybersecurity",
        description: "Defensive cybersecurity learning",
        category: "security",
        keywords: [
            "cybersecurity",
            "security",
            "owasp",
            "secure coding",
            "network security",
            "vulnerability"
        ]
    },

    {
        name: "Data Analysis",
        description: "Analyze datasets and business data",
        category: "data",
        keywords: [
            "data analysis",
            "excel",
            "csv",
            "dataset",
            "data",
            "statistics",
            "report"
        ]
    },

    {
        name: "Documents",
        description: "Read and learn from documents",
        category: "documents",
        keywords: [
            "pdf",
            "document",
            "docx",
            "file",
            "read document"
        ]
    },

    {
        name: "Heritage Business",
        description: "Heritage Auto Finance business tasks",
        category: "business",
        keywords: [
            "heritage",
            "auto finance",
            "used car finance",
            "new car finance",
            "commercial vehicle",
            "vehicle insurance",
            "customer lead"
        ]
    }

];


// ------------------------------------------------------------
// Register default skills
// ------------------------------------------------------------

function initializeSkills() {

    for (const skill of DEFAULT_SKILLS) {

        const id =
            skill.name
                .toLowerCase()
                .replace(/\s+/g, "-");


        if (!registry.getSkill(id)) {

            registry.registerSkill({

                name: skill.name,

                description:
                    skill.description,

                category:
                    skill.category

            });
        }
    }


    return registry.getAllSkills();
}


// ------------------------------------------------------------
// Calculate skill score
// ------------------------------------------------------------

function calculateSkillScore(text, skill) {

    const value =
        String(text || "").toLowerCase();

    let score = 0;

    for (const keyword of skill.keywords || []) {

        if (value.includes(keyword.toLowerCase())) {
            score++;
        }
    }

    return score;
}


// ------------------------------------------------------------
// Route request
// ------------------------------------------------------------

function route(request) {

    const text =
        String(request || "").trim();


    if (!text) {

        return {
            success: false,
            error: "Request is empty."
        };
    }


    initializeSkills();


    const definitions =
        DEFAULT_SKILLS;


    const matches =
        definitions
            .map(definition => {

                const id =
                    definition.name
                        .toLowerCase()
                        .replace(/\s+/g, "-");


                const registered =
                    registry.getSkill(id);


                return {

                    id,

                    name:
                        definition.name,

                    category:
                        definition.category,

                    score:
                        calculateSkillScore(
                            text,
                            definition
                        ),

                    enabled:
                        registered
                            ? registered.enabled
                            : false

                };

            })
            .filter(skill =>
                skill.score > 0 &&
                skill.enabled
            )
            .sort(
                (a, b) =>
                    b.score - a.score
            );


    const selected =
        matches.length > 0
            ? matches[0]
            : null;


    return {

        success: true,

        request: text,

        selectedSkill:
            selected,

        matches,

        status:
            selected
                ? "skill-selected"
                : "no-specific-skill"

    };
}


// ------------------------------------------------------------
// Module exports
// ------------------------------------------------------------

module.exports = {

    DEFAULT_SKILLS,

    initializeSkills,

    calculateSkillScore,

    route

};
