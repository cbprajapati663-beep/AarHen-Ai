// ============================================================
// AARHEN CORE V5
// DOCUMENT INGESTION ENGINE
// Version: 5.6.4
//
// Purpose:
// - Process documents through Document Learning Engine
// - Send document chunks to Continuous Learning Engine
// - Preserve real document filename as provenance/source
// - Keep document knowledge identifiable for RAG
// - Sync with Knowledge Store + Memory Manager
// ============================================================

const documentLearning =
    require("./documentLearning");

const learning =
    require("../core/learning");

const INGESTION_VERSION =
    "5.6.4";


// ============================================================
// HELPERS
// ============================================================

function safeString(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value).trim();
}


function safeArray(value) {

    return Array.isArray(value)
        ? value
        : [];
}


function clamp(
    value,
    min = 0,
    max = 1
) {

    const number =
        Number(value);

    if (
        !Number.isFinite(number)
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
// BUILD LEARNING INPUT
// ============================================================

function buildLearningInput(
    document,
    chunk,
    options = {}
) {

    const fileName =
        safeString(
            document.fileName
        ) ||
        "Unknown Document";

    const category =
        safeString(
            options.category
        ) ||
        safeString(
            chunk.category
        ) ||
        safeString(
            document.chunks?.[0]?.category
        ) ||
        "knowledge";

    // --------------------------------------------------------
    // IMPORTANT:
    // The actual document filename is the canonical source.
    //
    // This keeps provenance reliable for:
    // PDF / DOCX / TXT / MD / JSON
    // --------------------------------------------------------

    const source =
        fileName;

    const confidence =
        clamp(
            typeof options.confidence === "number"
                ? options.confidence
                : 0.60
        );

    const documentSource =
        safeString(
            options.source
        ) ||
        "document-ingestion";

    return {

        title:
            safeString(
                options.title
            ) ||
            `${fileName} - Document Knowledge`,

        content:
            safeString(
                chunk.content
            ),

        category,

        source,

        sourceType:
            safeString(
                document.extension
            ) ||
            null,

        documentName:
            fileName,

        documentSource,

        documentPath:
            safeString(
                document.filePath
            ) ||
            null,

        chunkIndex:
            Number(
                chunk.chunkIndex
            ) || 0,

        totalChunks:
            Number(
                chunk.totalChunks
            ) || 0,

        memoryType:
            options.memoryType ||
            "knowledge",

        importance:
            options.importance ||
            "normal",

        confidence,

        verified:
            options.verified === true,

        learn:
            options.learn !== false
    };
}


// ============================================================
// LEARN SINGLE CHUNK
// ============================================================

function learnChunk(
    document,
    chunk,
    options = {}
) {

    const content =
        safeString(
            chunk?.content
        );

    if (!content) {

        return {

            success: true,

            learned: false,

            status:
                "empty-chunk",

            reason:
                "Chunk contains no readable content."
        };
    }

    if (
        content.length < 10
    ) {

        return {

            success: true,

            learned: false,

            status:
                "chunk-too-short",

            reason:
                "Chunk is too short for useful learning."
        };
    }

    try {

        const input =
            buildLearningInput(
                document,
                chunk,
                options
            );

        const result =
            learning.learn(
                input
            );

        return {

            success:
                Boolean(
                    result &&
                    result.success
                ),

            learned:
                Boolean(
                    result &&
                    result.learned
                ),

            newlyLearned:
                Boolean(
                    result &&
                    result.newlyLearned
                ),

            duplicate:
                Boolean(
                    result &&
                    result.duplicate
                ),

            status:
                result &&
                result.status
                    ? result.status
                    : "learning-completed",

            result:

                result || null
        };

    } catch (error) {

        return {

            success: false,

            learned: false,

            status:
                "learning-error",

            error:
                error.message
        };
    }
}


// ============================================================
// LEARN ALL CHUNKS
// ============================================================

function learnDocumentChunks(
    document,
    options = {}
) {

    const chunks =
        safeArray(
            document.chunks
        );

    if (
        chunks.length === 0
    ) {

        return {

            success: false,

            learned: false,

            learnedCount: 0,

            failedCount: 0,

            duplicateCount: 0,

            results: [],

            status:
                "no-chunks"
        };
    }

    const results = [];

    let learnedCount = 0;

    let failedCount = 0;

    let duplicateCount = 0;

    for (
        const chunk of chunks
    ) {

        const result =
            learnChunk(
                document,
                chunk,
                options
            );

        results.push({

            chunkIndex:
                chunk.chunkIndex || null,

            success:
                result.success,

            learned:
                result.learned,

            newlyLearned:
                result.newlyLearned,

            duplicate:
                result.duplicate,

            status:
                result.status,

            error:
                result.error || null
        });

        if (
            result.success
        ) {

            if (
                result.learned
            ) {
                learnedCount++;
            }

            if (
                result.duplicate
            ) {
                duplicateCount++;
            }

        } else {

            failedCount++;
        }
    }

    return {

        success:
            failedCount === 0,

        learned:
            learnedCount > 0,

        learnedCount,

        failedCount,

        duplicateCount,

        totalChunks:
            chunks.length,

        results,

        status:
            failedCount === 0
                ? "document-learned"
                : "document-partially-learned"
    };
}


// ============================================================
// COMPLETE DOCUMENT INGESTION
// ============================================================

async function ingestDocument(
    filePath,
    options = {}
) {

    const processed =
        await documentLearning.processDocument(
            filePath,
            options
        );

    if (
        !processed ||
        !processed.success
    ) {

        return {

            success: false,

            ingested: false,

            document:
                processed || null,

            learning:
                null,

            status:
                "document-processing-failed",

            error:
                processed?.error ||
                "Document processing failed."
        };
    }

    const learningResult =
        learnDocumentChunks(
            processed,
            options
        );

    return {

        success:
            Boolean(
                learningResult.success
            ),

        ingested:
            Boolean(
                learningResult.learned
            ),

        status:
            learningResult.success
                ? "document-ingested"
                : "document-ingestion-partial",

        engine:
            "AarHen Document Ingestion Engine",

        version:
            INGESTION_VERSION,

        document: {

            fileName:
                processed.fileName,

            filePath:
                processed.filePath,

            extension:
                processed.extension,

            parser:
                processed.parser,

            pages:
                processed.pages || 0,

            characterCount:
                processed.characterCount,

            wordCount:
                processed.wordCount,

            chunkCount:
                processed.chunkCount,

            canonicalSource:
                processed.fileName,

            ingestionSource:
                safeString(
                    options.source
                ) ||
                "document-ingestion"
        },

        learning: {

            totalChunks:
                learningResult.totalChunks,

            learnedCount:
                learningResult.learnedCount,

            failedCount:
                learningResult.failedCount,

            duplicateCount:
                learningResult.duplicateCount,

            status:
                learningResult.status
        },

        results:
            learningResult.results
    };
}


// ============================================================
// TEXT INGESTION
//
// Useful when another engine already has document text.
// ============================================================

function ingestText(
    text,
    options = {}
) {

    const content =
        safeString(
            text
        );

    if (!content) {

        return {

            success: false,

            ingested: false,

            status:
                "empty-text",

            error:
                "Text content is required."
        };
    }

    const chunks =
        documentLearning.splitTextIntoChunks(
            content,
            options
        );

    if (
        chunks.length === 0
    ) {

        return {

            success: false,

            ingested: false,

            status:
                "no-text-chunks",

            error:
                "Text could not be divided into learning chunks."
        };
    }

    const fileName =
        safeString(
            options.fileName
        ) ||
        "text-input.txt";

    const pseudoDocument = {

        success: true,

        fileName,

        filePath:
            safeString(
                options.filePath
            ) ||
            null,

        extension:
            safeString(
                options.extension
            ) ||
            ".txt",

        parser:
            "text-input",

        chunks:
            chunks.map(
                (
                    content,
                    index
                ) => ({

                    content,

                    chunkIndex:
                        index + 1,

                    totalChunks:
                        chunks.length,

                    category:
                        options.category ||
                        "knowledge"
                })
            )
    };

    const learningResult =
        learnDocumentChunks(
            pseudoDocument,
            options
        );

    return {

        success:
            learningResult.success,

        ingested:
            learningResult.learned,

        engine:
            "AarHen Document Ingestion Engine",

        version:
            INGESTION_VERSION,

        textLength:
            content.length,

        fileName,

        source:
            fileName,

        chunkCount:
            chunks.length,

        learning:
            learningResult
    };
}


// ============================================================
// STATUS
// ============================================================

function getStatus() {

    return {

        success: true,

        name:
            "AarHen Document Ingestion Engine",

        version:
            INGESTION_VERSION,

        status:
            "active",

        capabilities: [

            "document-processing",

            "pdf-ingestion",

            "docx-ingestion",

            "text-ingestion",

            "document-chunk-learning",

            "knowledge-store-integration",

            "memory-manager-integration",

            "duplicate-safe-learning",

            "document-provenance",

            "canonical-document-source",

            "learning-status-reporting"
        ],

        connectedEngines: {

            documentLearning:
                true,

            continuousLearning:
                true,

            knowledgeStore:
                true,

            memoryManager:
                true
        },

        provenance: {

            canonicalSource:
                "document-filename",

            ingestionSource:
                "optional-source-label",

            documentPath:
                true,

            documentType:
                true,

            chunkTracking:
                true
        },

        pipeline: [

            "document-input",

            "text-extraction",

            "normalization",

            "chunking",

            "learning-decision",

            "knowledge-storage",

            "memory-sync",

            "document-provenance",

            "learning-result"
        ]
    };
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    INGESTION_VERSION,

    safeString,

    safeArray,

    clamp,

    buildLearningInput,

    learnChunk,

    learnDocumentChunks,

    ingestDocument,

    ingestText,

    getStatus
};
