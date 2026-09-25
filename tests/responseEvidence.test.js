const test = require("node:test");
const assert = require("node:assert/strict");

const response = require("../core/response");

test("formatDocument displays document evidence references", () => {
    const output = response.formatDocument({
        documentKnowledge: [
            { title: "Loan Policy", content: "Eligibility details" }
        ],
        documentEvidence: [
            { reference: "DOC-1", title: "Loan Policy.pdf" },
            { reference: "DOC-2", title: "Rate Card.pdf" }
        ]
    });

    assert.match(output, /Evidence references:/);
    assert.match(output, /DOC-1 — Loan Policy\.pdf/);
    assert.match(output, /DOC-2 — Rate Card\.pdf/);
});

test("formatDocument limits displayed evidence references to five", () => {
    const documentEvidence = Array.from({ length: 7 }, (_, index) => ({
        reference: `DOC-${index + 1}`,
        title: `File ${index + 1}`
    }));

    const output = response.formatDocument({
        documentKnowledge: [{ title: "Knowledge", content: "Text" }],
        documentEvidence
    });

    assert.match(output, /DOC-5 — File 5/);
    assert.doesNotMatch(output, /DOC-6 — File 6/);
});

test("formatDocument uses stable fallback references for evidence without an id", () => {
    const output = response.formatDocument({
        documentKnowledge: [{ title: "Policy", content: "Policy text" }],
        documentEvidence: [
            { title: "First source" },
            { title: "Second source" }
        ]
    });

    assert.match(output, /DOC-1 — First source/);
    assert.match(output, /DOC-2 — Second source/);
});

test("createResponse appends nested execution evidence references", () => {
    const output = response.createResponse({
        execution: {
            message: "Task completed.",
            documentKnowledge: [
                { title: "Policy", content: "Eligibility details" }
            ],
            context: {
                documentEvidence: [
                    { reference: "DOC-X", title: "Policy.pdf" }
                ]
            }
        }
    });

    assert.match(output, /Task completed\./);
    assert.match(output, /Evidence references:/);
    assert.match(output, /DOC-X — Policy\.pdf/);
});

test("formatDocument omits evidence section when no evidence is supplied", () => {
    const output = response.formatDocument({
        documentKnowledge: [{ title: "Policy", content: "Policy text" }]
    });

    assert.doesNotMatch(output, /Evidence references:/);
});

test("formatDocument safely handles malformed evidence entries", () => {
    const output = response.formatDocument({
        documentKnowledge: [{ title: "Policy", content: "Policy text" }],
        documentEvidence: [
            null,
            "unexpected evidence value",
            { title: "Valid source" }
        ]
    });

    assert.match(output, /DOC-1 — Document evidence 1/);
    assert.match(output, /DOC-2 — Document evidence 2/);
    assert.match(output, /DOC-3 — Valid source/);
});
