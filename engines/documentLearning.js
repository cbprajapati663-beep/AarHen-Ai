// ============================================================
// AARHEN CORE V5
// DOCUMENT LEARNING ENGINE
// Version: 5.6.0
//
// Purpose:
// - Read PDF / DOCX / TXT / MD / JSON
// - Extract text
// - Normalize document content
// - Create learning-ready chunks
// - Prepare metadata for RAG + Memory
// - Safe optional dependency loading
// ============================================================

const fs = require("fs");
const path = require("path");

const DOCUMENT_ENGINE_VERSION = "5.6.0";

const SUPPORTED_EXTENSIONS = [
    ".pdf",
    ".docx",
    ".txt",
    ".md",
    ".markdown",
    ".json"
];

const DEFAULT_CHUNK_SIZE = 1200;
const DEFAULT_CHUNK_OVERLAP = 150;

const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024;


// ============================================================
// SAFE HELPERS
// ============================================================

function safeString(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value).trim();
}

function normalizeWhitespace(text) {
    return safeString(text)
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function clampNumber(value, min, max, fallback) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return fallback;
    }

    return Math.max(
        min,
        Math.min(
            max,
            number
        )
    );
}

function getExtension(filePath) {
    return path
        .extname(
            safeString(filePath)
        )
        .toLowerCase();
}

function getFileName(filePath) {
    return path.basename(
        safeString(filePath)
    );
}

function isSupportedExtension(extension) {
    return SUPPORTED_EXTENSIONS.includes(
        extension
    );
}


// ============================================================
// OPTIONAL DEPENDENCIES
// ============================================================

function loadOptionalModule(name) {
    try {
        return require(name);
    } catch {
        return null;
    }
}


// ============================================================
// FILE VALIDATION
// ============================================================

function validateFile(filePath) {

    const cleanPath =
        safeString(filePath);

    if (!cleanPath) {
        return {
            success: false,
            error: "Document path is required.",
            status: "invalid-path"
        };
    }

    if (!fs.existsSync(cleanPath)) {
        return {
            success: false,
            error: "Document file not found.",
            status: "file-not-found",
            filePath: cleanPath
        };
    }

    let stats;

    try {
        stats =
            fs.statSync(cleanPath);
    } catch (error) {
        return {
            success: false,
            error: error.message,
            status: "file-stat-error",
            filePath: cleanPath
        };
    }

    if (!stats.isFile()) {
        return {
            success: false,
            error: "Provided path is not a file.",
            status: "not-a-file",
            filePath: cleanPath
        };
    }

    if (
        stats.size >
        MAX_DOCUMENT_SIZE
    ) {
        return {
            success: false,
            error:
                "Document exceeds the maximum allowed size of 25 MB.",
            status: "file-too-large",
            filePath: cleanPath,
            size: stats.size,
            maxSize: MAX_DOCUMENT_SIZE
        };
    }

    const extension =
        getExtension(cleanPath);

    if (
        !isSupportedExtension(
            extension
        )
    ) {
        return {
            success: false,
            error:
                `Unsupported document type: ${extension || "unknown"}`,
            status: "unsupported-extension",
            filePath: cleanPath,
            extension,
            supportedExtensions:
                SUPPORTED_EXTENSIONS
        };
    }

    return {
        success: true,
        filePath: cleanPath,
        fileName:
            getFileName(cleanPath),
        extension,
        size: stats.size
    };
}


// ============================================================
// TEXT DOCUMENT READER
// ============================================================

function readTextDocument(
    filePath
) {

    try {

        const content =
            fs.readFileSync(
                filePath,
                "utf8"
            );

        return {
            success: true,
            text:
                normalizeWhitespace(
                    content
                ),
            parser:
                "native-text-reader"
        };

    } catch (error) {

        return {
            success: false,
            error:
                error.message,
            parser:
                "native-text-reader"
        };
    }
}


// ============================================================
// JSON DOCUMENT READER
// ============================================================

function readJsonDocument(
    filePath
) {

    try {

        const raw =
            fs.readFileSync(
                filePath,
                "utf8"
            );

        const parsed =
            JSON.parse(raw);

        const formatted =
            JSON.stringify(
                parsed,
                null,
                2
            );

        return {
            success: true,
            text:
                normalizeWhitespace(
                    formatted
                ),
            parser:
                "native-json-reader"
        };

    } catch (error) {

        return {
            success: false,
            error:
                error.message,
            parser:
                "native-json-reader"
        };
    }
}


// ============================================================
// DOCX READER
// ============================================================

async function readDocxDocument(
    filePath
) {

    const mammoth =
        loadOptionalModule(
            "mammoth"
        );

    if (!mammoth) {

        return {
            success: false,
            dependencyMissing: true,
            dependency:
                "mammoth",
            error:
                "DOCX support requires the 'mammoth' package.",
            parser:
                "mammoth"
        };
    }

    try {

        const result =
            await mammoth.extractRawText({
                path:
                    filePath
            });

        return {
            success: true,
            text:
                normalizeWhitespace(
                    result.text || ""
                ),
            parser:
                "mammoth",
            messages:
                Array.isArray(
                    result.messages
                )
                    ? result.messages
                    : []
        };

    } catch (error) {

        return {
            success: false,
            error:
                error.message,
            parser:
                "mammoth"
        };
    }
}


// ============================================================
// PDF READER
// ============================================================

async function readPdfDocument(
    filePath
) {

    const pdfParse =
        loadOptionalModule(
            "pdf-parse"
        );

    if (!pdfParse) {

        return {
            success: false,
            dependencyMissing: true,
            dependency:
                "pdf-parse",
            error:
                "PDF support requires the 'pdf-parse' package.",
            parser:
                "pdf-parse"
        };
    }

    try {

        const buffer =
            fs.readFileSync(
                filePath
            );

        const result =
            await pdfParse(
                buffer
            );

        return {
            success: true,
            text:
                normalizeWhitespace(
                    result.text || ""
                ),
            parser:
                "pdf-parse",
            pages:
                Number(
                    result.numpages
                ) || 0,
            info:
                result.info || null
        };

    } catch (error) {

        return {
            success: false,
            error:
                error.message,
            parser:
                "pdf-parse"
        };
    }
}


// ============================================================
// DOCUMENT TEXT EXTRACTION
// ============================================================

async function extractText(
    filePath
) {

    const validation =
        validateFile(
            filePath
        );

    if (!validation.success) {
        return validation;
    }

    let result;

    switch (
        validation.extension
    ) {

        case ".txt":
        case ".md":
        case ".markdown":

            result =
                readTextDocument(
                    validation.filePath
                );

            break;

        case ".json":

            result =
                readJsonDocument(
                    validation.filePath
                );

            break;

        case ".docx":

            result =
                await readDocxDocument(
                    validation.filePath
                );

            break;

        case ".pdf":

            result =
                await readPdfDocument(
                    validation.filePath
                );

            break;

        default:

            return {
                success: false,
                error:
                    "Unsupported document extension.",
                status:
                    "unsupported-extension"
            };
    }

    if (!result.success) {

        return {
            ...validation,
            ...result,
            success: false
        };
    }

    const text =
        normalizeWhitespace(
            result.text
        );

    return {
        ...validation,
        ...result,

        success: true,

        text,

        characterCount:
            text.length,

        wordCount:
            countWords(text),

        empty:
            text.length === 0,

        status:
            text.length > 0
                ? "text-extracted"
                : "empty-document"
    };
}


// ============================================================
// WORD COUNT
// ============================================================

function countWords(
    text
) {

    const clean =
        safeString(text);

    if (!clean) {
        return 0;
    }

    return clean
        .split(/\s+/)
        .filter(Boolean)
        .length;
}


// ============================================================
// CHUNKING
// ============================================================

function splitTextIntoChunks(
    text,
    options = {}
) {

    const cleanText =
        normalizeWhitespace(
            text
        );

    if (!cleanText) {
        return [];
    }

    const chunkSize =
        Math.round(
            clampNumber(
                options.chunkSize,
                300,
                5000,
                DEFAULT_CHUNK_SIZE
            )
        );

    const overlap =
        Math.round(
            clampNumber(
                options.chunkOverlap,
                0,
                Math.floor(
                    chunkSize * 0.5
                ),
                DEFAULT_CHUNK_OVERLAP
            )
        );

    const chunks = [];

    let start = 0;

    while (
        start <
        cleanText.length
    ) {

        let end =
            Math.min(
                start + chunkSize,
                cleanText.length
            );

        if (
            end <
            cleanText.length
        ) {

            const paragraphBreak =
                cleanText.lastIndexOf(
                    "\n\n",
                    end
                );

            const sentenceBreak =
                cleanText.lastIndexOf(
                    ". ",
                    end
                );

            const spaceBreak =
                cleanText.lastIndexOf(
                    " ",
                    end
                );

            if (
                paragraphBreak >
                start + chunkSize * 0.5
            ) {

                end =
                    paragraphBreak;

            } else if (
                sentenceBreak >
                start + chunkSize * 0.5
            ) {

                end =
                    sentenceBreak + 1;

            } else if (
                spaceBreak >
                start + chunkSize * 0.5
            ) {

                end =
                    spaceBreak;
            }
        }

        const chunkText =
            cleanText
                .slice(
                    start,
                    end
                )
                .trim();

        if (chunkText) {

            chunks.push(
                chunkText
            );
        }

        if (
            end >=
            cleanText.length
        ) {
            break;
        }

        start =
            Math.max(
                end - overlap,
                start + 1
            );
    }

    return chunks;
}


// ============================================================
// DOCUMENT METADATA
// ============================================================

function detectDocumentCategory(
    fileName,
    text
) {

    const lowerName =
        safeString(
            fileName
        ).toLowerCase();

    const lowerText =
        safeString(
            text
        ).toLowerCase();

    if (
        lowerName.includes("loan") ||
        lowerName.includes("finance") ||
        lowerText.includes("loan") ||
        lowerText.includes("finance")
    ) {
        return "finance";
    }

    if (
        lowerName.includes("insurance") ||
        lowerText.includes("insurance")
    ) {
        return "insurance";
    }

    if (
        lowerName.includes("policy") ||
        lowerText.includes("policy")
    ) {
        return "policy";
    }

    if (
        lowerName.includes("manual") ||
        lowerName.includes("guide") ||
        lowerText.includes("manual") ||
        lowerText.includes("guidelines")
    ) {
        return "documentation";
    }

    return "general";
}


// ============================================================
// BUILD LEARNING RECORDS
// ============================================================

function buildLearningRecords(
    document,
    options = {}
) {

    if (
        !document ||
        document.success !== true
    ) {
        return [];
    }

    const chunks =
        splitTextIntoChunks(
            document.text,
            options
        );

    const category =
        detectDocumentCategory(
            document.fileName,
            document.text
        );

    return chunks.map(
        (
            chunk,
            index
        ) => {

            return {

                id:
                    `document-${Date.now()}-${index + 1}`,

                type:
                    "document_knowledge",

                title:
                    `${document.fileName} - Chunk ${index + 1}`,

                category,

                content:
                    chunk,

                source:
                    document.fileName,

                sourcePath:
                    document.filePath,

                sourceType:
                    document.extension,

                chunkIndex:
                    index + 1,

                totalChunks:
                    chunks.length,

                confidence:
                    0.5,

                verified:
                    false,

                learned:
                    false,

                tags: [
                    "document",
                    document.extension
                        .replace(".", ""),
                    category
                ],

                metadata: {

                    documentName:
                        document.fileName,

                    documentType:
                        document.extension,

                    documentSize:
                        document.size,

                    characterCount:
                        chunk.length,

                    wordCount:
                        countWords(chunk),

                    parser:
                        document.parser ||

                        null,

                    pages:
                        Number(
                            document.pages
                        ) || 0
                }
            };
        }
    );
}


// ============================================================
// COMPLETE DOCUMENT PROCESSOR
// ============================================================

async function processDocument(
    filePath,
    options = {}
) {

    const extracted =
        await extractText(
            filePath
        );

    if (
        !extracted.success
    ) {
        return extracted;
    }

    if (
        !extracted.text
    ) {

        return {
            ...extracted,

            success: false,

            status:
                "empty-document",

            error:
                "No readable text was extracted from the document."
        };
    }

    const learningRecords =
        buildLearningRecords(
            extracted,
            options
        );

    return {

        success: true,

        engine:
            "AarHen Document Learning Engine",

        version:
            DOCUMENT_ENGINE_VERSION,

        fileName:
            extracted.fileName,

        filePath:
            extracted.filePath,

        extension:
            extracted.extension,

        parser:
            extracted.parser,

        pages:
            extracted.pages || 0,

        characterCount:
            extracted.characterCount,

        wordCount:
            extracted.wordCount,

        chunkCount:
            learningRecords.length,

        text:
            extracted.text,

        chunks:
            learningRecords,

        status:
            "document-processed",

        learningReady:
            true,

        memoryReady:
            true,

        ragReady:
            true
    };
}


// ============================================================
// STATUS
// ============================================================

function getStatus() {

    return {

        success: true,

        name:
            "AarHen Document Learning Engine",

        version:
            DOCUMENT_ENGINE_VERSION,

        status:
            "active",

        capabilities: [

            "pdf-text-extraction",

            "docx-text-extraction",

            "txt-reading",

            "markdown-reading",

            "json-reading",

            "document-normalization",

            "document-chunking",

            "learning-record-generation",

            "rag-ready-output",

            "memory-ready-output",

            "metadata-generation",

            "document-category-detection",

            "safe-file-validation"
        ],

        supportedExtensions:
            SUPPORTED_EXTENSIONS,

        limits: {

            maximumFileSize:
                MAX_DOCUMENT_SIZE,

            defaultChunkSize:
                DEFAULT_CHUNK_SIZE,

            defaultChunkOverlap:
                DEFAULT_CHUNK_OVERLAP
        },

        optionalDependencies: {

            pdf: "pdf-parse",

            docx: "mammoth"
        }
    };
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    DOCUMENT_ENGINE_VERSION,

    SUPPORTED_EXTENSIONS,

    DEFAULT_CHUNK_SIZE,

    DEFAULT_CHUNK_OVERLAP,

    MAX_DOCUMENT_SIZE,

    safeString,

    normalizeWhitespace,

    countWords,

    getExtension,

    getFileName,

    isSupportedExtension,

    validateFile,

    readTextDocument,

    readJsonDocument,

    readDocxDocument,

    readPdfDocument,

    extractText,

    splitTextIntoChunks,

    detectDocumentCategory,

    buildLearningRecords,

    processDocument,

    getStatus
};
