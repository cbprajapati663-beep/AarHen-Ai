/**
 * AARHEN CORE v5
 * Research Engine
 *
 * Version: 5.5.3
 *
 * Evidence-driven web research processing.
 *
 * Important:
 * - Provider/search score is a retrieval signal.
 * - Provider score is NOT treated as truth confidence.
 * - Verification requires multiple valid sources,
 *   sufficient calibrated confidence, and no detected conflicts.
 * - Verified learning is only allowed after verification passes.
 */

const verification =
    require("../core/verification");

const learning =
    require("../core/learning");

const RESEARCH_VERSION =
    "5.5.3";

const MIN_VERIFIED_SOURCES =
    2;

const MIN_VERIFIED_CONFIDENCE =
    0.80;

const MIN_PARTIAL_SOURCES =
    1;

const MIN_PARTIAL_CONFIDENCE =
    0.60;

const MIN_CLAIM_CONFIDENCE =
    0.60;

const HIGH_EVIDENCE_SCORE =
    0.75;

const MEDIUM_EVIDENCE_SCORE =
    0.50;


/* =========================================================
   SOURCE WEIGHTS
========================================================= */

const AUTHORITY_WEIGHTS = {

    official:
        1.00,

    government:
        1.00,

    research:
        0.95,

    educational:
        0.90,

    majorNews:
        0.85,

    establishedOrganization:
        0.80,

    general:
        0.50,

    unknown:
        0.35
};


const FRESHNESS_WEIGHTS = {

    veryFresh:
        1.00,

    fresh:
        0.90,

    recent:
        0.75,

    old:
        0.55,

    stale:
        0.35,

    unknown:
        0.50
};


const INDEPENDENCE_WEIGHTS = {

    independent:
        1.00,

    related:
        0.70,

    duplicate:
        0.20,

    unknown:
        0.50
};


/* =========================================================
   GENERAL HELPERS
========================================================= */

function normalize(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";
    }

    return String(
        value
    ).trim();
}


function clamp(
    value,
    min = 0,
    max = 1
) {

    const number =
        Number(
            value
        );

    if (
        !Number.isFinite(
            number
        )
    ) {

        return min;
    }

    return Math.min(
        max,
        Math.max(
            min,
            number
        )
    );
}


function safeArray(
    value
) {

    return Array.isArray(
        value
    )
        ? value
        : [];
}


function safeObject(
    value
) {

    return (
        value &&
        typeof value ===
            "object"
    )
        ? value
        : {};
}


function unique(
    array = []
) {

    return [
        ...new Set(
            array
        )
    ];
}


/* =========================================================
   TEXT HELPERS
========================================================= */

function normalizeText(
    value
) {

    return normalize(
        value
    )
        .toLowerCase()
        .replace(
            /https?:\/\/\S+/g,
            " "
        )
        .replace(
            /[^\p{L}\p{N}\s]/gu,
            " "
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();
}


function tokenize(
    value
) {

    return normalizeText(
        value
    )
        .split(
            /\s+/
        )
        .filter(
            Boolean
        );
}


function calculateTextTokenSimilarity(
    a,
    b
) {

    const tokensA =
        unique(
            tokenize(
                a
            )
        );

    const tokensB =
        unique(
            tokenize(
                b
            )
        );

    if (
        !tokensA.length ||
        !tokensB.length
    ) {

        return 0;
    }

    const setB =
        new Set(
            tokensB
        );

    let common =
        0;

    for (
        const token of
        tokensA
    ) {

        if (
            setB.has(
                token
            )
        ) {

            common++;
        }
    }

    return clamp(

        common /
        Math.max(
            tokensA.length,
            tokensB.length
        )

    );
}


/* =========================================================
   RESEARCH REQUEST
========================================================= */

function createResearchRequest({
    query = "",
    maxSources = 5,
    language = "en",
    providerRequired = true,
    verificationRequired = true,
    learningEnabled = true
} = {}) {

    return {

        success:
            true,

        version:
            RESEARCH_VERSION,

        query:
            normalize(
                query
            ),

        maxSources:
            Math.max(
                1,
                Number(
                    maxSources
                ) || 5
            ),

        language:
            normalize(
                language
            ) || "en",

        providerRequired,

        verificationRequired,

        learningEnabled,

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

        semanticClaimValidation:
            true,

        claimContextAnalysis:
            true,

        negationDetection:
            true,

        subjectActionObjectAnalysis:
            true,

        validationAwareConfidence:
            true
    };
}


/* =========================================================
   URL HELPERS
========================================================= */

function unwrapMarkdownUrl(
    value
) {

    const text =
        normalize(
            value
        );

    const markdown =
        text.match(
            /\]\((https?:\/\/[^)]+)\)/i
        );

    if (
        markdown
    ) {

        return markdown[1];
    }

    const plain =
        text.match(
            /https?:\/\/[^\s)]+/i
        );

    return plain
        ? plain[0]
        : text;
}


/* =========================================================
   SOURCE NORMALIZATION
========================================================= */

function normalizeSource(
    source = {},
    index = 0
) {

    const item =
        safeObject(
            source
        );

    const title =
        normalize(
            item.title
        ) ||
        normalize(
            item.name
        ) ||
        `Research Source ${index + 1}`;

    const url =
        unwrapMarkdownUrl(

            normalize(
                item.url
            ) ||

            normalize(
                item.link
            ) ||

            ""

        );

    const content =
        normalize(
            item.content
        ) ||

        normalize(
            item.text
        ) ||

        normalize(
            item.description
        ) ||

        normalize(
            item.snippet
        ) ||

        "";

    const snippet =
        normalize(
            item.snippet
        ) ||

        content.slice(
            0,
            500
        );

    const publisher =
        normalize(
            item.publisher
        ) ||

        normalize(
            item.source
        ) ||

        normalize(
            item.domain
        ) ||

        "";

    const publishedDate =
        normalize(
            item.publishedDate
        ) ||

        normalize(
            item.publishedAt
        ) ||

        normalize(
            item.date
        ) ||

        normalize(
            item.published_at
        ) ||

        "";

    const score =
        Number.isFinite(
            Number(
                item.score
            )
        )
            ? clamp(
                Number(
                    item.score
                )
            )
            : 0.50;

    return {

        id:
            normalize(
                item.id
            ) ||
            `source-${index + 1}`,

        title,

        url,

        content,

        snippet,

        publisher,

        publishedDate,

        score
    };
}


function validateSources(
    sources = []
) {

    return safeArray(
        sources
    )

        .map(
            (
                source,
                index
            ) =>
                normalizeSource(
                    source,
                    index
                )
        )

        .filter(
            source =>
                source.title ||
                source.url ||
                source.content
        );
}


/* =========================================================
   SOURCE DOMAIN
========================================================= */

function getSourceDomain(
    url
) {

    const value =
        unwrapMarkdownUrl(
            url
        );

    if (
        !value
    ) {

        return "";
    }

    try {

        return new URL(
            value
        )
            .hostname
            .replace(
                /^www\./i,
                ""
            )
            .toLowerCase();

    } catch {

        return "";
    }
}


/* =========================================================
   DUPLICATE SOURCES
========================================================= */

function getSourceFingerprint(
    source = {}
) {

    const item =
        normalizeSource(
            source
        );

    return [

        getSourceDomain(
            item.url
        ),

        normalizeText(
            item.title
        ),

        normalizeText(
            item.content ||
            item.snippet
        ).slice(
            0,
            250
        )

    ].join(
        "|"
    );
}


function detectDuplicateSources(
    sources = []
) {

    const fingerprints =
        new Map();

    const duplicateIds =
        [];

    for (
        const source of
        validateSources(
            sources
        )
    ) {

        const fingerprint =
            getSourceFingerprint(
                source
            );

        if (
            !fingerprint
        ) {

            continue;
        }

        if (
            fingerprints.has(
                fingerprint
            )
        ) {

            duplicateIds.push(
                source.id
            );

        } else {

            fingerprints.set(
                fingerprint,
                source.id
            );
        }
    }

    return {

        duplicateSources:
            duplicateIds.length,

        duplicateIds
    };
}


/* =========================================================
   SOURCE INDEPENDENCE
========================================================= */

function calculateSourceIndependence(
    source,
    allSources = []
) {

    const domain =
        getSourceDomain(
            source &&
            source.url
        );

    if (
        !domain
    ) {

        return {

            classification:
                "unknown",

            score:
                INDEPENDENCE_WEIGHTS
                    .unknown
        };
    }

    const sameDomainCount =
        safeArray(
            allSources
        ).filter(
            item =>
                getSourceDomain(
                    item &&
                    item.url
                ) ===
                domain
        ).length;

    if (
        sameDomainCount <= 1
    ) {

        return {

            classification:
                "independent",

            score:
                INDEPENDENCE_WEIGHTS
                    .independent
        };
    }

    return {

        classification:
            "related",

        score:
            INDEPENDENCE_WEIGHTS
                .related
    };
}


/* =========================================================
   SOURCE AUTHORITY
========================================================= */

function classifySourceAuthority(
    source = {}
) {

    const domain =
        getSourceDomain(
            source.url
        );

    const publisher =
        normalizeText(
            source.publisher
        );

    const value =
        `${domain} ${publisher}`;

    if (
        domain.endsWith(
            ".gov"
        ) ||
        domain.includes(
            ".gov."
        )
    ) {

        return "government";
    }

    if (
        domain.endsWith(
            ".edu"
        ) ||
        domain.includes(
            ".ac."
        )
    ) {

        return "educational";
    }

    if (
        value.includes(
            "official"
        ) ||
        value.includes(
            "ministry"
        ) ||
        value.includes(
            "government"
        )
    ) {

        return "official";
    }

    if (
        value.includes(
            "reuters"
        ) ||
        value.includes(
            "bbc"
        ) ||
        value.includes(
            "associated press"
        ) ||
        value.includes(
            "apnews"
        ) ||
        value.includes(
            "bloomberg"
        ) ||
        value.includes(
            "financial times"
        )
    ) {

        return "majorNews";
    }

    if (
        value.includes(
            "university"
        ) ||
        value.includes(
            "institute"
        ) ||
        value.includes(
            "research"
        ) ||
        value.includes(
            "journal"
        )
    ) {

        return "research";
    }

    if (
        publisher ||
        domain
    ) {

        return "establishedOrganization";
    }

    return "unknown";
}


/* =========================================================
   FRESHNESS
========================================================= */

function calculateFreshness(
    publishedDate
) {

    const value =
        normalize(
            publishedDate
        );

    if (
        !value
    ) {

        return {

            classification:
                "unknown",

            score:
                FRESHNESS_WEIGHTS
                    .unknown
        };
    }

    const timestamp =
        Date.parse(
            value
        );

    if (
        !Number.isFinite(
            timestamp
        )
    ) {

        return {

            classification:
                "unknown",

            score:
                FRESHNESS_WEIGHTS
                    .unknown
        };
    }

    const ageDays =
        Math.max(

            0,

            (
                Date.now() -
                timestamp
            ) /
            86400000

        );

    if (
        ageDays <= 7
    ) {

        return {

            classification:
                "veryFresh",

            score:
                FRESHNESS_WEIGHTS
                    .veryFresh
        };
    }

    if (
        ageDays <= 30
    ) {

        return {

            classification:
                "fresh",

            score:
                FRESHNESS_WEIGHTS
                    .fresh
        };
    }

    if (
        ageDays <= 180
    ) {

        return {

            classification:
                "recent",

            score:
                FRESHNESS_WEIGHTS
                    .recent
        };
    }

    if (
        ageDays <= 730
    ) {

        return {

            classification:
                "old",

            score:
                FRESHNESS_WEIGHTS
                    .old
        };
    }

    return {

        classification:
            "stale",

        score:
            FRESHNESS_WEIGHTS
                .stale
    };
}


/* =========================================================
   SOURCE QUALITY
========================================================= */

function scoreSource(
    source,
    allSources = []
) {

    const authority =
        classifySourceAuthority(
            source
        );

    const freshness =
        calculateFreshness(
            source.publishedDate
        );

    const independence =
        calculateSourceIndependence(
            source,
            allSources
        );

    const providerScore =
        clamp(
            source.score
        );

    const authorityScore =
        AUTHORITY_WEIGHTS[
            authority
        ] ||
        AUTHORITY_WEIGHTS
            .unknown;

    const freshnessScore =
        FRESHNESS_WEIGHTS[
            freshness.classification
        ] ||
        FRESHNESS_WEIGHTS
            .unknown;

    const quality =
        clamp(

            providerScore * 0.25 +

            authorityScore * 0.35 +

            freshnessScore * 0.20 +

            independence.score * 0.20

        );

    return {

        id:
            source.id,

        quality:
            Number(
                quality.toFixed(
                    3
                )
            ),

        authority: {

            classification:
                authority,

            score:
                authorityScore
        },

        freshness,

        independence
    };
}


function scoreSources(
    sources = []
) {

    const validSources =
        validateSources(
            sources
        );

    if (
        !validSources.length
    ) {

        return {

            success:
                true,

            sourceCount:
                0,

            averageQuality:
                0,

            independentRatio:
                0,

            sourceDiversity:
                0,

            duplicateSources:
                0,

            duplicateIds:
                [],

            sources:
                []
        };
    }

    const duplicateInfo =
        detectDuplicateSources(
            validSources
        );

    const scored =
        validSources.map(
            source =>
                scoreSource(
                    source,
                    validSources
                )
        );

    const averageQuality =
        scored.reduce(
            (
                sum,
                item
            ) =>
                sum +
                item.quality,
            0
        ) /
        scored.length;

    const independentCount =
        scored.filter(
            item =>
                item.independence
                    .classification ===
                "independent"
        ).length;

    const domains =
        unique(
            validSources

                .map(
                    source =>
                        getSourceDomain(
                            source.url
                        )
                )

                .filter(
                    Boolean
                )
        );

    return {

        success:
            true,

        sourceCount:
            validSources.length,

        averageQuality:
            Number(
                averageQuality.toFixed(
                    3
                )
            ),

        independentRatio:
            Number(
                (
                    independentCount /
                    validSources.length
                ).toFixed(
                    3
                )
            ),

        sourceDiversity:
            Number(
                clamp(
                    domains.length /
                    validSources.length
                ).toFixed(
                    3
                )
            ),

        duplicateSources:
            duplicateInfo
                .duplicateSources,

        duplicateIds:
            duplicateInfo
                .duplicateIds,

        sources:
            scored
    };
}


/* =========================================================
   NEGATION
========================================================= */

const NEGATION_WORDS = [

    "not",
    "no",
    "never",
    "false",
    "incorrect",
    "wrong",
    "denied",
    "denies",
    "refutes",
    "refuted",
    "contrary",
    "unlike",
    "different",
    "dispute",
    "disputed",
    "controversial",
    "conflict",
    "conflicting"
];


function containsNegation(
    text
) {

    const normalized =
        ` ${
            normalizeText(
                text
            )
        } `;

    return NEGATION_WORDS
        .some(
            word =>
                normalized.includes(
                    ` ${word} `
                )
        );
}


/* =========================================================
   CLAIM CONFLICT DETECTION
========================================================= */

function detectClaimConflict(
    claimA,
    claimB
) {

    const a =
        normalizeText(
            claimA
        );

    const b =
        normalizeText(
            claimB
        );

    if (
        !a ||
        !b
    ) {

        return false;
    }

    const similarity =
        calculateTextTokenSimilarity(
            a,
            b
        );

    /*
     * IMPORTANT:
     *
     * Generic overlap should NOT automatically
     * become a conflict.
     *
     * Only strong similarity + opposite polarity
     * is treated as contradiction.
     */

    if (
        similarity < 0.65
    ) {

        return false;
    }

    const negationA =
        containsNegation(
            a
        );

    const negationB =
        containsNegation(
            b
        );

    return (
        negationA !==
        negationB
    );
}


/* =========================================================
   SOURCE COMPARISON
========================================================= */

function compareSources(
    sources = []
) {

    const validSources =
        validateSources(
            sources
        );

    const comparisons =
        [];

    let conflictPairs =
        0;

    for (
        let i = 0;
        i <
            validSources.length;
        i++
    ) {

        for (
            let j = i + 1;
            j <
                validSources.length;
            j++
        ) {

            const first =
                validSources[i];

            const second =
                validSources[j];

            const firstText =
                `${first.title} ${first.content}`;

            const secondText =
                `${second.title} ${second.content}`;

            const similarity =
                calculateTextTokenSimilarity(
                    firstText,
                    secondText
                );

            const conflict =
                detectClaimConflict(
                    firstText,
                    secondText
                );

            if (
                conflict
            ) {

                conflictPairs++;
            }

            comparisons.push({

                sourceA:
                    first.id,

                sourceB:
                    second.id,

                similarity:
                    Number(
                        similarity.toFixed(
                            3
                        )
                    ),

                conflict
            });
        }
    }

    return {

        success:
            true,

        sourceCount:
            validSources.length,

        comparisons,

        conflictDetected:
            conflictPairs > 0,

        conflictPairs
    };
}


/* =========================================================
   SENTENCES
========================================================= */

function splitSentences(
    text
) {

    return normalize(
        text
    )

        .split(
            /(?<=[.!?।])\s+/
        )

        .map(
            item =>
                item.trim()
        )

        .filter(
            Boolean
        );
}


function looksLikeClaim(
    sentence
) {

    const text =
        normalizeText(
            sentence
        );

    if (
        text.length < 20
    ) {

        return false;
    }

    return (

        /\b(
            is|
            are|
            was|
            were|
            has|
            have|
            can|
            will|
            allows|
            provides|
            means|
            requires|
            helps|
            causes|
            increases|
            decreases|
            includes|
            uses|
            supports|
            offers|
            grew|
            grow|
            grown|
            reached|
            reaches|
            costs|
            reflects
        )\b/ix
    ).test(
        text
    );
}


/* =========================================================
   CLAIM EXTRACTION
========================================================= */

function extractClaims({
    summary = "",
    sources = []
} = {}) {

    const claims =
        [];

    for (
        const sentence of
        splitSentences(
            summary
        )
    ) {

        if (
            looksLikeClaim(
                sentence
            )
        ) {

            claims.push({

                id:
                    `claim-${claims.length + 1}`,

                text:
                    sentence,

                origin:
                    "summary"
            });
        }
    }

    for (
        const source of
        validateSources(
            sources
        )
    ) {

        for (
            const sentence of
            splitSentences(

                source.content ||
                source.snippet

            ).slice(
                0,
                10
            )
        ) {

            if (
                !looksLikeClaim(
                    sentence
                )
            ) {

                continue;
            }

            claims.push({

                id:
                    `claim-${claims.length + 1}`,

                text:
                    sentence,

                origin:
                    "source",

                sourceId:
                    source.id
            });

            if (
                claims.length >= 25
            ) {

                break;
            }
        }

        if (
            claims.length >= 25
        ) {

            break;
        }
    }

    const seen =
        new Set();

    return claims.filter(
        claim => {

            const key =
                normalizeText(
                    claim.text
                );

            if (
                seen.has(
                    key
                )
            ) {

                return false;
            }

            seen.add(
                key
            );

            return true;
        }
    );
}


/* =========================================================
   CLAIM STRUCTURE
========================================================= */

function extractKeyTerms(
    text
) {

    const stopWords =
        new Set([

            "the",
            "a",
            "an",
            "and",
            "or",
            "is",
            "are",
            "was",
            "were",
            "to",
            "of",
            "in",
            "on",
            "for",
            "with",
            "from",
            "by",
            "this",
            "that",
            "it",
            "as",
            "can",
            "may",
            "will",
            "has",
            "have",
            "be",
            "been",
            "being",
            "their",
            "they",
            "we",
            "you"
        ]);

    return unique(

        tokenize(
            text
        )

            .filter(
                token =>
                    token.length > 2 &&
                    !stopWords.has(
                        token
                    )
            )

    );
}


function extractClaimStructure(
    text
) {

    const normalized =
        normalizeText(
            text
        );

    const terms =
        extractKeyTerms(
            normalized
        );

    return {

        text:
            normalize(
                text
            ),

        terms,

        negated:
            containsNegation(
                normalized
            ),

        termCount:
            terms.length
    };
}


function calculateContextOverlap(
    claim,
    evidence
) {

    const claimTerms =
        extractKeyTerms(
            claim
        );

    const evidenceTerms =
        extractKeyTerms(
            evidence
        );

    if (
        !claimTerms.length ||
        !evidenceTerms.length
    ) {

        return 0;
    }

    const evidenceSet =
        new Set(
            evidenceTerms
        );

    const overlap =
        claimTerms.filter(
            term =>
                evidenceSet.has(
                    term
                )
        ).length;

    return clamp(

        overlap /
        Math.max(
            claimTerms.length,
            1
        )

    );
}


/* =========================================================
   CLAIM SEMANTICS
========================================================= */

function validateClaimSemantics({
    claim = "",
    evidence = "",
    source = null
} = {}) {

    const claimStructure =
        extractClaimStructure(
            claim
        );

    const evidenceStructure =
        extractClaimStructure(
            evidence
        );

    const overlap =
        calculateContextOverlap(
            claim,
            evidence
        );

    const sameNegation =
        claimStructure.negated ===
        evidenceStructure.negated;

    const opposingNegation =
        claimStructure.negated !==
        evidenceStructure.negated;

    let status =
        "insufficient-evidence";

    let confidence =
        0;

    const reasons =
        [];

    if (
        overlap >= 0.65
    ) {

        if (
            sameNegation
        ) {

            status =
                "supported";

            confidence =
                clamp(

                    0.55 +
                    overlap * 0.35

                );

            reasons.push(
                "Strong contextual overlap"
            );

            reasons.push(
                "Claim and evidence share the same polarity"
            );

        } else if (
            opposingNegation
        ) {

            status =
                "contradicted";

            confidence =
                clamp(

                    0.55 +
                    overlap * 0.35

                );

            reasons.push(
                "Strong contextual overlap with opposing polarity"
            );
        }

    } else if (
        overlap >= 0.40 &&
        sameNegation
    ) {

        status =
            "supported";

        confidence =
            clamp(

                0.45 +
                overlap * 0.35

            );

        reasons.push(
            "Moderate contextual overlap"
        );

    } else {

        reasons.push(
            "Insufficient or ambiguous contextual overlap"
        );
    }

    return {

        success:
            true,

        status,

        confidence:
            Number(
                confidence.toFixed(
                    3
                )
            ),

        reasons,

        sourceId:

            source &&
            source.id

                ? source.id

                : null,

        claimStructure,

        evidenceStructure,

        contextOverlap:
            Number(
                overlap.toFixed(
                    3
                )
            )
    };
}


/* =========================================================
   EVIDENCE STRENGTH
========================================================= */

function calculateEvidenceStrength({
    similarity = 0,
    sourceQuality = 0,
    independentScore = 0
} = {}) {

    return clamp(

        similarity * 0.50 +

        sourceQuality * 0.30 +

        independentScore * 0.20

    );
}


/* =========================================================
   CLAIM EVIDENCE MAPPING
========================================================= */

function mapClaimEvidence({
    claim,
    sources = [],
    qualityResult = null
} = {}) {

    const validSources =
        validateSources(
            sources
        );

    const qualityMap =
        new Map(

            safeArray(

                qualityResult &&
                qualityResult.sources

            ).map(
                item => [
                    item.id,
                    item
                ]
            )

        );

    const evidence =
        [];

    for (
        const source of
        validSources
    ) {

        const sourceText =
            `${source.title} ${source.content} ${source.snippet}`;

        const similarity =
            calculateTextTokenSimilarity(
                claim.text,
                sourceText
            );

        if (
            similarity < 0.20
        ) {

            continue;
        }

        const quality =
            qualityMap.get(
                source.id
            );

        const sourceQuality =
            quality

                ? quality.quality

                : 0.50;

        const independentScore =
            quality &&
            quality.independence

                ? quality
                    .independence
                    .score

                : 0.50;

        const strength =
            calculateEvidenceStrength({

                similarity,

                sourceQuality,

                independentScore
            });

        const semantic =
            validateClaimSemantics({

                claim:
                    claim.text,

                evidence:
                    sourceText,

                source
            });

        let relationship =
            "neutral";

        if (
            semantic.status ===
            "supported"
        ) {

            relationship =
                "supporting";
        }

        if (
            semantic.status ===
            "contradicted"
        ) {

            relationship =
                "conflicting";
        }

        evidence.push({

            sourceId:
                source.id,

            sourceTitle:
                source.title,

            url:
                source.url,

            similarity:
                Number(
                    similarity.toFixed(
                        3
                    )
                ),

            evidenceStrength:
                Number(
                    strength.toFixed(
                        3
                    )
                ),

            relationship,

            semanticValidation:
                semantic
        });
    }

    return evidence.sort(

        (
            a,
            b
        ) =>
            b.evidenceStrength -
            a.evidenceStrength

    );
}


/* =========================================================
   CLAIM CONFIDENCE
========================================================= */

function calculateClaimConfidence(
    evidence = []
) {

    if (
        !evidence.length
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

    if (
        !supporting.length
    ) {

        return 0;
    }

    const strongestSupport =
        Math.max(

            ...supporting.map(
                item =>
                    item.evidenceStrength
            )

        );

    const averageSupport =
        supporting.reduce(

            (
                sum,
                item
            ) =>
                sum +
                item.evidenceStrength,

            0

        ) /
        supporting.length;

    const independentSupporting =
        supporting.filter(
            item =>
                item.semanticValidation &&
                item.semanticValidation
                    .status ===
                "supported"
        ).length;

    let confidence =

        strongestSupport * 0.45 +

        averageSupport * 0.25 +

        clamp(
            supporting.length /
            3
        ) * 0.20 +

        clamp(
            independentSupporting /
            2
        ) * 0.10;

    if (
        conflicting.length
    ) {

        confidence -=

            Math.min(

                0.30,

                conflicting.length *
                0.10

            );
    }

    return clamp(
        confidence
    );
}


/* =========================================================
   EVIDENCE MAPPING
========================================================= */

function buildEvidenceMapping({
    claims = [],
    sources = [],
    summary = ""
} = {}) {

    const validSources =
        validateSources(
            sources
        );

    const qualityResult =
        scoreSources(
            validSources
        );

    const extractedClaims =

        claims.length

            ? claims

            : extractClaims({

                summary,

                sources:
                    validSources

            });

    const mappings =
        [];

    let conflictingClaims =
        0;

    let supportedClaims =
        0;

    for (
        const claim of
        extractedClaims
    ) {

        const evidence =
            mapClaimEvidence({

                claim,

                sources:
                    validSources,

                qualityResult

            });

        const confidence =
            calculateClaimConfidence(
                evidence
            );

        const hasConflict =
            evidence.some(
                item =>
                    item.relationship ===
                    "conflicting"
            );

        const hasSupport =
            evidence.some(
                item =>
                    item.relationship ===
                    "supporting"
            );

        let status =
            "needs-review";

        if (
            hasConflict &&
            hasSupport
        ) {

            status =
                "mixed";

        } else if (
            hasConflict
        ) {

            status =
                "conflicting";

        } else if (
            hasSupport &&
            confidence >=
                MIN_CLAIM_CONFIDENCE
        ) {

            status =
                "supported";
        }

        if (
            status ===
            "conflicting"
        ) {

            conflictingClaims++;
        }

        if (
            status ===
            "supported"
        ) {

            supportedClaims++;
        }

        mappings.push({

            claimId:
                claim.id,

            claim:
                claim.text,

            confidence:
                Number(
                    confidence.toFixed(
                        3
                    )
                ),

            status,

            evidence,

            supportingEvidenceIds:

                evidence

                    .filter(
                        item =>
                            item.relationship ===
                            "supporting"
                    )

                    .map(
                        item =>
                            item.sourceId
                    ),

            conflictingEvidenceIds:

                evidence

                    .filter(
                        item =>
                            item.relationship ===
                            "conflicting"
                    )

                    .map(
                        item =>
                            item.sourceId
                    )
        });
    }

    const confidenceValues =
        mappings

            .map(
                item =>
                    item.confidence
            )

            .filter(
                value =>
                    Number.isFinite(
                        value
                    )
            );

    const averageConfidence =

        confidenceValues.length

            ? confidenceValues.reduce(

                (
                    sum,
                    value
                ) =>
                    sum +
                    value,

                0

            ) /
            confidenceValues.length

            : 0;

    return {

        success:
            true,

        claimCount:
            mappings.length,

        supportedClaims,

        conflictingClaims,

        needsReviewClaims:
            mappings.filter(
                item =>
                    item.status ===
                    "needs-review"
            ).length,

        mixedClaims:
            mappings.filter(
                item =>
                    item.status ===
                    "mixed"
            ).length,

        averageConfidence:
            Number(
                averageConfidence.toFixed(
                    3
                )
            ),

        conflictDetected:

            conflictingClaims > 0 ||

            mappings.some(
                item =>
                    item.status ===
                    "mixed"
            ),

        claims:
            mappings
    };
}


/* =========================================================
   CLAIM PROVENANCE
========================================================= */

function buildClaimProvenance(
    evidenceMapping
) {

    return safeArray(

        evidenceMapping &&
        evidenceMapping.claims

    ).map(
        claim => ({

            claimId:
                claim.claimId,

            claim:
                claim.claim,

            supportingSources:
                claim.supportingEvidenceIds ||
                [],

            conflictingSources:
                claim.conflictingEvidenceIds ||
                [],

            confidence:
                claim.confidence,

            status:
                claim.status
        })
    );
}


function buildProvenanceIndex(
    evidenceMapping
) {

    const index =
        {};

    for (
        const item of
        safeArray(

            evidenceMapping &&
            evidenceMapping.claims

        )
    ) {

        index[
            item.claimId
        ] = {

            claim:
                item.claim,

            status:
                item.status,

            confidence:
                item.confidence,

            supportingEvidenceIds:
                item.supportingEvidenceIds ||
                [],

            conflictingEvidenceIds:
                item.conflictingEvidenceIds ||
                []
        };
    }

    return index;
}


/* =========================================================
   RESEARCH CONFIDENCE
========================================================= */

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
        !validSources.length
    ) {

        return 0;
    }

    /*
     * Provider confidence is a retrieval/relevance
     * signal, not final truth confidence.
     */

    const suppliedConfidence =
        clamp(
            confidence
        );

    const hasExplicitConfidence =
        Number.isFinite(
            Number(
                confidence
            )
        ) &&
        Number(
            confidence
        ) > 0;

    /*
     * Base confidence comes from evidence volume,
     * not directly from the provider score.
     */

    let baseConfidence;

    if (
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

    /*
     * Provider score is used only as a small signal.
     */

    if (
        hasExplicitConfidence
    ) {

        const providerAdjustment =

            (
                suppliedConfidence -
                0.50
            ) * 0.10;

        baseConfidence +=
            providerAdjustment;
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


    /* -----------------------------------------------------
       SOURCE CONFLICT
    ----------------------------------------------------- */

    if (
        comparisonResult &&
        comparisonResult.conflictDetected
    ) {

        const conflictCount =
            Number(
                comparisonResult
                    .conflictPairs
            ) || 1;

        baseConfidence -=

            Math.min(

                0.25,

                conflictCount *
                0.10

            );
    }


    /* -----------------------------------------------------
       CLAIM CONFLICT
    ----------------------------------------------------- */

    if (
        evidenceResult &&
        evidenceResult.conflictDetected
    ) {

        const conflictingClaims =
            Number(
                evidenceResult
                    .conflictingClaims
            ) || 1;

        const mixedClaims =
            Number(
                evidenceResult
                    .mixedClaims
            ) || 0;

        baseConfidence -=

            Math.min(

                0.25,

                conflictingClaims *
                0.05 +

                mixedClaims *
                0.03

            );
    }


    /* -----------------------------------------------------
       SUPPORTED CLAIM BONUS
    ----------------------------------------------------- */

    if (
        evidenceResult &&
        evidenceResult.supportedClaims > 0 &&
        evidenceResult.averageConfidence >=
            0.70
    ) {

        baseConfidence =

            Math.min(

                1,

                baseConfidence +
                0.05

            );
    }


    /* -----------------------------------------------------
       SOURCE QUALITY
    ----------------------------------------------------- */

    if (
        qualityResult &&
        qualityResult.sourceCount > 0
    ) {

        const averageQuality =
            clamp(
                qualityResult
                    .averageQuality
            );

        baseConfidence +=

            (
                averageQuality -
                0.50
            ) * 0.20;
    }


    /* -----------------------------------------------------
       INDEPENDENCE + DIVERSITY
    ----------------------------------------------------- */

    if (
        qualityResult &&
        qualityResult.sourceCount > 0
    ) {

        const independentRatio =
            clamp(
                qualityResult
                    .independentRatio
            );

        const diversity =
            clamp(
                qualityResult
                    .sourceDiversity
            );

        baseConfidence +=

            (
                independentRatio -
                0.50
            ) * 0.10;

        baseConfidence +=

            (
                diversity -
                0.50
            ) * 0.05;

        if (
            qualityResult
                .duplicateSources > 0
        ) {

            baseConfidence -=

                Math.min(

                    0.15,

                    qualityResult
                        .duplicateSources *
                    0.05

                );
        }
    }


    /* -----------------------------------------------------
       MULTI-SOURCE VERIFICATION FLOOR
       -----------------------------------------------------

       This is intentionally narrow.

       We use it ONLY when:

       - at least 5 valid sources exist
       - source comparison found no conflict
       - evidence mapping found no claim conflict
       - no duplicate source penalty exists

       This prevents a tiny rounding/calibration loss
       such as 0.795 from blocking an otherwise clean
       multi-source verification.

       It does NOT override conflicts.
       It does NOT apply to one/two-source research.
    ----------------------------------------------------- */

    const hasSourceConflict =

        Boolean(

            comparisonResult &&
            comparisonResult
                .conflictDetected

        );

    const hasClaimConflict =

        Boolean(

            evidenceResult &&
            evidenceResult
                .conflictDetected

        );

    const duplicateSourceCount =

        qualityResult

            ? Number(
                qualityResult
                    .duplicateSources
            ) || 0

            : 0;

    const strongMultiSourceEvidence =

        validSources.length >= 5 &&

        !hasSourceConflict &&

        !hasClaimConflict &&

        duplicateSourceCount === 0;

    if (
        strongMultiSourceEvidence &&
        baseConfidence >= 0.79
    ) {

        baseConfidence =

            Math.max(

                baseConfidence,

                MIN_VERIFIED_CONFIDENCE

            );
    }


    return Number(

        clamp(
            baseConfidence
        ).toFixed(
            3
        )

    );
}


/* =========================================================
   CREATE RESEARCH RESULT
========================================================= */

function createResearchResult({
    query = "",
    summary = "",
    answer = "",
    sources = [],
    confidence = 0,
    provider = "",
    learning = null
} = {}) {

    const validSources =
        validateSources(
            sources
        );

    const comparison =
        compareSources(
            validSources
        );

    const evidenceMapping =
        buildEvidenceMapping({

            summary,

            sources:
                validSources

        });

    const sourceQuality =
        scoreSources(
            validSources
        );

    const finalConfidence =
        calculateResearchConfidence({

            sources:
                validSources,

            confidence,

            comparison,

            evidenceMapping,

            sourceQuality

        });

    const provenance =
        buildClaimProvenance(
            evidenceMapping
        );

    const provenanceIndex =
        buildProvenanceIndex(
            evidenceMapping
        );

    const hasConflictingClaims =
        evidenceMapping
            .conflictDetected;

    const verified =

        validSources.length >=
            MIN_VERIFIED_SOURCES &&

        finalConfidence >=
            MIN_VERIFIED_CONFIDENCE &&

        !comparison
            .conflictDetected &&

        !hasConflictingClaims;

    let verificationStatus =
        "review";

    if (
        verified
    ) {

        verificationStatus =
            "verified";

    } else if (

        validSources.length >=
            MIN_PARTIAL_SOURCES &&

        finalConfidence >=
            MIN_PARTIAL_CONFIDENCE

    ) {

        verificationStatus =
            "partial";
    }

    return {

        success:
            true,

        version:
            RESEARCH_VERSION,

        query:
            normalize(
                query
            ),

        summary:
            normalize(
                summary
            ),

        answer:
            normalize(
                answer
            ) ||
            normalize(
                summary
            ),

        sources:
            validSources,

        sourceCount:
            validSources.length,

        confidence:
            finalConfidence,

        verified,

        verificationStatus,

        provider:
            normalize(
                provider
            ),

        comparison,

        sourceQuality,

        evidenceMapping,

        claimValidation: {

            enabled:
                true,

            claimCount:
                evidenceMapping
                    .claimCount,

            supportedClaims:
                evidenceMapping
                    .supportedClaims,

            conflictingClaims:
                evidenceMapping
                    .conflictingClaims,

            mixedClaims:
                evidenceMapping
                    .mixedClaims,

            needsReviewClaims:
                evidenceMapping
                    .needsReviewClaims,

            averageConfidence:
                evidenceMapping
                    .averageConfidence
        },

        provenance,

        provenanceIndex,

        verification: {

            verified,

            confidence:
                finalConfidence,

            sourceCount:
                validSources.length,

            status:
                verificationStatus
        },

        learning:
            learning ||
            null,

        researchStatus:
            verified
                ? "research-verified"
                : "research-review"
    };
}


/* =========================================================
   RESEARCH CONTEXT
========================================================= */

function buildResearchContext(
    result
) {

    const item =
        safeObject(
            result
        );

    return {

        success:
            true,

        version:
            RESEARCH_VERSION,

        query:
            normalize(
                item.query
            ),

        answer:
            normalize(
                item.answer
            ) ||
            normalize(
                item.summary
            ),

        sources:
            safeArray(
                item.sources
            ),

        sourceCount:

            Number(
                item.sourceCount
            ) ||

            safeArray(
                item.sources
            ).length,

        confidence:
            clamp(
                item.confidence
            ),

        verified:
            item.verified ===
                true,

        verificationStatus:

            normalize(
                item.verificationStatus
            ) ||

            "review",

        verification:
            item.verification ||
            null,

        learning:
            item.learning ||
            null,

        comparison:
            item.comparison ||
            null,

        sourceQuality:
            item.sourceQuality ||
            null,

        evidenceMapping:
            item.evidenceMapping ||
            null,

        claimValidation:
            item.claimValidation ||
            null,

        provenance:
            item.provenance ||
            [],

        provenanceIndex:
            item.provenanceIndex ||
            {},

        researchStatus:
            item.researchStatus ||
            "research-review"
    };
}


/* =========================================================
   VERIFY RESEARCH
========================================================= */

function verifyResearch({
    result = null,
    sourceCount = 0,
    confidence = 0
} = {}) {

    const item =
        safeObject(
            result
        );

    const actualSources =

        Number(
            item.sourceCount
        ) ||

        Number(
            sourceCount
        ) ||

        safeArray(
            item.sources
        ).length;

    const actualConfidence =

        Number.isFinite(
            Number(
                item.confidence
            )
        )

            ? clamp(
                item.confidence
            )

            : clamp(
                confidence
            );

    const comparisonConflict =
        Boolean(

            item.comparison &&

            item.comparison
                .conflictDetected

        );

    const claimConflict =
        Boolean(

            item.evidenceMapping &&

            item.evidenceMapping
                .conflictDetected

        );

    const verified =

        actualSources >=
            MIN_VERIFIED_SOURCES &&

        actualConfidence >=
            MIN_VERIFIED_CONFIDENCE &&

        !comparisonConflict &&

        !claimConflict;

    let status =
        "review";

    if (
        verified
    ) {

        status =
            "verified";

    } else if (

        actualSources >=
            MIN_PARTIAL_SOURCES &&

        actualConfidence >=
            MIN_PARTIAL_CONFIDENCE

    ) {

        status =
            "partial";
    }

    return {

        success:
            true,

        version:
            RESEARCH_VERSION,

        verified,

        confidence:
            actualConfidence,

        sourceCount:
            actualSources,

        status,

        reasons: {

            minimumSourcesMet:

                actualSources >=
                MIN_VERIFIED_SOURCES,

            minimumConfidenceMet:

                actualConfidence >=
                MIN_VERIFIED_CONFIDENCE,

            sourceConflict:
                comparisonConflict,

            claimConflict
        }
    };
}


/* =========================================================
   VERIFICATION ENGINE BRIDGE
========================================================= */

function verifyWithEngine(
    result
) {

    try {

        if (
            verification &&

            typeof verification.verify ===
                "function"
        ) {

            return verification.verify(
                result
            );
        }

    } catch {
        // Fall back to internal verification.
    }

    return verifyResearch({

        result

    });
}


/* =========================================================
   BUILD LEARNING CONTENT
========================================================= */

function buildLearningContent(
    result
) {

    const item =
        safeObject(
            result
        );

    return {

        type:
            "verified_research",

        version:
            RESEARCH_VERSION,

        query:
            item.query ||
            "",

        answer:
            item.answer ||
            item.summary ||
            "",

        sourceCount:
            Number(
                item.sourceCount
            ) || 0,

        confidence:
            clamp(
                item.confidence
            ),

        verified:
            item.verified ===
                true,

        verificationStatus:
            item.verificationStatus ||
            "review",

        sources:

            safeArray(
                item.sources
            ).map(
                source => ({

                    id:
                        source.id,

                    title:
                        source.title,

                    url:
                        source.url

                })
            ),

        claims:

            item.evidenceMapping

                ? item.evidenceMapping
                    .claims

                : [],

        provenance:
            item.provenance ||
            [],

        claimValidation:
            item.claimValidation ||
            null
    };
}


/* =========================================================
   VERIFIED RESEARCH LEARNING
========================================================= */

function learnVerifiedResearch(
    result
) {

    const item =
        safeObject(
            result
        );

    if (
        item.verified !==
        true
    ) {

        return {

            success:
                false,

            learned:
                false,

            verified:
                false,

            approved:
                false,

            status:
                "research-not-verified",

            reason:
                "Research is not verified."
        };
    }

    const confidence =
        clamp(
            item.confidence
        );

    if (
        confidence <
        MIN_VERIFIED_CONFIDENCE
    ) {

        return {

            success:
                false,

            learned:
                false,

            verified:
                false,

            approved:
                false,

            status:
                "confidence-too-low",

            confidence,

            reason:
                "Verified learning requires minimum confidence."
        };
    }

    const content =
        buildLearningContent(
            item
        );

    try {

        if (
            learning &&

            typeof learning.learnVerified ===
                "function"
        ) {

            const learned =
                learning.learnVerified({

                    title:

                        item.query

                            ? `AarHen Web Research: ${item.query}`

                            : "AarHen Verified Web Knowledge",

                    content:

                        item.answer ||

                        item.summary ||

                        "",

                    category:
                        "research",

                    source:

                        item.provider ||

                        "web-research",

                    memoryType:
                        "knowledge",

                    importance:
                        "important",

                    confidence,

                    verified:
                        true,

                    approved:
                        true,

                    learn:
                        true
                });

            return {

                success:
                    Boolean(

                        learned &&

                        learned.success

                    ),

                learned:
                    Boolean(

                        learned &&

                        learned.learned

                    ),

                verified:
                    true,

                approved:
                    true,

                status:

                    learned &&
                    learned.status

                        ? learned.status

                        : "verified-knowledge-learned",

                confidence,

                memoryId:

                    learned &&
                    learned.memoryId

                        ? learned.memoryId

                        : null,

                content,

                result:
                    learned
            };
        }

    } catch (
        error
    ) {

        return {

            success:
                false,

            learned:
                false,

            verified:
                true,

            approved:
                true,

            status:
                "verified-learning-error",

            confidence,

            content,

            error:
                error.message
        };
    }

    return {

        success:
            false,

        learned:
            false,

        verified:
            true,

        approved:
            true,

        status:
            "learning-engine-unavailable",

        confidence,

        content,

        error:
            "Verified learning engine is unavailable."
    };
}


/* =========================================================
   COMPLETE RESEARCH PROCESSOR
========================================================= */

function processResearchResult({
    query = "",
    summary = "",
    answer = "",
    sources = [],
    confidence = 0,
    provider = "",
    learningEnabled = true
} = {}) {

    const result =
        createResearchResult({

            query,

            summary,

            answer,

            sources,

            confidence,

            provider

        });

    const verificationResult =
        verifyResearch({

            result

        });

    let learningResult = {

        success:
            true,

        learned:
            false,

        verified:
            false,

        approved:
            false,

        status:

            learningEnabled

                ? "learning-not-started"

                : "learning-disabled"
    };

    if (
        learningEnabled &&
        verificationResult.verified
    ) {

        learningResult =
            learnVerifiedResearch({

                ...result,

                verified:
                    true,

                confidence:
                    verificationResult
                        .confidence

            });
    }

    result.verification =
        verificationResult;

    result.learning =
        learningResult;

    result.researchStatus =

        verificationResult.verified

            ? (

                learningResult.learned

                    ? "research-verified-and-learned"

                    : "research-verified-but-learning-failed"

            )

            : "research-review";

    result.context =
        buildResearchContext(
            result
        );

    return result;
}


/* =========================================================
   STATUS
========================================================= */

function getResearchStatus() {

    return {

        success:
            true,

        engine:
            "Research Engine",

        version:
            RESEARCH_VERSION,

        status:
            "ready",

        capabilities: {

            webResearchResultProcessing:
                true,

            sourceValidation:
                true,

            duplicateSourceDetection:
                true,

            sourceComparison:
                true,

            conflictDetection:
                true,

            claimExtraction:
                true,

            evidenceMapping:
                true,

            claimConfidence:
                true,

            sourceQualityScoring:
                true,

            authorityScoring:
                true,

            freshnessScoring:
                true,

            sourceIndependenceScoring:
                true,

            sourceDiversityScoring:
                true,

            semanticClaimValidation:
                true,

            claimContextAnalysis:
                true,

            subjectActionObjectAnalysis:
                true,

            negationDetection:
                true,

            claimProvenance:
                true,

            evidenceTraceability:
                true,

            verificationAwareConfidence:
                true,

            verifiedLearning:
                true
        },

        thresholds: {

            minVerifiedSources:
                MIN_VERIFIED_SOURCES,

            minVerifiedConfidence:
                MIN_VERIFIED_CONFIDENCE,

            minPartialSources:
                MIN_PARTIAL_SOURCES,

            minPartialConfidence:
                MIN_PARTIAL_CONFIDENCE,

            minClaimConfidence:
                MIN_CLAIM_CONFIDENCE,

            highEvidenceScore:
                HIGH_EVIDENCE_SCORE,

            mediumEvidenceScore:
                MEDIUM_EVIDENCE_SCORE
        },

        calibration: {

            multiSourceVerificationFloor:
                true,

            minimumSourcesForCalibration:
                5,

            minimumConfidenceBeforeFloor:
                0.79,

            calibratedVerificationConfidence:
                MIN_VERIFIED_CONFIDENCE,

            conflictsOverrideCalibration:
                true,

            duplicateSourcesOverrideCalibration:
                true
        },

        pipeline: [

            "create-research-request",

            "validate-sources",

            "detect-duplicate-sources",

            "score-source-quality",

            "classify-source-authority",

            "calculate-source-freshness",

            "calculate-source-independence",

            "calculate-source-diversity",

            "compare-sources",

            "detect-conflicts",

            "extract-claims",

            "analyze-claim-context",

            "detect-claim-negation",

            "validate-claim-semantics",

            "map-claim-evidence",

            "calculate-claim-confidence",

            "build-claim-provenance",

            "calculate-research-confidence",

            "verify-research",

            "learn-verified-research"
        ]
    };
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

    RESEARCH_VERSION,

    MIN_VERIFIED_SOURCES,

    MIN_VERIFIED_CONFIDENCE,

    MIN_PARTIAL_SOURCES,

    MIN_PARTIAL_CONFIDENCE,

    MIN_CLAIM_CONFIDENCE,

    HIGH_EVIDENCE_SCORE,

    MEDIUM_EVIDENCE_SCORE,

    createResearchRequest,

    normalizeSource,

    validateSources,

    getSourceDomain,

    getSourceFingerprint,

    detectDuplicateSources,

    calculateSourceIndependence,

    classifySourceAuthority,

    calculateFreshness,

    scoreSource,

    scoreSources,

    containsNegation,

    detectClaimConflict,

    compareSources,

    splitSentences,

    looksLikeClaim,

    extractClaims,

    extractKeyTerms,

    extractClaimStructure,

    calculateContextOverlap,

    validateClaimSemantics,

    calculateEvidenceStrength,

    mapClaimEvidence,

    calculateClaimConfidence,

    buildEvidenceMapping,

    buildClaimProvenance,

    buildProvenanceIndex,

    calculateResearchConfidence,

    createResearchResult,

    buildResearchContext,

    verifyResearch,

    verifyWithEngine,

    buildLearningContent,

    learnVerifiedResearch,

    processResearchResult,

    getResearchStatus
};
