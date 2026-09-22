// ============================================================
// AARHEN CORE V5
// ADVANCED WEB RESEARCH ENGINE
// ============================================================

const verification =
    require("../core/verification");

const learning =
    require("../core/learning");


// ============================================================
// CONSTANTS
// ============================================================

const RESEARCH_VERSION = "5.1.0";

const MIN_VERIFIED_SOURCES = 2;

const MIN_VERIFIED_CONFIDENCE = 0.80;

const MIN_PARTIAL_SOURCES = 1;

const MIN_PARTIAL_CONFIDENCE = 0.60;


// ============================================================
// NORMALIZE
// ============================================================

function normalize(value = "") {

    return String(value || "")
        .trim();
}


// ============================================================
// CLAMP
// ============================================================

function clamp(
    value,
    min = 0,
    max = 1
) {

    const number =
        Number(value);

    if (
        Number.isNaN(number)
    ) {

        return min;
    }

    return Math.max(
        min,
        Math.min(
            max,
            number
        )
    );
}


// ============================================================
// TEXT NORMALIZATION
// ============================================================

function normalizeText(
    value = ""
) {

    return normalize(value)
        .toLowerCase()
        .replace(
            /https?:\/\/\S+/g,
            " "
        )
        .replace(
            /[^a-z0-9\s]/g,
            " "
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();
}


// ============================================================
// TOKENIZE
// ============================================================

function tokenize(
    value = ""
) {

    const text =
        normalizeText(value);

    if (!text) {
        return [];
    }

    return text
        .split(" ")
        .filter(
            token =>
                token.length >= 4
        );
}


// ============================================================
// CREATE RESEARCH REQUEST
// ============================================================

function createResearchRequest({
    query,
    maxSources = 5,
    language = "auto"
} = {}) {

    const cleanQuery =
        normalize(query);

    if (!cleanQuery) {

        return {

            success: false,

            error:
                "Research query is required."
        };
    }

    const sourceLimit =
        Math.max(
            1,
            Math.min(
                Number(maxSources) || 5,
                20
            )
        );

    return {

        success: true,

        query:
            cleanQuery,

        maxSources:
            sourceLimit,

        language:
            language || "auto",

        providerRequired:
            true,

        verificationRequired:
            true,

        learningEnabled:
            true,

        verified:
            false,

        status:
            "research-request-created"
    };
}


// ============================================================
// VALIDATE SINGLE SOURCE
// ============================================================

function validateSource(
    source = {}
) {

    if (
        !source ||
        typeof source !== "object"
    ) {

        return {

            valid: false,

            reason:
                "Invalid source object."
        };
    }

    const title =
        normalize(
            source.title
        );

    const url =
        normalize(
            source.url
        );

    if (!title) {

        return {

            valid: false,

            reason:
                "Source title is missing."
        };
    }

    if (!url) {

        return {

            valid: false,

            reason:
                "Source URL is missing.",

            title
        };
    }

    return {

        valid: true,

        title,

        url,

        publisher:
            normalize(
                source.publisher
            ),

        publishedAt:
            source.publishedAt ||
            source.published_at ||
            null,

        retrievedAt:
            source.retrievedAt ||
            new Date().toISOString(),

        snippet:
            normalize(
                source.snippet
            ),

        content:
            normalize(
                source.content
            ),

        score:
            typeof source.score ===
            "number"

                ? source.score

                : null
    };
}


// ============================================================
// VALIDATE SOURCES
// ============================================================

function validateSources(
    sources = []
) {

    if (
        !Array.isArray(sources)
    ) {

        return [];
    }

    const validated =
        sources
            .map(
                validateSource
            )
            .filter(
                source =>
                    source.valid
            );


    const seen =
        new Set();


    return validated.filter(
        source => {

            const key =
                source.url
                    .toLowerCase()
                    .replace(
                        /\/$/,
                        ""
                    );

            if (
                seen.has(key)
            ) {

                return false;
            }

            seen.add(key);

            return true;
        }
    );
}


// ============================================================
// SOURCE TEXT
// ============================================================

function getSourceText(
    source = {}
) {

    return normalize(
        [
            source.title,
            source.snippet,
            source.content
        ]
            .filter(Boolean)
            .join(" ")
    );
}


// ============================================================
// SOURCE SIMILARITY
// ============================================================

function calculateSourceSimilarity(
    sourceA = {},
    sourceB = {}
) {

    const tokensA =
        new Set(
            tokenize(
                getSourceText(
                    sourceA
                )
            )
        );

    const tokensB =
        new Set(
            tokenize(
                getSourceText(
                    sourceB
                )
            )
        );

    if (
        tokensA.size === 0 ||
        tokensB.size === 0
    ) {

        return 0;
    }

    let intersection = 0;

    for (
        const token of tokensA
    ) {

        if (
            tokensB.has(token)
        ) {

            intersection++;
        }
    }

    const union =
        new Set([
            ...tokensA,
            ...tokensB
        ]).size;

    if (!union) {
        return 0;
    }

    return clamp(
        intersection / union
    );
}


// ============================================================
// CONFLICT SIGNALS
// ============================================================

const CONFLICT_PATTERNS = [

    /\bnot\b/i,

    /\bno\b/i,

    /\bnever\b/i,

    /\bfalse\b/i,

    /\bincorrect\b/i,

    /\bwrong\b/i,

    /\bdenied\b/i,

    /\bdenies\b/i,

    /\brefutes\b/i,

    /\brefuted\b/i,

    /\bcontrary\b/i,

    /\bunlike\b/i,

    /\bdifferent\b/i,

    /\bdispute\b/i,

    /\bdisputed\b/i,

    /\bcontroversial\b/i,

    /\bconflict\b/i,

    /\bconflicting\b/i
];


// ============================================================
// DETECT NUMERIC DIFFERENCES
// ============================================================

function extractNumbers(
    text = ""
) {

    return (
        normalize(text)
            .match(
                /\b\d+(?:\.\d+)?\b/g
            ) ||
        []
    ).map(
        Number
    );
}


// ============================================================
// COMPARE SOURCE PAIR
// ============================================================

function compareSourcePair(
    sourceA = {},
    sourceB = {}
) {

    const textA =
        getSourceText(
            sourceA
        );

    const textB =
        getSourceText(
            sourceB
        );


    const similarity =
        calculateSourceSimilarity(
            sourceA,
            sourceB
        );


    const numbersA =
        extractNumbers(
            textA
        );

    const numbersB =
        extractNumbers(
            textB
        );


    const numericDifference =
        numbersA.length > 0 &&
        numbersB.length > 0 &&
        numbersA.some(
            number =>
                !numbersB.includes(
                    number
                )
        ) &&
        numbersB.some(
            number =>
                !numbersA.includes(
                    number
                )
        );


    const conflictSignalA =
        CONFLICT_PATTERNS.some(
            pattern =>
                pattern.test(
                    textA
                )
        );


    const conflictSignalB =
        CONFLICT_PATTERNS.some(
            pattern =>
                pattern.test(
                    textB
                )
        );


    let relationship =
        "different";


    if (
        similarity >= 0.55
    ) {

        relationship =
            "supporting";

    } else if (
        similarity >= 0.25
    ) {

        relationship =
            "related";
    }


    // --------------------------------------------------------
    // Conservative conflict detection
    // --------------------------------------------------------

    const possibleConflict =
        numericDifference &&
        similarity >= 0.20;


    return {

        sourceA:
            sourceA.url,

        sourceB:
            sourceB.url,

        similarity:

            Number(
                similarity.toFixed(3)
            ),

        relationship,

        numericDifference,

        conflictSignals: {

            sourceA:
                conflictSignalA,

            sourceB:
                conflictSignalB
        },

        possibleConflict
    };
}


// ============================================================
// COMPARE ALL SOURCES
// ============================================================

function compareSources(
    sources = []
) {

    const validSources =
        validateSources(
            sources
        );


    const comparisons = [];

    let supportingPairs = 0;

    let relatedPairs = 0;

    let conflictPairs = 0;


    for (
        let i = 0;
        i < validSources.length;
        i++
    ) {

        for (
            let j = i + 1;
            j < validSources.length;
            j++
        ) {

            const comparison =
                compareSourcePair(
                    validSources[i],
                    validSources[j]
                );


            comparisons.push(
                comparison
            );


            if (
                comparison.relationship ===
                "supporting"
            ) {

                supportingPairs++;
            }


            if (
                comparison.relationship ===
                "related"
            ) {

                relatedPairs++;
            }


            if (
                comparison.possibleConflict
            ) {

                conflictPairs++;
            }
        }
    }


    return {

        success: true,

        sourceCount:
            validSources.length,

        comparisons,

        supportingPairs,

        relatedPairs,

        conflictPairs,

        conflictDetected:
            conflictPairs > 0,

        status:
            conflictPairs > 0
                ? "conflict-detected"
                : "sources-consistent"
    };
}


// ============================================================
// CREATE RESEARCH RESULT
// ============================================================

function createResearchResult({
    query,
    sources = [],
    summary = "",
    confidence = 0
} = {}) {

    const validSources =
        validateSources(
            sources
        );


    const comparison =
        compareSources(
            validSources
        );


    return {

        success: true,

        query:
            normalize(query),

        sources:
            validSources,

        sourceCount:
            validSources.length,

        summary:
            normalize(summary),

        confidence:
            clamp(confidence),

        comparison,

        conflictDetected:
            comparison.conflictDetected,

        verified:
            false,

        verificationStatus:
            "review",

        status:
            "research-result-created"
    };
}


// ============================================================
// BUILD RESEARCH CONTEXT
// ============================================================

function buildResearchContext(
    result = {}
) {

    if (
        !result ||
        !result.success
    ) {

        return {

            success: false,

            error:
                "Valid research result is required."
        };
    }


    const sources =
        validateSources(
            result.sources
        );


    const sourceText =
        sources
            .map(
                source =>
                    `${source.title} - ${source.url}`
            )
            .join("\n");


    const comparison =
        result.comparison ||
        compareSources(
            sources
        );


    return {

        success: true,

        query:
            normalize(result.query),

        summary:
            normalize(result.summary),

        sources:
            sourceText,

        sourceList:
            sources,

        sourceCount:
            sources.length,

        confidence:
            clamp(
                result.confidence
            ),

        verified:
            Boolean(
                result.verified
            ),

        verificationStatus:
            result.verificationStatus ||
            "review",

        comparison,

        conflictDetected:
            Boolean(
                result.conflictDetected ||
                comparison.conflictDetected
            )
    };
}


// ============================================================
// CALCULATE RESEARCH CONFIDENCE
// ============================================================

function calculateResearchConfidence({
    sources = [],
    confidence = 0,
    comparison = null
} = {}) {

    const validSources =
        validateSources(
            sources
        );


    if (
        validSources.length === 0
    ) {

        return 0;
    }


    const suppliedConfidence =
        clamp(
            confidence
        );


    let baseConfidence;


    if (
        suppliedConfidence > 0
    ) {

        baseConfidence =
            suppliedConfidence;

    } else if (
        validSources.length >= 5
    ) {

        baseConfidence =
            0.90;

    } else if (
        validSources.length >= 3
    ) {

        baseConfidence =
            0.82;

    } else if (
        validSources.length >= 2
    ) {

        baseConfidence =
            0.75;

    } else {

        baseConfidence =
            0.60;
    }


    const comparisonResult =
        comparison ||
        compareSources(
            validSources
        );


    // --------------------------------------------------------
    // Conflict penalty
    // --------------------------------------------------------

    if (
        comparisonResult.conflictDetected
    ) {

        const conflictCount =
            Number(
                comparisonResult.conflictPairs
            ) || 1;


        const penalty =
            Math.min(
                0.25,
                conflictCount * 0.10
            );


        baseConfidence =
            baseConfidence -
            penalty;
    }


    return clamp(
        baseConfidence
    );
}


// ============================================================
// VERIFY RESEARCH
// ============================================================

function verifyResearch({
    result,
    sourceCount,
    confidence,
    notes = ""
} = {}) {

    if (
        !result ||
        !result.success
    ) {

        return {

            success: false,

            error:
                "Research result is required."
        };
    }


    const actualSources =
        validateSources(
            result.sources || []
        );


    const count =
        Number(sourceCount) ||
        actualSources.length ||
        result.sourceCount ||
        0;


    const comparison =
        result.comparison ||
        compareSources(
            actualSources
        );


    const score =
        typeof confidence ===
        "number"

            ? clamp(confidence)

            : calculateResearchConfidence({

                sources:
                    actualSources,

                confidence:
                    result.confidence,

                comparison
            });


    let status =
        "review";


    // --------------------------------------------------------
    // Conflicting evidence
    // --------------------------------------------------------

    if (
        comparison.conflictDetected
    ) {

        status =
            "review";

    } else if (
        count >= MIN_VERIFIED_SOURCES &&
        score >= MIN_VERIFIED_CONFIDENCE
    ) {

        status =
            "verified";

    } else if (
        count >= MIN_PARTIAL_SOURCES &&
        score >= MIN_PARTIAL_CONFIDENCE
    ) {

        status =
            "partially-verified";
    }


    return {

        success: true,

        query:
            normalize(
                result.query
            ),

        sourceCount:
            count,

        confidence:
            score,

        verificationStatus:
            status,

        verificationNotes:
            normalize(notes),

        verified:
            status === "verified",

        conflictDetected:
            Boolean(
                comparison.conflictDetected
            ),

        comparison,

        verifiedAt:
            new Date().toISOString()
    };
}


// ============================================================
// VERIFY WITH VERIFICATION ENGINE
// ============================================================

function verifyWithEngine({
    memoryId,
    sourceCount,
    confidence,
    notes = "",
    evidence = [],
    conflictDetected = false
} = {}) {

    if (!memoryId) {

        return {

            success: false,

            error:
                "Memory ID is required."
        };
    }


    try {

        return verification.verifyMemory({

            memoryId,

            verifiedBy:
                "AarHen Web Research Engine",

            sourceCount:
                Number(sourceCount) || 0,

            confidence:
                clamp(confidence),

            notes:
                notes ||
                "Verified through web research.",

            evidence:
                Array.isArray(evidence)
                    ? evidence
                    : [],

            conflictDetected:
                Boolean(
                    conflictDetected
                )
        });

    } catch (error) {

        return {

            success: false,

            error:
                error.message
        };
    }
}


// ============================================================
// BUILD LEARNING CONTENT
// ============================================================

function buildLearningContent({
    summary = "",
    sources = [],
    comparison = null
} = {}) {

    const cleanSummary =
        normalize(summary);


    const validSources =
        validateSources(
            sources
        );


    if (
        !cleanSummary
    ) {

        return "";
    }


    const sourceText =
        validSources
            .map(
                source =>
                    `${source.title}: ${source.url}`
            )
            .join("\n");


    const comparisonResult =
        comparison ||
        compareSources(
            validSources
        );


    let comparisonText =
        "";


    if (
        comparisonResult.conflictDetected
    ) {

        comparisonText =
            "\n\nResearch comparison: Conflicting evidence detected. Further verification is required.";

    } else {

        comparisonText =
            "\n\nResearch comparison: Sources were cross-checked and no basic conflict signal was detected.";
    }


    if (!sourceText) {

        return (
            cleanSummary +
            comparisonText
        );
    }


    return (

        `${cleanSummary}\n\n` +

        `Sources:\n` +

        sourceText +

        comparisonText
    );
}


// ============================================================
// LEARN VERIFIED RESEARCH
// ============================================================

function learnVerifiedResearch({
    title = "Web Research",
    query,
    summary,
    sources = [],
    category = "research",
    confidence = 0,
    notes = ""
} = {}) {

    const cleanQuery =
        normalize(query);


    const cleanSummary =
        normalize(summary);


    const validSources =
        validateSources(
            sources
        );


    if (!cleanQuery) {

        return {

            success: false,

            error:
                "Research query is required."
        };
    }


    if (
        cleanSummary.length < 10
    ) {

        return {

            success: false,

            error:
                "Research summary is too short."
        };
    }


    if (
        validSources.length === 0
    ) {

        return {

            success: false,

            error:
                "At least one valid research source is required."
        };
    }


    // --------------------------------------------------------
    // SOURCE COMPARISON
    // --------------------------------------------------------

    const comparison =
        compareSources(
            validSources
        );


    // --------------------------------------------------------
    // RESEARCH RESULT
    // --------------------------------------------------------

    const researchResult =
        createResearchResult({

            query:
                cleanQuery,

            sources:
                validSources,

            summary:
                cleanSummary,

            confidence:
                clamp(confidence)
        });


    // --------------------------------------------------------
    // VERIFY
    // --------------------------------------------------------

    const verificationResult =
        verifyResearch({

            result:
                researchResult,

            sourceCount:
                validSources.length,

            confidence:
                calculateResearchConfidence({

                    sources:
                        validSources,

                    confidence:
                        confidence,

                    comparison
                }),

            notes
        });


    // --------------------------------------------------------
    // DO NOT LEARN UNVERIFIED RESEARCH
    // --------------------------------------------------------

    if (
        !verificationResult.verified
    ) {

        return {

            success: false,

            query:
                cleanQuery,

            verification:
                verificationResult,

            comparison,

            status:
                comparison.conflictDetected
                    ? "conflicting-research"
                    : "verification-required",

            message:
                comparison.conflictDetected

                    ? "Conflicting research evidence detected. AarHen will not store this as verified knowledge until the information is resolved."

                    : "Research cannot be stored as verified knowledge until verification requirements are met."
        };
    }


    // --------------------------------------------------------
    // BUILD KNOWLEDGE
    // --------------------------------------------------------

    const content =
        buildLearningContent({

            summary:
                cleanSummary,

            sources:
                validSources,

            comparison
        });


    // --------------------------------------------------------
    // LEARN
    // --------------------------------------------------------

    const learned =
        learning.learnVerified({

            title,

            content,

            category,

            source:
                "web-research",

            confidence:
                verificationResult.confidence,

            approved:
                true,

            verified:
                true,

            storeMemory:
                true
        });


    if (
        !learned ||
        !learned.success
    ) {

        return {

            success: false,

            query:
                cleanQuery,

            verification:
                verificationResult,

            comparison,

            learning:
                learned,

            status:
                "learning-failed"
        };
    }


    // --------------------------------------------------------
    // FINAL RESULT
    // --------------------------------------------------------

    return {

        success: true,

        query:
            cleanQuery,

        verification:
            verificationResult,

        comparison,

        learning:
            learned,

        memoryId:
            learned.memoryId ||
            null,

        sourceCount:
            validSources.length,

        confidence:
            verificationResult.confidence,

        conflictDetected:
            comparison.conflictDetected,

        status:
            "verified-research-learned"
    };
}


// ============================================================
// RESEARCH → VERIFY → LEARN PIPELINE
// ============================================================

function processResearchResult({
    result,
    title = "Web Research",
    category = "research",
    notes = ""
} = {}) {

    if (
        !result ||
        !result.success
    ) {

        return {

            success: false,

            error:
                "Valid research result is required."
        };
    }


    return learnVerifiedResearch({

        title,

        query:
            result.query,

        summary:
            result.summary,

        sources:
            result.sources,

        category,

        confidence:
            result.confidence,

        notes
    });
}


// ============================================================
// RESEARCH STATUS
// ============================================================

function getResearchStatus() {

    return {

        success: true,

        engine:
            "AarHen Advanced Web Research Engine",

        version:
            RESEARCH_VERSION,

        status:
            "provider-ready",

        internetAccess:
            false,

        providerRequired:
            true,

        verificationRequired:
            true,

        automaticLearning:
            true,

        learningRequiresVerification:
            true,

        sourceComparison:
            true,

        contradictionDetection:
            true,

        conflictAwareConfidence:
            true,

        minimumVerifiedSources:
            MIN_VERIFIED_SOURCES,

        minimumVerifiedConfidence:
            MIN_VERIFIED_CONFIDENCE,

        pipeline: [

            "research",

            "validate-sources",

            "compare",

            "detect-conflicts",

            "calculate-confidence",

            "verify",

            "learn",

            "memory-storage",

            "future-recall"
        ]
    };
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    createResearchRequest,

    createResearchResult,

    validateSource,

    validateSources,

    buildResearchContext,

    calculateResearchConfidence,

    compareSourcePair,

    compareSources,

    verifyResearch,

    verifyWithEngine,

    buildLearningContent,

    learnVerifiedResearch,

    processResearchResult,

    getResearchStatus
};
