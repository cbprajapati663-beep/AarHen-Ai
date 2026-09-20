// ============================================================
// AARHEN CORE V5
// Permission & Safety Brain
// ============================================================

const POLICY = {

    // Safe actions
    read_public_information: "ALLOW",
    learn_from_user_material: "ALLOW",
    calculate: "ALLOW",
    save_memory: "ALLOW",
    search_knowledge: "ALLOW",

    // Actions that need user approval
    write_file: "ASK",
    delete_file: "ASK",
    send_message: "ASK",
    send_email: "ASK",
    post_online: "ASK",
    purchase: "ASK",
    login: "ASK",
    install_software: "ASK",
    change_system_settings: "ASK",

    // External execution
    execute_external_code: "ASK",

    // Cybersecurity
    security_testing_against_external_target: "ASK"
};


// Check permission for an action
function check(action) {

    const policy = POLICY[action] || "ASK";

    return {
        action,
        policy,
        requiresApproval: policy === "ASK"
    };
}


// Get complete permission policy
function getPolicy() {
    return POLICY;
}


// Check whether action is directly allowed
function isAllowed(action) {
    return POLICY[action] === "ALLOW";
}


// Check whether action requires user approval
function requiresApproval(action) {
    return POLICY[action] === "ASK";
}


module.exports = {
    POLICY,
    check,
    getPolicy,
    isAllowed,
    requiresApproval
};
