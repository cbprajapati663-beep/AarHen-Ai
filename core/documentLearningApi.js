"use strict";

const documentLearning = require("./documentLearning");
const learningApi = require("./learningApi");

/**
 * Integration layer between document extraction and the existing Learning API.
 * The server can call learnDocument() after it receives a document buffer.
 */
async function learnDocument(input = {}, options = {}) {
    return documentLearning.learnFromDocument(input, {
        ...options,
        learner: async payload => {
            const content = String(payload.content || "");
            if (!content.trim()) {
                return { success: false, learned: false, status: "empty-document-content" };
            }
            return learningApi.learnFromUser(content, {
                title: payload.title,
                category: payload.category || "document",
                source: payload.source || "document",
                learn: payload.learn !== false,
                verified: false
            });
        }
    });
}

function getDocumentLearningStatus() {
    return {
        ...documentLearning.getDocumentLearningStatus(),
        integration: "learning-api-adapter",
        connected: true
    };
}

module.exports = {
    learnDocument,
    getDocumentLearningStatus,
    extractDocumentText: documentLearning.extractDocumentText,
    validateDocument: documentLearning.validateDocument
};
