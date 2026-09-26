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

test("formatDocument resolves answer context from nested execution context", () => {
    const output = response.formatDocument({
        execution: {
            context: {
                answerContext: "Grounded answer context from executor."
            }
        }
    });

    assert.match(output, /Grounded answer context from executor\\./);
});

test("createResponse appends answer context from nested execution context", () => {
    const output = response.createResponse({
        execution: {
            message: "Task completed.",
            context: {
                answerContext: "Grounded context from nested executor."
            }
        }
    });

    assert.match(output, /Task completed\\./);
    assert.match(output, /Document Knowledge/);
    assert.match(output, /Grounded context from nested executor\\./);
});


test("formatDocument resolves evidence from nested brain knowledge contexts", () => {
    const output = response.formatDocument({
        documentKnowledge: [{ title: "Policy", content: "Policy text" }],
        execution: {
            context: {
                brain: {
                    knowledge: {
                        documentEvidence: [
                            { reference: "DOC-BRAIN", title: "Nested brain evidence.pdf" }
                        ]
                    }
                }
            }
        }
    });

    assert.match(output, /DOC-BRAIN — Nested brain evidence\.pdf/);
});

test("formatDocument resolves evidence from requestContext", () => {
    const output = response.formatDocument({
        documentKnowledge: [{ title: "Policy", content: "Policy text" }],
        requestContext: {
            documentEvidence: [
                { reference: "DOC-REQUEST", title: "Request evidence.pdf" }
            ]
        }
    });

    assert.match(output, /DOC-REQUEST — Request evidence\.pdf/);
});


test("formatDocument suppresses stale document context when document knowledge is disabled", () => {
    const output = response.formatDocument({
        documentKnowledgeEnabled: false,
        documentKnowledge: [{ title: "Old policy", content: "Stale content" }],
        documentEvidence: [
            { reference: "DOC-STALE", title: "Stale evidence.pdf" }
        ],
        answerContext: "Stale answer context."
    });

    assert.equal(output, "");
});

test("createResponse does not append stale document evidence when disabled", () => {
    const output = response.createResponse({
        documentKnowledgeEnabled: false,
        execution: {
            message: "Task completed.",
            documentKnowledge: [{ title: "Old policy", content: "Stale content" }],
            documentEvidence: [
                { reference: "DOC-STALE", title: "Stale evidence.pdf" }
            ]
        }
    });

    assert.match(output, /Task completed\./);
    assert.doesNotMatch(output, /DOC-STALE/);
    assert.doesNotMatch(output, /Stale content/);
});


test("formatDocument suppresses nested execution document context when disabled", () => {
    const output = response.formatDocument({
        execution: {
            context: {
                documentKnowledgeEnabled: false,
                documentKnowledge: [{ title: "Stale nested policy", content: "Do not show" }],
                documentEvidence: [
                    { reference: "DOC-NESTED-STALE", title: "Stale nested.pdf" }
                ],
                answerContext: "Stale nested answer context."
            }
        }
    });

    assert.equal(output, "");
});


test("formatDocument respects nested brain document knowledge disable flags", () => {
    const output = response.formatDocument({
        documentKnowledge: [{ title: "Stale policy", content: "Hidden content" }],
        execution: {
            context: {
                brain: {
                    knowledge: {
                        documentKnowledgeEnabled: false,
                        documentEvidence: [
                            { reference: "DOC-BRAIN-DISABLED", title: "Hidden source.pdf" }
                        ]
                    }
                }
            }
        }
    });

    assert.equal(output, "");
});


test("formatDocument resolves answer context from root and executionContext brain knowledge", () => {
    const rootOutput = response.formatDocument({
        brain: {
            knowledge: {
                documentAnswerContext: "Root brain grounded context."
            }
        }
    });
    assert.match(rootOutput, /Root brain grounded context\./);

    const executionOutput = response.formatDocument({
        executionContext: {
            brain: {
                knowledge: {
                    documentAnswerContext: "Execution brain grounded context."
                }
            }
        }
    });
    assert.match(executionOutput, /Execution brain grounded context\./);
});
