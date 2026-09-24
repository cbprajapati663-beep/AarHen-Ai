// ============================================================
// AARHEN CORE V5
// AUTONOMOUS SAFETY GUARD
// ============================================================
// Version: 5.11.0
//
// Purpose:
// - Central safety gate for autonomous execution
// - Owner identity support
// - Emergency STOP control
// - Permission checking
// - Protected-action detection
// - Safe execution decision
//
// IMPORTANT:
// - This layer does not execute actions.
// - This layer does not bypass Permission Brain.
// - STOP state blocks autonomous execution.
// - Owner identity here is a logical application-level identity.
// - Real authentication / biometric verification will be added
//   in a later security layer.
// ============================================================


const permissions =
    require("./permissions");


// ============================================================
// VERSION
// ============================================================

const AUTONOMOUS_GUARD_VERSION =
    "5.11.0";


// ============================================================
// INTERNAL STATE
// ============================================================

const state = {

    configured:
        false,

    ownerId:
        null,

    stopActive:
        false,

    stopReason:
        null,

    stoppedAt:
        null,

    stoppedBy:
        null

};


// ============================================================
// PROTECTED ACTIONS
// ============================================================

const PROTECTED_ACTIONS =
    Object.freeze([

        "write_file",
        "delete_file",
        "send_message",
        "send_email",
        "post_online",
        "purchase",
        "login",
        "install_software",
        "change_system_settings",
        "execute_external_code",
        "security_testing_against_external_target"

    ]);


// ============================================================
// HELPERS
// ============================================================

function safeString(
    value
) {

    return String(
        value ?? ""
    ).trim();

}


function safeObject(
    value
) {

    return (
        value &&
        typeof value === "object"
    )
        ? value
        : {};

}


function clone(
    value
) {

    if (
        value === undefined
    ) {

        return undefined;

    }


    try {

        return JSON.parse(
            JSON.stringify(
                value
            )
        );

    } catch {

        return value;

    }

}


function now() {

    return new Date()
        .toISOString();

}


// ============================================================
// OWNER CONFIGURATION
// ============================================================
//
// This sets the logical owner identity used by the safety
// layer. It is NOT a password and NOT cryptographic
// authentication.
//
// ============================================================

function configureOwner(
    ownerId
) {

    const normalizedOwnerId =
        safeString(
            ownerId
        );


    if (
        !normalizedOwnerId
    ) {

        return {

            success:
                false,

            error:
                "Owner ID is required."

        };

    }


    state.ownerId =
        normalizedOwnerId;

    state.configured =
        true;


    return {

        success:
            true,

        ownerConfigured:
            true,

        ownerId:
            normalizedOwnerId,

        version:
            AUTONOMOUS_GUARD_VERSION

    };

}


// ============================================================
// GET OWNER
// ============================================================

function getOwner() {

    return {

        success:
            true,

        configured:
            state.configured,

        ownerId:
            state.ownerId,

        version:
            AUTONOMOUS_GUARD_VERSION

    };

}


// ============================================================
// OWNER AUTHORIZATION
// ============================================================

function authorizeOwner(
    ownerId
) {

    const suppliedOwnerId =
        safeString(
            ownerId
        );


    if (
        !state.configured ||
        !state.ownerId
    ) {

        return {

            success:
                false,

            authorized:
                false,

            reason:
                "Owner identity is not configured."

        };

    }


    const authorized =
        suppliedOwnerId ===
        state.ownerId;


    return {

        success:
            authorized,

        authorized,

        reason:
            authorized

                ? "Owner identity authorized."

                : "Owner identity mismatch."

    };

}


// ============================================================
// STOP STATUS
// ============================================================

function isStopped() {

    return (
        state.stopActive ===
        true
    );

}


// ============================================================
// ACTIVATE EMERGENCY STOP
// ============================================================

function activateStop(
    reason = "Emergency STOP activated.",
    ownerId = null
) {

    const normalizedOwnerId =
        safeString(
            ownerId
        );


    // --------------------------------------------------------
    // If an owner is configured, STOP must come from owner.
    // --------------------------------------------------------

    if (
        state.configured
    ) {

        const authorization =
            authorizeOwner(
                normalizedOwnerId
            );


        if (
            authorization.authorized !==
            true
        ) {

            return {

                success:
                    false,

                stopped:
                    state.stopActive,

                authorized:
                    false,

                error:
                    "Owner authorization required to activate STOP.",

                authorization

            };

        }

    }


    state.stopActive =
        true;

    state.stopReason =
        safeString(
            reason
        ) ||
        "Emergency STOP activated.";

    state.stoppedAt =
        now();

    state.stoppedBy =
        normalizedOwnerId ||
        null;


    return {

        success:
            true,

        stopped:
            true,

        stopActive:
            true,

        reason:
            state.stopReason,

        stoppedAt:
            state.stoppedAt,

        stoppedBy:
            state.stoppedBy,

        version:
            AUTONOMOUS_GUARD_VERSION

    };

}


// ============================================================
// CLEAR EMERGENCY STOP
// ============================================================
//
// Clearing STOP also requires owner authorization when an
// owner identity is configured.
// ============================================================

function clearStop(
    ownerId = null
) {

    const normalizedOwnerId =
        safeString(
            ownerId
        );


    if (
        state.configured
    ) {

        const authorization =
            authorizeOwner(
                normalizedOwnerId
            );


        if (
            authorization.authorized !==
            true
        ) {

            return {

                success:
                    false,

                stopped:
                    state.stopActive,

                authorized:
                    false,

                error:
                    "Owner authorization required to clear STOP.",

                authorization

            };

        }

    }


    state.stopActive =
        false;

    state.stopReason =
        null;

    state.stoppedAt =
        null;

    state.stoppedBy =
        null;


    return {

        success:
            true,

        stopped:
            false,

        stopActive:
            false,

        status:
            "stop-cleared",

        version:
            AUTONOMOUS_GUARD_VERSION

    };

}


// ============================================================
// CHECK ACTION PERMISSION
// ============================================================

function checkPermission(
    action
) {

    const normalizedAction =
        safeString(
            action
        );


    if (
        !normalizedAction
    ) {

        return {

            success:
                false,

            action:
                "",

            error:
                "Action is required."

        };

    }


    const permission =
        permissions.check(
            normalizedAction
        );


    const protectedAction =
        PROTECTED_ACTIONS.includes(
            normalizedAction
        );


    return {

        success:
            true,

        action:
            normalizedAction,

        policy:
            permission.policy,

        allowed:
            permission.policy ===
            "ALLOW",

        requiresApproval:
            permission.requiresApproval ===
            true,

        protected:
            protectedAction

    };

}


// ============================================================
// AUTONOMOUS EXECUTION GATE
// ============================================================
//
// This function does not execute anything.
//
// It only decides whether the execution layer may continue.
// ============================================================

function canExecute(
    action,
    context = {}
) {

    const normalizedAction =
        safeString(
            action
        );


    const config =
        safeObject(
            context
        );


    // --------------------------------------------------------
    // STOP CHECK
    // --------------------------------------------------------

    if (
        state.stopActive
    ) {

        return {

            success:
                true,

            allowed:
                false,

            blocked:
                true,

            reason:
                "Autonomous execution is blocked by emergency STOP.",

            stopActive:
                true,

            action:
                normalizedAction

        };

    }


    // --------------------------------------------------------
    // PERMISSION CHECK
    // --------------------------------------------------------

    const permission =
        checkPermission(
            normalizedAction
        );


    if (
        !permission.success
    ) {

        return permission;

    }


    // --------------------------------------------------------
    // PROTECTED ACTION
    // --------------------------------------------------------

    if (
        permission.protected
    ) {

        const approved =
            config.approved ===
            true;


        if (
            !approved
        ) {

            return {

                success:
                    true,

                allowed:
                    false,

                blocked:
                    true,

                requiresApproval:
                    true,

                protected:
                    true,

                action:
                    normalizedAction,

                policy:
                    permission.policy,

                reason:
                    "Protected autonomous action requires explicit approval."

            };

        }

    }


    // --------------------------------------------------------
    // ASK POLICY
    // --------------------------------------------------------

    if (
        permission.requiresApproval &&
        config.approved !==
        true
    ) {

        return {

            success:
                true,

            allowed:
                false,

            blocked:
                true,

            requiresApproval:
                true,

            protected:
                permission.protected,

            action:
                normalizedAction,

            policy:
                permission.policy,

            reason:
                "Permission policy requires approval."

        };

    }


    // --------------------------------------------------------
    // ALLOWED
    // --------------------------------------------------------

    return {

        success:
            true,

        allowed:
            true,

        blocked:
            false,

        requiresApproval:
            false,

        protected:
            permission.protected,

        action:
            normalizedAction,

        policy:
            permission.policy,

        stopActive:
            false,

        reason:
            "Autonomous execution is permitted."

    };

}


// ============================================================
// REQUIRE OWNER FOR CONTROL ACTION
// ============================================================
//
// Used for future sensitive controls such as STOP, recovery,
// background execution and system configuration.
// ============================================================

function requireOwner(
    ownerId
) {

    if (
        !state.configured
    ) {

        return {

            success:
                false,

            authorized:
                false,

            error:
                "Owner identity is not configured."

        };

    }


    return authorizeOwner(
        ownerId
    );

}


// ============================================================
// GET STATUS
// ============================================================

function getStatus() {

    return {

        success:
            true,

        version:
            AUTONOMOUS_GUARD_VERSION,

        status:
            "active",

        owner: {

            configured:
                state.configured,

            ownerId:
                state.ownerId

        },

        stop: {

            active:
                state.stopActive,

            reason:
                state.stopReason,

            stoppedAt:
                state.stoppedAt,

            stoppedBy:
                state.stoppedBy

        },

        protectedActions:
            [
                ...PROTECTED_ACTIONS
            ],

        permissionBrainConnected:
            Boolean(
                permissions &&
                typeof permissions.check ===
                "function"
            ),

        mode:
            "controlled"

    };

}


// ============================================================
// RESET
// ============================================================
//
// Reset is primarily for test/runtime initialization.
//
// ============================================================

function reset() {

    state.configured =
        false;

    state.ownerId =
        null;

    state.stopActive =
        false;

    state.stopReason =
        null;

    state.stoppedAt =
        null;

    state.stoppedBy =
        null;


    return {

        success:
            true,

        status:
            "autonomous-guard-reset",

        version:
            AUTONOMOUS_GUARD_VERSION

    };

}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    AUTONOMOUS_GUARD_VERSION,

    PROTECTED_ACTIONS,

    configureOwner,

    getOwner,

    authorizeOwner,

    requireOwner,

    isStopped,

    activateStop,

    clearStop,

    checkPermission,

    canExecute,

    getStatus,

    reset

};
