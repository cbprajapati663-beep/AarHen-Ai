"use strict";

// AarHen Document Learning Engine foundation.
// Extracts text from supported documents and hands it to the existing learning
// engine. It does not store files or mark extracted content as verified.

const path = require("node:path");

const SUPPORTED_EXTENSIONS = new Set([".txt", ".md", ".pdf", ".docx"]);
const DEFAULT_MAX_BYTES = 15 * 1024 * 1024;

function normalizeText(value) {
    return String(value ?? "").replace(/\u0000/g, "").trim();
}

function getExtension(input = {}) {
    const name = String(input.fileName || input.filename || "").trim();
    const explicit = String(input.extension || "").trim().toLowerCase();
    return (explicit || path.extname(name)).toLowerCase();
}

function validateDocument(input = {}, maxBytes = DEFAULT_MAX_BYTES) {
    if (!input || typeof input !== "object") {
        return { success: false, error: "invalid-input", message: "Document input must be an object." };
    }
    const buffer = input.buffer;
    if (!Buffer.isBuffer(buffer) && !(buffer instanceof Uint8Array)) {
        return { success: false, error: "invalid-buffer", message: "Document buffer must be a Buffer or Uint8Array." };
    }
    if (buffer.byteLength === 0) {
        return { success: false, error: "empty-document", message: "Document is empty." };
    }
    if (buffer.byteLength > maxBytes) {
        return { success: false, error: "document-too-large", message: "Document exceeds the configured size limit." };
    }
    const extension = getExtension(input);
    if (!SUPPORTED_EXTENSIONS.has(extension)) {
        return { success: false, error: "unsupported-format", message: "Supported formats are TXT, Markdown, PDF, and DOCX." };
    }
    return { success: true, extension, buffer: Buffer.from(buffer) };
}

async function extractDocumentText(input = {}, options = {}) {
    const maxBytes = Number(options.maxBytes) > 0 ? Number(options.maxBytes) : DEFAULT_MAX_BYTES;
    const validation = validateDocument(input, maxBytes);
    if (!validation.success) return validation;

    try {
        let text;
        if (validation.extension === ".txt" || validation.extension === ".md") {
            text = validation.buffer.toString("utf8");
        } else if (validation.extension === ".pdf") {
            const parser = options.pdfParser || require("pdf-parse");
            const result = await parser(validation.buffer);
            text = result && result.text;
        } else if (validation.extension === ".docx") {
            const mammoth = options.mammoth || require("mammoth");
            const result = await mammoth.extractRawText({ buffer: validation.buffer });
            text = result && result.value;
        }

        const content = normalizeText(text);
        if (!content) {
            return { success: false, error: "no-text-extracted", message: "No readable text was found in the document." };
        }
        return {
            success: true,
            text: content,
            extension: validation.extension,
            byteLength: validation.buffer.byteLength
        };
    } catch (error) {
        return {
            success: false,
            error: "document-extraction-failed",
            message: error && error.message ? error.message : "Document extraction failed."
        };
    }
}

async function learnFromDocument(input = {}, options = {}) {
    const extracted = await extractDocumentText(input, options);
    if (!extracted.success) {
        return { success: false, learned: false, status: "document-extraction-failed", extraction: extracted };
    }

    const learner = options.learner;
    if (typeof learner !== "function") {
        return {
            success: false,
            learned: false,
            status: "learning-provider-required",
            error: "Pass the existing learning engine function as options.learner.",
            extracted: { extension: extracted.extension, characterCount: extracted.text.length }
        };
    }

    try {
        const result = await learner({
            title: input.title || input.fileName || input.filename || "Document knowledge",
            content: extracted.text,
            source: input.source || "document",
            category: input.category || "document",
            learn: input.learn !== false,
            verified: false
        });
        return {
            success: Boolean(result && result.success),
            learned: Boolean(result && result.learned),
            status: result && result.status ? result.status : "learning-result-returned",
            extraction: { extension: extracted.extension, characterCount: extracted.text.length },
            learning: result || null
        };
    } catch (error) {
        return {
            success: false,
            learned: false,
            status: "document-learning-failed",
            error: error && error.message ? error.message : "Document learning failed."
        };
    }
}

function getDocumentLearningStatus() {
    return {
        success: true,
        name: "AarHen Document Learning Engine",
        status: "foundation-ready",
        supportedExtensions: Array.from(SUPPORTED_EXTENSIONS),
        maxBytes: DEFAULT_MAX_BYTES,
        capabilities: ["text-markdown-extraction", "pdf-text-extraction", "docx-text-extraction", "learning-engine-adapter"],
        limitations: ["No OCR for scanned PDFs", "No file persistence", "Extracted content is not automatically verified"]
    };
}

module.exports = {
    DEFAULT_MAX_BYTES,
    SUPPORTED_EXTENSIONS,
    validateDocument,
    extractDocumentText,
    learnFromDocument,
    getDocumentLearningStatus
};
