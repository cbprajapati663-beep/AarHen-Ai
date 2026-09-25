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
