/**
 * AARHEN CORE v5
 * Research Engine
 *
 * Version: 5.5.5
 *
 * FOCUS:
 * - False claim-conflict prevention
 * - Sentence-level evidence analysis
 * - Faster research verification
 * - Safer verified learning
 * - Provider score treated as retrieval signal
 * - Multi-source verification
 */

const verification =
    require("../core/verification");

const learning =
    require("../core/learning");


/* =========================================================
   VERSION
========================================================= */

const RESEARCH_VERSION =
    "5.5.5";


/* =========================================================
   VERIFICATION THRESHOLDS
========================================================= */

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
   PERFORMANCE LIMITS
========================================================= */

const MAX_CLAIMS =
    12;

const MAX_EVIDENCE_SENTENCES =
    3;

const MAX_SOURCE_SENTENCES =
    8;

const MAX_SOURCE_CONTENT_LENGTH =
    6000;


/* =========================================================
   AUTHORITY WEIGHTS
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


/* =========================================================
   FRESHNESS WEIGHTS
========================================================= */

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


/* =========================================================
   INDEPENDENCE WEIGHTS
========================================================= */

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

    const text =
        normalizeText(
            value
        );

    if (
        !text
    ) {

        return [];
    }

    return text
        .split(
            /\s+/
        )
        .filter(
            Boolean
        );
}


function getUniqueTokens(
    value
) {

    return unique(
        tokenize(
            value
        )
    );
}


function calculateTextTokenSimilarity(
    a,
    b
) {

    const tokensA =
        getUniqueTokens(
            a
        );

    const tokensB =
        getUniqueTokens(
            b
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
            true,

        sentenceLevelEvidence:
            true,

        performanceOptimized:
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

    if (
        !text
    ) {

        return "";
    }

    const markdown =
        text.match(
            /\]\((https?:\/\/[^)]+)\)/i
        );

    if (
        markdown &&
        markdown[1]
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


    let content =

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


    if (
        content.length >
        MAX_SOURCE_CONTENT_LENGTH
    ) {

        content =
            content.slice(
                0,
                MAX_SOURCE_CONTENT_LENGTH
            );
    }


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
   SOURCE FINGERPRINT
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


/* =========================================================
   DUPLICATE DETECTION
========================================================= */

function detectDuplicateSources(
    sources = []
) {

    const validSources =
        validateSources(
            sources
        );

    const fingerprints =
        new Map();

    const duplicateIds =
        [];

    for (
        const source of
        validSources
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

    let sameDomainCount =
        0;

    for (
        const item of
        safeArray(
            allSources
        )
    ) {

        if (
            getSourceDomain(
                item &&
                item.url
            ) ===
            domain
        ) {

            sameDomainCount++;
        }
    }

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

            providerScore *
            0.25 +

            authorityScore *
            0.35 +

            freshnessScore *
            0.20 +

            independence.score *
            0.20

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


/* =========================================================
   PREPARED SOURCE SCORING
========================================================= */

function scorePreparedSources(
    validSources
) {

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


    let totalQuality =
        0;

    let independentCount =
        0;


    for (
        const item of
        scored
    ) {

        totalQuality +=
            item.quality;

        if (
            item.independence
                .classification ===
            "independent"
        ) {

            independentCount++;
        }
    }


    const averageQuality =

        scored.length

            ? totalQuality /
              scored.length

            : 0;


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


function scoreSources(
    sources = []
) {

    return scorePreparedSources(
        validateSources(
            sources
        )
    );
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


    for (
        const word of
        NEGATION_WORDS
    ) {

        if (
            normalized.includes(
                ` ${word} `
            )
        ) {

            return true;
        }
    }


    return false;
}


/* =========================================================
   CLAIM CONFLICT
   ---------------------------------------------------------
   IMPORTANT:
   Conflict is sentence-level.
   Whole-page/source negation is NOT enough.
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


    if (
        similarity < 0.70
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
   SENTENCE SPLITTER
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
            item =>
                item.length > 0
        );
}


/* =========================================================
   CLAIM DETECTOR
========================================================= */

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


    return /\b(is|are|was|were|has|have|can|will|allows|provides|means|requires|helps|causes|increases|decreases|includes|uses|supports|offers|grew|grow|grown|reached|reaches|costs|reflects|focuses|focused|driven|important|crucial)\b/i
        .test(
            text
        );
}


/* =========================================================
   CLAIM EXTRACTION
   ---------------------------------------------------------
   SUMMARY-FIRST MODEL
   ---------------------------------------------------------
   If summary exists:
   - verify summary claims against sources
   - do not treat every source sentence as a claim
   - reduces false contradiction detection
========================================================= */

function extractClaims({
    summary = "",
    sources = []
} = {}) {

    const claims =
        [];

    const summarySentences =
        splitSentences(
            summary
        );


    for (
        const sentence of
        summarySentences
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
                "summary"
        });


        if (
            claims.length >=
            MAX_CLAIMS
        ) {

            break;
        }
    }


    /*
     * Fallback:
     * only use source claims when the provider
     * did not give a usable summary.
     */

    if (
        claims.length === 0
    ) {

        for (
            const source of
            validateSources(
                sources
            )
        ) {

            const sentences =
                splitSentences(

                    source.content ||
                    source.snippet

                ).slice(

                    0,
                    MAX_SOURCE_SENTENCES

                );


            for (
                const sentence of
                sentences
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
                    claims.length >=
                    MAX_CLAIMS
                ) {

                    break;
                }
            }


            if (
                claims.length >=
                MAX_CLAIMS
            ) {

                break;
            }
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
   CLAIM TERMS
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
            "you",
            "about",
            "into",
            "than",
            "also"

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


/* =========================================================
   CLAIM STRUCTURE
========================================================= */

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


/* =========================================================
   CONTEXT OVERLAP
========================================================= */

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


    let overlap =
        0;


    for (
        const term of
        claimTerms
    ) {

        if (
            evidenceSet.has(
                term
            )
        ) {

            overlap++;
        }
    }


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
   ---------------------------------------------------------
   IMPORTANT:
   This function receives ONE relevant sentence,
   not a complete web page.
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


    /*
     * Very strong contextual match.
     */

    if (
        overlap >= 0.70
    ) {

        if (
            sameNegation
        ) {

            status =
                "supported";

            confidence =
                clamp(

                    0.58 +
                    overlap *
                    0.34

                );


            reasons.push(
                "Strong contextual overlap."
            );

            reasons.push(
                "Claim and evidence share the same polarity."
            );

        } else if (
            opposingNegation
        ) {

            status =
                "contradicted";

            confidence =
                clamp(

                    0.60 +
                    overlap *
                    0.30

                );


            reasons.push(
                "Strong contextual overlap with opposite polarity."
            );
        }

    }


    /*
     * Moderate contextual match.
     *
     * Moderate overlap + polarity difference is
     * treated as ambiguous rather than contradiction.
     */

    else if (
        overlap >= 0.45 &&
        sameNegation
    ) {

        status =
            "supported";

        confidence =
            clamp(

                0.46 +
                overlap *
                0.34

            );


        reasons.push(
            "Moderate contextual overlap."
        );

    }


    else {

        status =
            "insufficient-evidence";

        confidence =
            0;


        reasons.push(
            "Evidence sentence is not sufficiently specific to the claim."
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

        similarity *
        0.50 +

        sourceQuality *
        0.30 +

        independentScore *
        0.20

    );
}


/* =========================================================
   RELEVANT EVIDENCE SENTENCE SELECTION
========================================================= */

function getRelevantEvidenceSentences(
    claimText,
    source
) {

    const rawText =

        source.content ||
        source.snippet ||
        "";


    const sentences =
        splitSentences(
            rawText
        )

            .slice(
                0,
                MAX_SOURCE_SENTENCES
            );


    if (
        !sentences.length
    ) {

        return [];
    }


    const ranked =
        sentences.map(
            sentence => ({

                sentence,

                similarity:

                    calculateTextTokenSimilarity(
                        claimText,
                        sentence
                    ),

                overlap:

                    calculateContextOverlap(
                        claimText,
                        sentence
                    )

            })

        )

            .filter(
                item =>
                    item.similarity >=
                        0.15 ||
                    item.overlap >=
                        0.20
            )

            .sort(
                (
                    a,
                    b
                ) => (

                    (
                        b.overlap *
                        0.70
                    ) +

                    (
                        b.similarity *
                        0.30
                    )

                ) - (

                    (
                        a.overlap *
                        0.70
                    ) +

                    (
                        a.similarity *
                        0.30
                    )
                )
            );


    return ranked

        .slice(
            0,
            MAX_EVIDENCE_SENTENCES
        );
}


/* =========================================================
   MAP CLAIM EVIDENCE
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


    return mapClaimEvidencePrepared({

        claim,

        sources:
            validSources,

        qualityResult

    });
}


function mapClaimEvidencePrepared({
    claim,
    sources = [],
    qualityResult = null
} = {}) {

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
        sources
    ) {

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


        /*
         * IMPORTANT:
         * Compare the claim only with relevant
         * source sentences.
         */

        const candidateSentences =
            getRelevantEvidenceSentences(

                claim.text,

                source

            );


        for (
            const candidate of
            candidateSentences
        ) {

            const similarity =
                candidate.similarity;


            const overlap =
                candidate.overlap;


            if (
                similarity < 0.15 &&
                overlap < 0.20
            ) {

                continue;
            }


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
                        candidate.sentence,

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

                evidenceSentence:
                    candidate.sentence,

                similarity:
                    Number(
                        similarity.toFixed(
                            3
                        )
                    ),

                contextOverlap:
                    Number(
                        overlap.toFixed(
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
    }


    /*
     * Keep only strongest evidence per source.
     *
     * This prevents many duplicated sentences from
     * artificially influencing the claim result.
     */

    const bestBySource =
        new Map();


    for (
        const item of
        evidence
    ) {

        const current =
            bestBySource.get(
                item.sourceId
            );


        if (
            !current ||
            item.evidenceStrength >
                current.evidenceStrength
        ) {

            bestBySource.set(
                item.sourceId,
                item
            );
        }
    }


    return Array.from(
        bestBySource.values()
    ).sort(

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


    let strongestSupport =
        0;

    let totalSupport =
        0;


    for (
        const item of
        supporting
    ) {

        const strength =
            Number(
                item.evidenceStrength
            ) || 0;


        strongestSupport =
            Math.max(
                strongestSupport,
                strength
            );


        totalSupport +=
            strength;
    }


    const averageSupport =
        totalSupport /
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

        strongestSupport *
        0.45 +

        averageSupport *
        0.25 +

        clamp(
            supporting.length /
            3
        ) *
        0.20 +

        clamp(
            independentSupporting /
            2
        ) *
        0.10;


    /*
     * Conflicting evidence reduces confidence,
     * but only when the evidence sentence itself
     * contradicted the claim.
     */

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
   BUILD EVIDENCE MAPPING
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


    return buildEvidenceMappingPrepared({

        claims,

        sources:
            validSources,

        summary

    });
}


function buildEvidenceMappingPrepared({
    claims = [],
    sources = [],
    summary = ""
} = {}) {

    const qualityResult =
        scorePreparedSources(
            sources
        );


    const extractedClaims =

        claims.length

            ? claims.slice(
                0,
                MAX_CLAIMS
            )

            : extractClaims({

                summary,

                sources

            });


    const mappings =
        [];

    let conflictingClaims =
        0;

    let supportedClaims =
        0;

    let totalClaimConfidence =
        0;


    for (
        const claim of
        extractedClaims
    ) {

        const evidence =
            mapClaimEvidencePrepared({

                claim,

                sources,

                qualityResult

            });


        const confidence =
            calculateClaimConfidence(
                evidence
            );


        /*
         * A claim is conflicting only if the
         * strongest evidence set contains a
         * direct sentence-level contradiction.
         */

        const conflictingEvidence =
            evidence.filter(

                item =>
                    item.relationship ===
                    "conflicting"

            );


        const supportingEvidence =
            evidence.filter(

                item =>
                    item.relationship ===
                    "supporting"

            );


        const hasConflict =
            conflictingEvidence.length >
            0;


        const hasSupport =
            supportingEvidence.length >
            0;


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


        totalClaimConfidence +=
            confidence;


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

                supportingEvidence.map(
                    item =>
                        item.sourceId
                ),

            conflictingEvidenceIds:

                conflictingEvidence.map(
                    item =>
                        item.sourceId
                )
        });
    }


    const averageConfidence =

        mappings.length

            ? totalClaimConfidence /
              mappings.length

            : 0;


    const mixedClaims =
        mappings.filter(
            item =>
                item.status ===
                "mixed"
        ).length;


    const needsReviewClaims =
        mappings.filter(
            item =>
                item.status ===
                "needs-review"
        ).length;


    /*
     * IMPORTANT:
     *
     * "mixed" is review-worthy but not automatically
     * treated as a hard contradiction.
     *
     * Hard conflict = only actual conflicting claim.
     */

    return {

        success:
            true,

        claimCount:
            mappings.length,

        supportedClaims,

        conflictingClaims,

        needsReviewClaims,

        mixedClaims,

        averageConfidence:
            Number(
                averageConfidence.toFixed(
                    3
                )
            ),

        conflictDetected:
            conflictingClaims > 0,

        claims:
            mappings
    };
}


/* =========================================================
   PROVENANCE
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
     * Provider score = small retrieval signal only.
     */

    if (
        hasExplicitConfidence
    ) {

        baseConfidence +=

            (
                suppliedConfidence -
                0.50
            ) *
            0.10;
    }


    const comparisonResult =
        comparison ||
        comparePreparedSources(
            validSources
        );


    const evidenceResult =
        evidenceMapping ||
        buildEvidenceMappingPrepared({

            sources:
                validSources

        });


    const qualityResult =
        sourceQuality ||
        scorePreparedSources(
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
                0.015

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

        baseConfidence +=

            (
                clamp(
                    qualityResult.averageQuality
                ) -
                0.50
            ) *
            0.20;


        baseConfidence +=

            (
                clamp(
                    qualityResult.independentRatio
                ) -
                0.50
            ) *
            0.10;


        baseConfidence +=

            (
                clamp(
                    qualityResult.sourceDiversity
                ) -
                0.50
            ) *
            0.05;


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
       SAFE MULTI-SOURCE CALIBRATION
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


    const averageQuality =

        qualityResult

            ? clamp(
                qualityResult
                    .averageQuality
            )

            : 0;


    const independentRatio =

        qualityResult

            ? clamp(
                qualityResult
                    .independentRatio
            )

            : 0;


    const sourceDiversity =

        qualityResult

            ? clamp(
                qualityResult
                    .sourceDiversity
            )

            : 0;


    const strongMultiSourceEvidence =

        validSources.length >= 5 &&

        !hasSourceConflict &&

        !hasClaimConflict &&

        duplicateSourceCount === 0 &&

        averageQuality >= 0.60 &&

        independentRatio >= 0.50 &&

        sourceDiversity >= 0.60;


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
   PREPARED SOURCE COMPARISON
========================================================= */

function comparePreparedSources(
    validSources
) {

    const comparisons =
        [];

    let conflictPairs =
        0;


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

            const first =
                validSources[i];

            const second =
                validSources[j];


            /*
             * Compare titles first.
             * This is faster than comparing huge source bodies.
             */

            const firstTitle =
                first.title ||
                "";

            const secondTitle =
                second.title ||
                "";


            const titleSimilarity =
                calculateTextTokenSimilarity(

                    firstTitle,

                    secondTitle

                );


            let conflict =
                false;


            /*
             * Only perform deeper conflict analysis
             * when titles are meaningfully related.
             */

            if (
                titleSimilarity >= 0.45
            ) {

                const firstSentences =
                    splitSentences(

                        first.content ||
                        first.snippet

                    ).slice(
                        0,
                        4
                    );


                const secondSentences =
                    splitSentences(

                        second.content ||
                        second.snippet

                    ).slice(
                        0,
                        4
                    );


                for (
                    const firstSentence of
                    firstSentences
                ) {

                    for (
                        const secondSentence of
                        secondSentences
                    ) {

                        if (
                            detectClaimConflict(

                                firstSentence,

                                secondSentence

                            )
                        ) {

                            conflict =
                                true;

                            break;
                        }
                    }


                    if (
                        conflict
                    ) {

                        break;
                    }
                }
            }


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

                titleSimilarity:
                    Number(
                        titleSimilarity.toFixed(
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


function compareSources(
    sources = []
) {

    return comparePreparedSources(

        validateSources(
            sources
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

    /*
     * Normalize only once.
     */

    const validSources =
        validateSources(
            sources
        );


    /*
     * Research confidence pipeline.
     */

    const comparison =
        comparePreparedSources(
            validSources
        );


    const evidenceMapping =
        buildEvidenceMappingPrepared({

            summary,

            sources:
                validSources

        });


    const sourceQuality =
        scorePreparedSources(
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


    const sources =
        safeArray(
            item.sources
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

        sources,

        sourceCount:

            Number(
                item.sourceCount
            ) ||

            sources.length,

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

        /*
         * Internal verification fallback.
         */
    }


    return verifyResearch({

        result

    });
}


/* =========================================================
   LEARNING CONTENT
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
   ---------------------------------------------------------
   IMPORTANT:
   Executor does not always pass verified:true.
   Therefore this function performs an internal
   verification before allowing learning.
========================================================= */

function learnVerifiedResearch(
    result
) {

    const item =
        safeObject(
            result
        );


    /*
     * Rebuild verification internally.
     */

    let verificationResult;

    try {

        verificationResult =
            verifyResearch({

                result:

                    createResearchResult({

                        query:
                            item.query ||
                            "",

                        summary:
                            item.summary ||
                            item.answer ||
                            "",

                        answer:
                            item.answer ||
                            item.summary ||
                            "",

                        sources:
                            item.sources ||
                            [],

                        confidence:

                            Number.isFinite(
                                Number(
                                    item.confidence
                                )
                            )

                                ? item.confidence

                                : 0,

                        provider:
                            item.provider ||
                            "web-research"

                    })

            });

    } catch (
        error
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
                "verification-error",

            error:
                error.message
        };
    }


    /*
     * Do not learn unless internal verification passes.
     */

    if (
        verificationResult.verified !==
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

            confidence:
                verificationResult
                    .confidence,

            verification:
                verificationResult,

            reason:
                "Research must pass internal verification before learning."
        };
    }


    const verifiedResult =
        createResearchResult({

            query:
                item.query ||
                "",

            summary:
                item.summary ||
                item.answer ||
                "",

            answer:
                item.answer ||
                item.summary ||
                "",

            sources:
                item.sources ||
                [],

            confidence:
                verificationResult
                    .confidence,

            provider:
                item.provider ||
                "web-research"

        });


    const confidence =
        clamp(
            verificationResult
                .confidence
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

            verification:
                verificationResult,

            reason:
                "Verified learning requires minimum confidence."
        };
    }


    const content =
        buildLearningContent({

            ...verifiedResult,

            verified:
                true,

            confidence,

            verificationStatus:
                "verified"

        });


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

                        verifiedResult.answer ||

                        verifiedResult.summary ||

                        "",

                    category:
                        item.category ||
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

                verification:
                    verificationResult,

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

            verification:
                verificationResult,

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

        verification:
            verificationResult,

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


    result.verified =
        verificationResult
            .verified;


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

        performanceMode:
            "optimized",

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

            sentenceLevelEvidence:
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
                true,

            internalLearningVerification:
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


        performance: {

            maxClaims:
                MAX_CLAIMS,

            maxEvidenceSentences:
                MAX_EVIDENCE_SENTENCES,

            maxSourceSentences:
                MAX_SOURCE_SENTENCES,

            maxSourceContentLength:
                MAX_SOURCE_CONTENT_LENGTH,

            sourceProcessing:
                "single-pass",

            evidenceProcessing:
                "sentence-level",

            claimMode:
                "summary-first",

            duplicateEvidenceReduction:
                true
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

            "compare-source-claims",

            "detect-claim-conflicts",

            "extract-summary-claims",

            "select-relevant-evidence-sentences",

            "analyze-claim-context",

            "detect-claim-negation",

            "validate-claim-semantics",

            "map-claim-evidence",

            "calculate-claim-confidence",

            "build-claim-provenance",

            "calculate-research-confidence",

            "verify-research",

            "internally-verify-before-learning",

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
