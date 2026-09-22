// ============================================================
// AARHEN CORE V5
// ADVANCED WEB RESEARCH ENGINE
// ============================================================
// VERSION: 5.5.0
// FEATURES:
// - Web Research Result Processing
// - Source Validation
// - Duplicate Source Removal
// - Source Comparison
// - Conflict Detection
// - Conflict-Aware Confidence
// - Claim Extraction
// - Evidence Mapping
// - Claim Confidence
// - Evidence Strength
// - Source Quality Scoring
// - Source Authority Classification
// - Source Freshness Scoring
// - Authority-Aware Research Confidence
// - Verified Learning
// - Claim Provenance
// - Evidence Traceability
// - Source-to-Claim Linking
// - Claim Provenance Summary
// - Source Independence Scoring
// - Duplicate Source Detection
// - Related Source Detection
// - Source Diversity Scoring
// - Independent Domain Tracking
// ============================================================

const verification =
    require("../core/verification");

const learning =
    require("../core/learning");


// ============================================================
// CONSTANTS
// ============================================================

const RESEARCH_VERSION = "5.5.0";

const MIN_VERIFIED_SOURCES = 2;

const MIN_VERIFIED_CONFIDENCE = 0.80;

const MIN_PARTIAL_SOURCES = 1;

const MIN_PARTIAL_CONFIDENCE = 0.60;

const MIN_CLAIM_CONFIDENCE = 0.60;

const HIGH_EVIDENCE_SCORE = 0.75;

const MEDIUM_EVIDENCE_SCORE = 0.50;


// ============================================================
// SOURCE QUALITY CONSTANTS
// ============================================================

const AUTHORITY_WEIGHTS = {

    official: 1.00,

    government: 1.00,

    educational: 0.90,

    research: 0.95,

    majorNews: 0.85,

    establishedOrganization: 0.80,

    general: 0.50,

    unknown: 0.35
};


const FRESHNESS_WEIGHTS = {

    veryFresh: 1.00,

    fresh: 0.90,

    recent: 0.75,

    old: 0.55,

    stale: 0.35,

    unknown: 0.50
};


// ============================================================
// SOURCE INDEPENDENCE CONSTANTS
// ============================================================

const INDEPENDENCE_WEIGHTS = {

    independent: 1.00,

    related: 0.70,

    duplicate: 0.20,

    unknown: 0.50
};


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
// TEXT TOKEN SIMILARITY
// ============================================================

function calculateTextTokenSimilarity(
    textA = "",
    textB = ""
) {

    const tokensA =
        new Set(
            tokenize(textA)
        );

    const tokensB =
        new Set(
            tokenize(textB)
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

        claimExtraction:
            true,

        evidenceMapping:
            true,

        sourceQualityScoring:
            true,

        authorityScoring:
            true,

        freshnessScoring:
            true,

        claimProvenance:
            true,

        evidenceTraceability:
            true,

        sourceIndependenceScoring:
            true,

        sourceDiversityScoring:
            true,

        duplicateSourceDetection:
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
// SOURCE DOMAIN
// ============================================================

function getSourceDomain(
    url = ""
) {

    const cleanUrl =
        normalize(url);


    if (!cleanUrl) {

        return "";
    }


    try {

        return new URL(
            cleanUrl
        )
            .hostname
            .toLowerCase()
            .replace(
                /^www\./,
                ""
            );

    } catch (error) {

        return "";
    }
}


// ============================================================
// SOURCE FINGERPRINT
// ============================================================

function createSourceFingerprint(
    source = {}
) {

    const title =
        normalizeText(
            source.title
        );


    const publisher =
        normalizeText(
            source.publisher
        );


    const domain =
        getSourceDomain(
            source.url
        );


    const text =
        normalizeText(
            getSourceText(
                source
            )
        );


    return {

        domain,

        publisher,

        title,

        text
    };
}


// ============================================================
// SOURCE INDEPENDENCE
// ============================================================

function classifySourceIndependence(
    source = {},
    allSources = []
) {

    const fingerprint =
        createSourceFingerprint(
            source
        );


    let duplicateCount = 0;

    let relatedCount = 0;

    let sameDomainCount = 0;


    if (
        !Array.isArray(allSources)
    ) {

        allSources = [];
    }


    allSources.forEach(
        other => {

            if (
                other === source
            ) {

                return;
            }


            const otherFingerprint =
                createSourceFingerprint(
                    other
                );


            if (
                fingerprint.domain &&
                otherFingerprint.domain &&
                fingerprint.domain ===
                    otherFingerprint.domain
            ) {

                sameDomainCount++;
            }


            const titleSimilarity =
                calculateTextTokenSimilarity(
                    fingerprint.title,
                    otherFingerprint.title
                );


            const contentSimilarity =
                calculateTextTokenSimilarity(
                    fingerprint.text,
                    otherFingerprint.text
                );


            if (
                titleSimilarity >= 0.80 &&
                contentSimilarity >= 0.70
            ) {

                duplicateCount++;

            } else if (
                titleSimilarity >= 0.45 ||
                contentSimilarity >= 0.45
            ) {

                relatedCount++;
            }
        }
    );


    if (
        duplicateCount > 0
    ) {

        return {

            category:
                "duplicate",

            score:
                INDEPENDENCE_WEIGHTS.duplicate,

            duplicateCount,

            relatedCount,

            sameDomainCount,

            reason:
                "Highly similar source content detected."
        };
    }


    if (
        relatedCount > 0 ||
        sameDomainCount > 0
    ) {

        return {

            category:
                "related",

            score:
                INDEPENDENCE_WEIGHTS.related,

            duplicateCount,

            relatedCount,

            sameDomainCount,

            reason:
                "Related or same-domain source detected."
        };
    }


    if (
        fingerprint.domain
    ) {

        return {

            category:
                "independent",

            score:
                INDEPENDENCE_WEIGHTS.independent,

            duplicateCount:
                0,

            relatedCount:
                0,

            sameDomainCount:
                0,

            reason:
                "No strong duplication or same-domain relationship detected."
        };
    }


    return {

        category:
            "unknown",

        score:
            INDEPENDENCE_WEIGHTS.unknown,

        duplicateCount:
            0,

        relatedCount:
            0,

        sameDomainCount:
            0,

        reason:
            "Source independence could not be determined."
    };
}


// ============================================================
// AUTHORITY CLASSIFICATION
// ============================================================

function classifySourceAuthority(
    source = {}
) {

    const url =
        normalize(
            source.url
        );


    const publisher =
        normalize(
            source.publisher
        );


    const domain =
        getSourceDomain(
            url
        );


    const combined =
        `${domain} ${publisher}`
            .toLowerCase();


    if (
        domain.endsWith(".gov") ||
        domain.endsWith(".gov.in") ||
        domain.endsWith(".nic.in") ||
        /\bgovernment\b/.test(combined) ||
        /\bministry\b/.test(combined)
    ) {

        return {

            category:
                "government",

            score:
                AUTHORITY_WEIGHTS.government,

            reason:
                "Government or public authority signal detected."
        };
    }


    if (
        /\bofficial\b/.test(combined) ||
        /\bofficial website\b/.test(combined) ||
        /\bcorporate\b/.test(combined)
    ) {

        return {

            category:
                "official",

            score:
                AUTHORITY_WEIGHTS.official,

            reason:
                "Official organization signal detected."
        };
    }


    if (
        domain.endsWith(".edu") ||
        domain.endsWith(".ac.in") ||
        domain.endsWith(".edu.in") ||
        /\buniversity\b/.test(combined) ||
        /\bcollege\b/.test(combined)
    ) {

        return {

            category:
                "educational",

            score:
                AUTHORITY_WEIGHTS.educational,

            reason:
                "Educational institution signal detected."
        };
    }


    if (
        /\bresearch\b/.test(combined) ||
        /\bjournal\b/.test(combined) ||
        /\bscience\b/.test(combined) ||
        /\bpubmed\b/.test(combined) ||
        /\barxiv\b/.test(combined)
    ) {

        return {

            category:
                "research",

            score:
                AUTHORITY_WEIGHTS.research,

            reason:
                "Research or scientific source signal detected."
        };
    }


    const majorNewsDomains = [

        "reuters.com",

        "bbc.com",

        "bbc.co.uk",

        "apnews.com",

        "theguardian.com",

        "nytimes.com",

        "wsj.com",

        "ft.com",

        "bloomberg.com",

        "economist.com",

        "aljazeera.com",

        "cnn.com"
    ];


    if (
        majorNewsDomains.some(
            newsDomain =>
                domain === newsDomain ||
                domain.endsWith(
                    `.${newsDomain}`
                )
        )
    ) {

        return {

            category:
                "majorNews",

            score:
                AUTHORITY_WEIGHTS.majorNews,

            reason:
                "Established news publisher detected."
        };
    }


    if (
        /\bassociation\b/.test(combined) ||
        /\bfoundation\b/.test(combined) ||
        /\binstitute\b/.test(combined) ||
        /\borganization\b/.test(combined) ||
        /\bcorporation\b/.test(combined)
    ) {

        return {

            category:
                "establishedOrganization",

            score:
                AUTHORITY_WEIGHTS.establishedOrganization,

            reason:
                "Established organization signal detected."
        };
    }


    if (domain) {

        return {

            category:
                "general",

            score:
                AUTHORITY_WEIGHTS.general,

            reason:
                "General web source."
        };
    }


    return {

        category:
            "unknown",

        score:
            AUTHORITY_WEIGHTS.unknown,

        reason:
            "Source authority could not be determined."
    };
}


// ============================================================
// FRESHNESS CLASSIFICATION
// ============================================================

function classifySourceFreshness(
    source = {},
    now = new Date()
) {

    const publishedAt =
        source.publishedAt;


    if (!publishedAt) {

        return {

            category:
                "unknown",

            score:
                FRESHNESS_WEIGHTS.unknown,

            ageDays:
                null,

            reason:
                "Publication date unavailable."
        };
    }


    const timestamp =
        new Date(
            publishedAt
        ).getTime();


    if (
        Number.isNaN(timestamp)
    ) {

        return {

            category:
                "unknown",

            score:
                FRESHNESS_WEIGHTS.unknown,

            ageDays:
                null,

            reason:
                "Publication date could not be parsed."
        };
    }


    const currentTime =
        now instanceof Date
            ? now.getTime()
            : new Date().getTime();


    const ageDays =
        Math.max(
            0,
            (
                currentTime -
                timestamp
            ) /
            (
                1000 *
                60 *
                60 *
                24
            )
        );


    let category =
        "stale";


    let score =
        FRESHNESS_WEIGHTS.stale;


    if (
        ageDays <= 7
    ) {

        category =
            "veryFresh";

        score =
            FRESHNESS_WEIGHTS.veryFresh;

    } else if (
        ageDays <= 30
    ) {

        category =
            "fresh";

        score =
            FRESHNESS_WEIGHTS.fresh;

    } else if (
        ageDays <= 180
    ) {

        category =
            "recent";

        score =
            FRESHNESS_WEIGHTS.recent;

    } else if (
        ageDays <= 730
    ) {

        category =
            "old";

        score =
            FRESHNESS_WEIGHTS.old;
    }


    return {

        category,

        score,

        ageDays:
            Number(
                ageDays.toFixed(1)
            ),

        reason:
            "Publication date successfully evaluated."
    };
}


// ============================================================
// SOURCE QUALITY SCORE
// ============================================================

function calculateSourceQuality({
    source = {},
    now = new Date()
} = {}) {

    const authority =
        classifySourceAuthority(
            source
        );


    const freshness =
        classifySourceFreshness(
            source,
            now
        );


    const providerScore =
        typeof source.score ===
        "number"

            ? clamp(
                source.score
            )

            : 0.50;


    const quality =
        (
            authority.score * 0.50
        ) +
        (
            freshness.score * 0.25
        ) +
        (
            providerScore * 0.25
        );


    let qualityLevel =
        "low";


    if (
        quality >= 0.80
    ) {

        qualityLevel =
            "high";

    } else if (
        quality >= 0.60
    ) {

        qualityLevel =
            "medium";
    }


    return {

        score:
            Number(
                clamp(
                    quality
                ).toFixed(3)
            ),

        level:
            qualityLevel,

        authority,

        freshness,

        providerScore
    };
}


// ============================================================
// SCORE ALL SOURCES
// ============================================================

function scoreSources(
    sources = []
) {

    const validSources =
        validateSources(
            sources
        );


    const scoredSources =
        validSources.map(
            (
                source,
                index
            ) => {

                const quality =
                    calculateSourceQuality({

                        source
                    });


                const independence =
                    classifySourceIndependence(
                        source,
                        validSources
                    );


                const combinedQuality =
                    clamp(
                        (
                            quality.score *
                            0.75
                        ) +
                        (
                            independence.score *
                            0.25
                        )
                    );


                return {

                    ...source,

                    sourceId:
                        `source-${index + 1}`,

                    quality:
                        Number(
                            combinedQuality.toFixed(3)
                        ),

                    baseQuality:
                        quality.score,

                    qualityLevel:
                        combinedQuality >= 0.80

                            ? "high"

                            : combinedQuality >= 0.60

                                ? "medium"

                                : "low",

                    authority:
                        quality.authority,

                    freshness:
                        quality.freshness,

                    independence
                };
            }
        );


    const averageQuality =
        scoredSources.length > 0

            ? scoredSources.reduce(
                (
                    sum,
                    source
                ) =>
                    sum +
                    source.quality,
                0
            ) /
                scoredSources.length

            : 0;


    const independentSources =
        scoredSources.filter(
            source =>
                source.independence &&
                source.independence.category ===
                "independent"
        ).length;


    const relatedSources =
        scoredSources.filter(
            source =>
                source.independence &&
                source.independence.category ===
                "related"
        ).length;


    const duplicateSources =
        scoredSources.filter(
            source =>
                source.independence &&
                source.independence.category ===
                "duplicate"
        ).length;


    const unknownSources =
        scoredSources.filter(
            source =>
                source.independence &&
                source.independence.category ===
                "unknown"
        ).length;


    const domains =
        new Set(
            scoredSources
                .map(
                    source =>
                        getSourceDomain(
                            source.url
                        )
                )
                .filter(Boolean)
        );


    const highQuality =
        scoredSources.filter(
            source =>
                source.qualityLevel ===
                "high"
        ).length;


    const mediumQuality =
        scoredSources.filter(
            source =>
                source.qualityLevel ===
                "medium"
        ).length;


    const lowQuality =
        scoredSources.filter(
            source =>
                source.qualityLevel ===
                "low"
        ).length;


    const sourceDiversity =
        scoredSources.length > 0

            ? clamp(
                domains.size /
                scoredSources.length
            )

            : 0;


    const independentRatio =
        scoredSources.length > 0

            ? clamp(
                independentSources /
                scoredSources.length
            )

            : 0;


    return {

        success: true,

        sourceCount:
            scoredSources.length,

        sources:
            scoredSources,

        averageQuality:
            Number(
                clamp(
                    averageQuality
                ).toFixed(3)
            ),

        independentSources,

        relatedSources,

        duplicateSources,

        unknownSources,

        independentDomainCount:
            domains.size,

        sourceDiversity:
            Number(
                sourceDiversity.toFixed(3)
            ),

        independentRatio:
            Number(
                independentRatio.toFixed(3)
            ),

        highQualitySources:
            highQuality,

        mediumQualitySources:
            mediumQuality,

        lowQualitySources:
            lowQuality,

        status:
            scoredSources.length > 0

                ? "sources-scored"

                : "no-sources-scored"
    };
}


// ============================================================
// SOURCE SIMILARITY
// ============================================================

function calculateSourceSimilarity(
    sourceA = {},
    sourceB = {}
) {

    return calculateTextTokenSimilarity(
        getSourceText(sourceA),
        getSourceText(sourceB)
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
// SPLIT INTO SENTENCES
// ============================================================

function splitSentences(
    text = ""
) {

    const clean =
        normalize(text);


    if (!clean) {

        return [];
    }


    return clean
        .split(
            /(?<=[.!?])\s+|\n+/
        )
        .map(
            sentence =>
                normalize(sentence)
        )
        .filter(
            sentence =>
                sentence.length >= 15
        );
}


// ============================================================
// CHECK IF TEXT LOOKS LIKE A CLAIM
// ============================================================

function looksLikeClaim(
    sentence = ""
) {

    const text =
        normalize(sentence);


    if (
        text.length < 15
    ) {

        return false;
    }


    const words =
        text.split(/\s+/);


    if (
        words.length < 4
    ) {

        return false;
    }


    if (
        text.endsWith("?")
    ) {

        return false;
    }


    return true;
}


// ============================================================
// CLAIM SIMILARITY
// ============================================================

function calculateClaimSimilarity(
    claim = "",
    evidence = ""
) {

    return calculateTextTokenSimilarity(
        claim,
        evidence
    );
}


// ============================================================
// CLAIM CONFLICT CHECK
// ============================================================

function detectClaimConflict(
    claim = "",
    evidence = ""
) {

    const claimText =
        normalizeText(
            claim
        );


    const evidenceText =
        normalizeText(
            evidence
        );


    const claimNumbers =
        extractNumbers(
            claimText
        );


    const evidenceNumbers =
        extractNumbers(
            evidenceText
        );


    const numericDifference =
        claimNumbers.length > 0 &&
        evidenceNumbers.length > 0 &&
        claimNumbers.some(
            number =>
                !evidenceNumbers.includes(
                    number
                )
        ) &&
        evidenceNumbers.some(
            number =>
                !claimNumbers.includes(
                    number
                )
        );


    const evidenceConflictSignal =
        CONFLICT_PATTERNS.some(
            pattern =>
                pattern.test(
                    evidenceText
                )
        );


    return {

        numericDifference,

        conflictSignal:
            evidenceConflictSignal,

        possibleConflict:
            numericDifference ||
            evidenceConflictSignal
    };
}


// ============================================================
// EXTRACT CLAIMS
// ============================================================

function extractClaims({
    query = "",
    summary = "",
    sources = []
} = {}) {

    const cleanQuery =
        normalize(query);


    const cleanSummary =
        normalize(summary);


    const validSources =
        validateSources(
            sources
        );


    const candidates = [];


    splitSentences(
        cleanSummary
    ).forEach(
        sentence => {

            if (
                looksLikeClaim(
                    sentence
                )
            ) {

                candidates.push({

                    text:
                        sentence,

                    origin:
                        "summary",

                    sourceIndex:
                        null
                });
            }
        }
    );


    validSources.forEach(
        (
            source,
            index
        ) => {

            const sourceText =
                getSourceText(
                    source
                );


            splitSentences(
                sourceText
            )
                .slice(
                    0,
                    10
                )
                .forEach(
                    sentence => {

                        if (
                            looksLikeClaim(
                                sentence
                            )
                        ) {

                            candidates.push({

                                text:
                                    sentence,

                                origin:
                                    "source",

                                sourceIndex:
                                    index
                            });
                        }
                    }
                );
        }
    );


    const seen =
        new Set();


    const claims = [];


    candidates.forEach(
        candidate => {

            const normalizedClaim =
                normalizeText(
                    candidate.text
                );


            if (
                normalizedClaim.length < 15
            ) {

                return;
            }


            if (
                seen.has(
                    normalizedClaim
                )
            ) {

                return;
            }


            seen.add(
                normalizedClaim
            );


            claims.push({

                id:
                    `claim-${claims.length + 1}`,

                claim:
                    candidate.text,

                normalizedClaim,

                origin:
                    candidate.origin,

                sourceIndex:
                    candidate.sourceIndex
            });
        }
    );


    const limitedClaims =
        claims.slice(
            0,
            25
        );


    return {

        success: true,

        query:
            cleanQuery,

        claimCount:
            limitedClaims.length,

        claims:
            limitedClaims,

        status:
            limitedClaims.length > 0

                ? "claims-extracted"

                : "no-claims-extracted"
    };
}


// ============================================================
// MAP EVIDENCE TO CLAIM
// ============================================================

function mapClaimEvidence(
    claim = {},
    sources = []
) {

    const validSources =
        validateSources(
            sources
        );


    const scored =
        scoreSources(
            validSources
        );


    const evidence = [];


    scored.sources.forEach(
        source => {

            const sourceText =
                getSourceText(
                    source
                );


            const similarity =
                calculateClaimSimilarity(
                    claim.claim,
                    sourceText
                );


            if (
                similarity < 0.15
            ) {

                return;
            }


            const conflict =
                detectClaimConflict(
                    claim.claim,
                    sourceText
                );


            let relationship =
                "neutral";


            if (
                conflict.possibleConflict
            ) {

                relationship =
                    "conflicting";

            } else if (
                similarity >= 0.25
            ) {

                relationship =
                    "supporting";
            }


            let strength =
                "low";


            if (
                similarity >=
                HIGH_EVIDENCE_SCORE
            ) {

                strength =
                    "high";

            } else if (
                similarity >=
                MEDIUM_EVIDENCE_SCORE
            ) {

                strength =
                    "medium";
            }


            const independenceScore =
                source.independence
                    ? source.independence.score
                    : INDEPENDENCE_WEIGHTS.unknown;


            const evidenceScore =
                clamp(
                    (
                        similarity * 0.50
                    ) +
                    (
                        source.quality * 0.30
                    ) +
                    (
                        independenceScore * 0.20
                    )
                );


            let qualityAdjustedStrength =
                "low";


            if (
                evidenceScore >= 0.75
            ) {

                qualityAdjustedStrength =
                    "high";

            } else if (
                evidenceScore >= 0.50
            ) {

                qualityAdjustedStrength =
                    "medium";
            }


            evidence.push({

                evidenceId:
                    `${claim.id}-${source.sourceId}`,

                claimId:
                    claim.id,

                sourceId:
                    source.sourceId,

                title:
                    source.title,

                url:
                    source.url,

                publisher:
                    source.publisher,

                relationship,

                similarity:
                    Number(
                        similarity.toFixed(3)
                    ),

                evidenceStrength:
                    strength,

                qualityAdjustedStrength,

                evidenceScore:
                    Number(
                        evidenceScore.toFixed(3)
                    ),

                sourceQuality:
                    source.quality,

                sourceQualityLevel:
                    source.qualityLevel,

                authority:
                    source.authority,

                freshness:
                    source.freshness,

                independence:
                    source.independence,

                numericDifference:
                    conflict.numericDifference,

                conflictSignal:
                    conflict.conflictSignal
            });
        }
    );


    return evidence;
}


// ============================================================
// BUILD CLAIM PROVENANCE
// ============================================================

function buildClaimProvenance(
    claim = {},
    evidence = []
) {

    const supporting =
        evidence.filter(
            item =>
                item.relationship ===
                "supporting"
        );


    const conflicting =
        evidence.filter(
            item =>
                item.relationship ===
                "conflicting"
        );


    const neutral =
        evidence.filter(
            item =>
                item.relationship ===
                "neutral"
        );


    const supportingSources =
        supporting.map(
            item => ({

                sourceId:
                    item.sourceId,

                title:
                    item.title,

                url:
                    item.url,

                publisher:
                    item.publisher || "",

                evidenceId:
                    item.evidenceId,

                evidenceScore:
                    item.evidenceScore,

                similarity:
                    item.similarity,

                sourceQuality:
                    item.sourceQuality,

                sourceQualityLevel:
                    item.sourceQualityLevel,

                authority:
                    item.authority,

                freshness:
                    item.freshness,

                independence:
                    item.independence
            })
        );


    const conflictingSources =
        conflicting.map(
            item => ({

                sourceId:
                    item.sourceId,

                title:
                    item.title,

                url:
                    item.url,

                publisher:
                    item.publisher || "",

                evidenceId:
                    item.evidenceId,

                evidenceScore:
                    item.evidenceScore,

                similarity:
                    item.similarity,

                sourceQuality:
                    item.sourceQuality,

                authority:
                    item.authority,

                freshness:
                    item.freshness,

                independence:
                    item.independence
            })
        );


    const neutralSources =
        neutral.map(
            item => ({

                sourceId:
                    item.sourceId,

                title:
                    item.title,

                url:
                    item.url,

                evidenceId:
                    item.evidenceId
            })
        );


    const strongestEvidence =
        supporting.length > 0

            ? [...supporting]
                .sort(
                    (
                        a,
                        b
                    ) =>
                        b.evidenceScore -
                        a.evidenceScore
                )[0]

            : null;


    return {

        claimId:
            claim.id,

        claim:
            claim.claim,

        provenanceStatus:

            conflicting.length > 0

                ? "conflicting"

                : supporting.length > 0

                    ? "supported"

                    : "unproven",

        supportingSources,

        conflictingSources,

        neutralSources,

        supportingSourceCount:
            supportingSources.length,

        conflictingSourceCount:
            conflictingSources.length,

        evidenceCount:
            evidence.length,

        strongestEvidence:
            strongestEvidence

                ? {

                    evidenceId:
                        strongestEvidence.evidenceId,

                    sourceId:
                        strongestEvidence.sourceId,

                    title:
                        strongestEvidence.title,

                    url:
                        strongestEvidence.url,

                    evidenceScore:
                        strongestEvidence.evidenceScore,

                    sourceQuality:
                        strongestEvidence.sourceQuality,

                    authority:
                        strongestEvidence.authority,

                    freshness:
                        strongestEvidence.freshness,

                    independence:
                        strongestEvidence.independence
                }

                : null
    };
}


// ============================================================
// BUILD GLOBAL PROVENANCE INDEX
// ============================================================

function buildProvenanceIndex(
    evidenceMapping = {}
) {

    if (
        !evidenceMapping ||
        !Array.isArray(
            evidenceMapping.claims
        )
    ) {

        return {

            success: false,

            claimCount:
                0,

            sourceCount:
                0,

            claims: [],

            sourceUsage: []
        };
    }


    const sourceMap =
        new Map();


    const claims =
        evidenceMapping.claims.map(
            claim => {

                const provenance =
                    claim.provenance ||
                    buildClaimProvenance(
                        claim,
                        claim.evidence || []
                    );


                (
                    claim.evidence ||
                    []
                ).forEach(
                    evidence => {

                        if (
                            !sourceMap.has(
                                evidence.sourceId
                            )
                        ) {

                            sourceMap.set(
                                evidence.sourceId,
                                {

                                    sourceId:
                                        evidence.sourceId,

                                    title:
                                        evidence.title,

                                    url:
                                        evidence.url,

                                    claimIds:
                                        [],

                                    evidenceCount:
                                        0,

                                    supportingClaims:
                                        0,

                                    conflictingClaims:
                                        0
                                }
                            );
                        }


                        const sourceRecord =
                            sourceMap.get(
                                evidence.sourceId
                            );


                        sourceRecord.evidenceCount++;


                        if (
                            !sourceRecord.claimIds.includes(
                                claim.id
                            )
                        ) {

                            sourceRecord.claimIds.push(
                                claim.id
                            );
                        }


                        if (
                            evidence.relationship ===
                            "supporting"
                        ) {

                            sourceRecord.supportingClaims++;

                        } else if (
                            evidence.relationship ===
                            "conflicting"
                        ) {

                            sourceRecord.conflictingClaims++;
                        }
                    }
                );


                return {

                    ...claim,

                    provenance
                };
            }
        );


    const sourceUsage =
        Array.from(
            sourceMap.values()
        );


    return {

        success: true,

        claimCount:
            claims.length,

        sourceCount:
            sourceUsage.length,

        claims,

        sourceUsage,

        status:
            "provenance-index-built"
    };
}


// ============================================================
// CALCULATE CLAIM CONFIDENCE
// ============================================================

function calculateClaimConfidence(
    evidence = []
) {

    if (
        !Array.isArray(evidence) ||
        evidence.length === 0
    ) {

        return 0;
    }


    const supporting =
        evidence.filter(
            item =>
                item.relationship ===
                "supporting"
        );


    const conflicting =
        evidence.filter(
            item =>
                item.relationship ===
                "conflicting"
        );


    const highQualitySupport =
        supporting.filter(
            item =>
                item.sourceQuality >= 0.80
        );


    const independentSupport =
        supporting.filter(
            item =>
                item.independence &&
                item.independence.category ===
                "independent"
        );


    const highEvidence =
        supporting.filter(
            item =>
                item.evidenceStrength ===
                "high"
        );


    const mediumEvidence =
        supporting.filter(
            item =>
                item.evidenceStrength ===
                "medium"
        );


    let score = 0;


    score +=
        Math.min(
            0.35,
            supporting.length * 0.13
        );


    score +=
        Math.min(
            0.20,
            highQualitySupport.length * 0.08
        );


    score +=
        Math.min(
            0.15,
            independentSupport.length * 0.07
        );


    score +=
        Math.min(
            0.20,
            highEvidence.length * 0.08 +
            mediumEvidence.length * 0.04
        );


    const averageEvidenceScore =
        supporting.length > 0

            ? supporting.reduce(
                (
                    sum,
                    item
                ) =>
                    sum +
                    item.evidenceScore,
                0
            ) /
                supporting.length

            : 0;


    score +=
        averageEvidenceScore *
        0.20;


    score -=
        Math.min(
            0.50,
            conflicting.length * 0.20
        );


    return clamp(
        score
    );
}


// ============================================================
// BUILD EVIDENCE MAPPING
// ============================================================

function buildEvidenceMapping({
    query = "",
    summary = "",
    sources = []
} = {}) {

    const claimResult =
        extractClaims({

            query,

            summary,

            sources
        });


    const mappedClaims =
        claimResult.claims.map(
            claim => {

                const evidence =
                    mapClaimEvidence(
                        claim,
                        sources
                    );


                const confidence =
                    calculateClaimConfidence(
                        evidence
                    );


                const supportingCount =
                    evidence.filter(
                        item =>
                            item.relationship ===
                            "supporting"
                    ).length;


                const conflictingCount =
                    evidence.filter(
                        item =>
                            item.relationship ===
                            "conflicting"
                    ).length;


                let status =
                    "needs-review";


                if (
                    conflictingCount > 0
                ) {

                    status =
                        "conflicting";

                } else if (
                    confidence >=
                    MIN_CLAIM_CONFIDENCE
                ) {

                    status =
                        "supported";
                }


                const mappedClaim = {

                    id:
                        claim.id,

                    claim:
                        claim.claim,

                    normalizedClaim:
                        claim.normalizedClaim,

                    origin:
                        claim.origin,

                    sourceIndex:
                        claim.sourceIndex,

                    evidence,

                    evidenceCount:
                        evidence.length,

                    supportingSources:
                        supportingCount,

                    conflictingSources:
                        conflictingCount,

                    confidence:
                        Number(
                            confidence.toFixed(3)
                        ),

                    status
                };


                mappedClaim.provenance =
                    buildClaimProvenance(
                        mappedClaim,
                        evidence
                    );


                return mappedClaim;
            }
        );


    const supportedClaims =
        mappedClaims.filter(
            claim =>
                claim.status ===
                "supported"
        ).length;


    const conflictingClaims =
        mappedClaims.filter(
            claim =>
                claim.status ===
                "conflicting"
        ).length;


    const reviewClaims =
        mappedClaims.filter(
            claim =>
                claim.status ===
                "needs-review"
        ).length;


    const total =
        mappedClaims.length;


    const averageConfidence =
        total > 0

            ? mappedClaims.reduce(
                (
                    sum,
                    claim
                ) =>
                    sum +
                    claim.confidence,
                0
            ) /
                total

            : 0;


    const mapping = {

        success: true,

        query:
            normalize(query),

        claimCount:
            total,

        claims:
            mappedClaims,

        supportedClaims,

        conflictingClaims,

        reviewClaims,

        averageConfidence:
            Number(
                clamp(
                    averageConfidence
                ).toFixed(3)
            ),

        conflictDetected:
            conflictingClaims > 0,

        status:
            conflictingClaims > 0

                ? "claim-conflicts-detected"

                : supportedClaims > 0

                    ? "claims-supported"

                    : "claims-require-review"
    };


    const provenanceIndex =
        buildProvenanceIndex(
            mapping
        );


    return {

        ...mapping,

        provenanceIndex
    };
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


    const independenceA =
        classifySourceIndependence(
            sourceA,
            [
                sourceA,
                sourceB
            ]
        );


    const independenceB =
        classifySourceIndependence(
            sourceB,
            [
                sourceA,
                sourceB
            ]
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

        independence: {

            sourceA:
                independenceA,

            sourceB:
                independenceB
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


    const sourceQuality =
        scoreSources(
            validSources
        );


    const comparison =
        compareSources(
            validSources
        );


    const evidenceMapping =
        buildEvidenceMapping({

            query,

            summary,

            sources:
                validSources
        });


    return {

        success: true,

        query:
            normalize(query),

        sources:
            validSources,

        scoredSources:
            sourceQuality.sources,

        sourceQuality,

        sourceCount:
            validSources.length,

        summary:
            normalize(summary),

        confidence:
            clamp(confidence),

        comparison,

        evidenceMapping,

        provenanceIndex:
            evidenceMapping.provenanceIndex,

        claimCount:
            evidenceMapping.claimCount,

        conflictDetected:
            Boolean(
                comparison.conflictDetected ||
                evidenceMapping.conflictDetected
            ),

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


    const sourceQuality =
        result.sourceQuality ||
        scoreSources(
            sources
        );


    const sourceText =
        sources
            .map(
                (
                    source,
                    index
                ) =>
                    `Source ${index + 1}: ${source.title} - ${source.url}`
            )
            .join("\n");


    const comparison =
        result.comparison ||
        compareSources(
            sources
        );


    const evidenceMapping =
        result.evidenceMapping ||
        buildEvidenceMapping({

            query:
                result.query,

            summary:
                result.summary,

            sources
        });


    return {

        success: true,

        query:
            normalize(
                result.query
            ),

        summary:
            normalize(
                result.summary
            ),

        sources:
            sourceText,

        sourceList:
            sources,

        scoredSources:
            sourceQuality.sources,

        sourceQuality,

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

        evidenceMapping,

        provenanceIndex:
            evidenceMapping.provenanceIndex,

        claimCount:
            evidenceMapping.claimCount,

        conflictDetected:
            Boolean(
                result.conflictDetected ||
                comparison.conflictDetected ||
                evidenceMapping.conflictDetected
            )
    };
}


// ============================================================
// CALCULATE RESEARCH CONFIDENCE
// ============================================================

function calculateResearchConfidence({
    sources = [],
    confidence = 0,
    comparison = null,
    evidenceMapping = null,
    sourceQuality = null
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


    const evidenceResult =
        evidenceMapping ||
        buildEvidenceMapping({

            sources:
                validSources
        });


    const qualityResult =
        sourceQuality ||
        scoreSources(
            validSources
        );


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


    if (
        evidenceResult.conflictDetected
    ) {

        const conflictingClaims =
            Number(
                evidenceResult.conflictingClaims
            ) || 1;


        const penalty =
            Math.min(
                0.20,
                conflictingClaims * 0.05
            );


        baseConfidence =
            baseConfidence -
            penalty;
    }


    if (
        evidenceResult.supportedClaims > 0 &&
        evidenceResult.averageConfidence >= 0.70
    ) {

        baseConfidence =
            Math.min(
                1,
                baseConfidence + 0.05
            );
    }


    if (
        qualityResult &&
        qualityResult.sourceCount > 0
    ) {

        const averageQuality =
            clamp(
                qualityResult.averageQuality
            );


        const qualityAdjustment =
            (
                averageQuality -
                0.50
            ) *
            0.20;


        baseConfidence =
            baseConfidence +
            qualityAdjustment;
    }


    // ========================================================
    // SOURCE INDEPENDENCE / DIVERSITY ADJUSTMENT
    // ========================================================

    if (
        qualityResult &&
        qualityResult.sourceCount > 0
    ) {

        const independentRatio =
            clamp(
                qualityResult.independentRatio
            );


        const diversity =
            clamp(
                qualityResult.sourceDiversity
            );


        const independenceAdjustment =
            (
                independentRatio -
                0.50
            ) *
            0.10;


        const diversityAdjustment =
            (
                diversity -
                0.50
            ) *
            0.05;


        baseConfidence =
            baseConfidence +
            independenceAdjustment +
            diversityAdjustment;


        if (
            qualityResult.duplicateSources > 0
        ) {

            baseConfidence =
                baseConfidence -
                Math.min(
                    0.15,
                    qualityResult.duplicateSources *
                    0.05
                );
        }
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


    const sourceQuality =
        result.sourceQuality ||
        scoreSources(
            actualSources
        );


    const evidenceMapping =
        result.evidenceMapping ||
        buildEvidenceMapping({

            query:
                result.query,

            summary:
                result.summary,

            sources:
                actualSources
        });


    const score =
        typeof confidence ===
        "number"

            ? clamp(confidence)

            : calculateResearchConfidence({

                sources:
                    actualSources,

                confidence:
                    result.confidence,

                comparison,

                evidenceMapping,

                sourceQuality
            });


    let status =
        "review";


    if (
        comparison.conflictDetected ||
        evidenceMapping.conflictDetected
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
                comparison.conflictDetected ||
                evidenceMapping.conflictDetected
            ),

        comparison,

        sourceQuality,

        evidenceMapping,

        provenanceIndex:
            evidenceMapping.provenanceIndex,

        claimCount:
            evidenceMapping.claimCount,

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
    comparison = null,
    evidenceMapping = null,
    sourceQuality = null
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


    const qualityResult =
        sourceQuality ||
        scoreSources(
            validSources
        );


    const sourceText =
        qualityResult.sources
            .map(
                source =>
                    `${source.sourceId}: ${source.title}: ${source.url} | quality=${source.quality} | authority=${source.authority.category} | freshness=${source.freshness.category} | independence=${source.independence.category} | independenceScore=${source.independence.score}`
            )
            .join("\n");


    const comparisonResult =
        comparison ||
        compareSources(
            validSources
        );


    const evidenceResult =
        evidenceMapping ||
        buildEvidenceMapping({

            summary:
                cleanSummary,

            sources:
                validSources
        });


    let comparisonText =
        "";


    if (
        comparisonResult.conflictDetected ||
        evidenceResult.conflictDetected
    ) {

        comparisonText =
            "\n\nResearch comparison: Conflicting evidence detected. Further verification is required.";

    } else {

        comparisonText =
            "\n\nResearch comparison: Sources were cross-checked and no basic conflict signal was detected.";
    }


    const diversityText =
        `\n\nSource diversity: ` +
        `${qualityResult.sourceDiversity} | ` +
        `independent sources=${qualityResult.independentSources} | ` +
        `related sources=${qualityResult.relatedSources} | ` +
        `duplicate sources=${qualityResult.duplicateSources} | ` +
        `independent domains=${qualityResult.independentDomainCount}`;


    let claimText =
        "";


    if (
        evidenceResult.claimCount > 0
    ) {

        const claimLines =
            evidenceResult.claims
                .map(
                    claim => {

                        const sourceIds =
                            claim.evidence
                                .map(
                                    item =>
                                        item.sourceId
                                )
                                .join(", ");


                        const provenanceStatus =
                            claim.provenance

                                ? claim.provenance
                                    .provenanceStatus

                                : "unknown";


                        const strongestSource =
                            claim.provenance &&
                            claim.provenance
                                .strongestEvidence

                                ? claim.provenance
                                    .strongestEvidence
                                    .sourceId

                                : "none";


                        return (

                            `${claim.id} | ` +

                            `${claim.status} | ` +

                            `provenance=${provenanceStatus} | ` +

                            `confidence=${claim.confidence} | ` +

                            `sources=${sourceIds || "none"} | ` +

                            `strongest=${strongestSource} | ` +

                            `${claim.claim}`
                        );
                    }
                )
                .join("\n");


        claimText =
            "\n\nClaims & Evidence:\n" +
            claimLines;
    }


    if (!sourceText) {

        return (

            cleanSummary +

            claimText +

            comparisonText +

            diversityText
        );
    }


    return (

        `${cleanSummary}\n\n` +

        `Sources & Quality:\n` +

        sourceText +

        claimText +

        comparisonText +

        diversityText
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


    const sourceQuality =
        scoreSources(
            validSources
        );


    const comparison =
        compareSources(
            validSources
        );


    const evidenceMapping =
        buildEvidenceMapping({

            query:
                cleanQuery,

            summary:
                cleanSummary,

            sources:
                validSources
        });


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


    const finalConfidence =
        calculateResearchConfidence({

            sources:
                validSources,

            confidence,

            comparison,

            evidenceMapping,

            sourceQuality
        });


    const verificationResult =
        verifyResearch({

            result:
                {

                    ...researchResult,

                    sourceQuality,

                    evidenceMapping
                },

            sourceCount:
                validSources.length,

            confidence:
                finalConfidence,

            notes
        });


    if (
        !verificationResult.verified
    ) {

        return {

            success: false,

            query:
                cleanQuery,

            verification:
                verificationResult,

            sourceQuality,

            comparison,

            evidenceMapping,

            provenanceIndex:
                evidenceMapping.provenanceIndex,

            status:

                (
                    comparison.conflictDetected ||
                    evidenceMapping.conflictDetected
                )

                    ? "conflicting-research"

                    : "verification-required",

            message:

                (
                    comparison.conflictDetected ||
                    evidenceMapping.conflictDetected
                )

                    ? "Conflicting research evidence detected. AarHen will not store this as verified knowledge until the information is resolved."

                    : "Research cannot be stored as verified knowledge until verification requirements are met."
        };
    }


    const content =
        buildLearningContent({

            summary:
                cleanSummary,

            sources:
                validSources,

            comparison,

            evidenceMapping,

            sourceQuality
        });


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

            sourceQuality,

            comparison,

            evidenceMapping,

            provenanceIndex:
                evidenceMapping.provenanceIndex,

            learning:
                learned,

            status:
                "learning-failed"
        };
    }


    return {

        success: true,

        query:
            cleanQuery,

        verification:
            verificationResult,

        sourceQuality,

        comparison,

        evidenceMapping,

        provenanceIndex:
            evidenceMapping.provenanceIndex,

        learning:
            learned,

        memoryId:
            learned.memoryId ||
            null,

        sourceCount:
            validSources.length,

        claimCount:
            evidenceMapping.claimCount,

        confidence:
            verificationResult.confidence,

        conflictDetected:
            Boolean(
                comparison.conflictDetected ||
                evidenceMapping.conflictDetected
            ),

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

        claimExtraction:
            true,

        evidenceMapping:
            true,

        claimConfidence:
            true,

        evidenceStrength:
            true,

        sourceQualityScoring:
            true,

        authorityScoring:
            true,

        freshnessScoring:
            true,

        qualityAwareConfidence:
            true,

        claimProvenance:
            true,

        evidenceTraceability:
            true,

        sourceToClaimLinking:
            true,

        provenanceIndex:
            true,

        sourceIndependenceScoring:
            true,

        sourceDiversityScoring:
            true,

        duplicateSourceDetection:
            true,

        relatedSourceDetection:
            true,

        independentDomainTracking:
            true,

        minimumVerifiedSources:
            MIN_VERIFIED_SOURCES,

        minimumVerifiedConfidence:
            MIN_VERIFIED_CONFIDENCE,

        minimumClaimConfidence:
            MIN_CLAIM_CONFIDENCE,

        pipeline: [

            "research",

            "validate-sources",

            "score-source-quality",

            "classify-authority",

            "evaluate-freshness",

            "score-source-independence",

            "detect-duplicate-sources",

            "detect-related-sources",

            "calculate-source-diversity",

            "track-independent-domains",

            "compare-sources",

            "extract-claims",

            "map-evidence",

            "build-claim-provenance",

            "build-provenance-index",

            "detect-conflicts",

            "calculate-claim-confidence",

            "calculate-research-confidence",

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

    calculateSourceSimilarity,

    calculateClaimSimilarity,

    calculateTextTokenSimilarity,

    calculateSourceQuality,

    classifySourceAuthority,

    classifySourceFreshness,

    createSourceFingerprint,

    classifySourceIndependence,

    scoreSources,

    extractClaims,

    mapClaimEvidence,

    buildClaimProvenance,

    buildProvenanceIndex,

    calculateClaimConfidence,

    buildEvidenceMapping,

    compareSourcePair,

    compareSources,

    verifyResearch,

    verifyWithEngine,

    buildLearningContent,

    learnVerifiedResearch,

    processResearchResult,

    getResearchStatus
};
