"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
    validateDocument,
    extractDocumentText,
    learnFromDocument,
    getDocumentLearningStatus
} = require("./documentLearning");

test("rejects empty and unsupported documents", async () => {
    assert.equal(validateDocument({ buffer: Buffer.alloc(0), fileName: "a.txt" }).error, "empty-document");
    assert.equal(validateDocument({ buffer: Buffer.from("x"), fileName: "a.exe" }).error, "unsupported-format");
});

test("enforces the size limit", () => {
    const result = validateDocument({ buffer: Buffer.from("12345"), fileName: "a.txt" }, 4);
    assert.equal(result.error, "document-too-large");
});

test("extracts UTF-8 text and trims whitespace", async () => {
    const result = await extractDocumentText({ buffer: Buffer.from("  AarHen document  "), fileName: "notes.txt" });
    assert.equal(result.success, true);
    assert.equal(result.text, "AarHen document");
});

test("uses injected PDF and DOCX parsers", async () => {
    const pdf = await extractDocumentText(
        { buffer: Buffer.from("pdf"), fileName: "file.pdf" },
        { pdfParser: async () => ({ text: " PDF text " }) }
    );
    const docx = await extractDocumentText(
        { buffer: Buffer.from("docx"), fileName: "file.docx" },
        { mammoth: { extractRawText: async () => ({ value: " DOCX text " }) } }
    );
    assert.equal(pdf.text, "PDF text");
    assert.equal(docx.text, "DOCX text");
});

test("passes extracted text to learner without claiming verification", async () => {
    let captured;
    const result = await learnFromDocument(
        { buffer: Buffer.from("A sufficiently long document."), fileName: "brief.txt" },
        { learner: async input => { captured = input; return { success: true, learned: true, status: "learned-and-stored" }; } }
    );
    assert.equal(result.success, true);
    assert.equal(captured.content, "A sufficiently long document.");
    assert.equal(captured.verified, false);
});

test("requires learner and reports capabilities", async () => {
    const result = await learnFromDocument({ buffer: Buffer.from("Content"), fileName: "x.txt" });
    assert.equal(result.status, "learning-provider-required");
    assert.equal(getDocumentLearningStatus().status, "foundation-ready");
});
