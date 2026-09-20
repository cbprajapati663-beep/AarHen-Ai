// ============================================================
// AARHEN CORE V5
// SKILL REGISTRY
// ============================================================

const skills = {};


// ------------------------------------------------------------
// Register a skill
// ------------------------------------------------------------

function registerSkill({
    name,
    description = "",
    category = "general",
    handler = null
} = {}) {

    if (!name || String(name).trim() === "") {
        return {
            success: false,
            error: "Skill name is required."
        };
    }

    const id = String(name)
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-");


    skills[id] = {

        id,

        name: String(name),

        description,

        category,

        handler,

        enabled: true,

        createdAt:
            new Date().toISOString()

    };


    return {
        success: true,
        skill: skills[id]
    };
}


// ------------------------------------------------------------
// Get a skill
// ------------------------------------------------------------

function getSkill(id) {

    return skills[id] || null;
}


// ------------------------------------------------------------
// Get all skills
// ------------------------------------------------------------

function getAllSkills() {

    return Object.values(skills);
}


// ------------------------------------------------------------
// Enable skill
// ------------------------------------------------------------

function enableSkill(id) {

    if (!skills[id]) {
        return {
            success: false,
            error: "Skill not found."
        };
    }

    skills[id].enabled = true;

    return {
        success: true,
        skill: skills[id]
    };
}


// ------------------------------------------------------------
// Disable skill
// ------------------------------------------------------------

function disableSkill(id) {

    if (!skills[id]) {
        return {
            success: false,
            error: "Skill not found."
        };
    }

    skills[id].enabled = false;

    return {
        success: true,
        skill: skills[id]
    };
}


// ------------------------------------------------------------
// Check whether skill is enabled
// ------------------------------------------------------------

function isEnabled(id) {

    return Boolean(
        skills[id] &&
        skills[id].enabled
    );
}


// ------------------------------------------------------------
// Remove skill
// ------------------------------------------------------------

function removeSkill(id) {

    if (!skills[id]) {
        return {
            success: false,
            error: "Skill not found."
        };
    }

    delete skills[id];

    return {
        success: true,
        removed: id
    };
}


// ------------------------------------------------------------
// Module exports
// ------------------------------------------------------------

module.exports = {

    registerSkill,

    getSkill,

    getAllSkills,

    enableSkill,

    disableSkill,

    isEnabled,

    removeSkill

};
