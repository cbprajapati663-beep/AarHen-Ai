// ============================================================
// AARHEN CORE V5
// DOCUMENT LEARNING ENGINE
// ============================================================

const learning = require("../core/learning");


// ------------------------------------------------------------
// Prepare document for learning
// ------------------------------------------------------------

function prepareDocument({
    title = "Untitled Document",
    content = "",
    fileType = "text",
    source = "document"
} = {}) {

    if (!content || String(content).trim().length < 10) {

        return {
            success: false,
            error: "Document content is too short."
        };
    }


    const cleanContent =
        String(content).trim();


    return {

        success: true,

        document: {

            title,

            fileType,

            source,

            characterCount:
                cleanContent.length,

            wordCount:
                cleanContent
                    .split(/\s+/)
                    .filter(Boolean)
                    .length,

            content:
                cleanContent

        }

    };
}


// ------------------------------------------------------------
// Learn document content
// ------------------------------------------------------------

function learnDocument(options = {}) {

    const prepared =
        prepareDocument(options);


    if (!prepared.success) {
        return prepared;
    }


    const document =
        prepared.document;


    const result =
        learning.learn({

            title:
                document.title,

            content:
                document.content,

            category:
                `document:${document.fileType}`,

            source:
                document.source,

            approved:
                options.approved !== false

        });


    return {

        success:
            result.success,

        documentTitle:
            document.title,

        fileType:
            document.fileType,

        learningResult:
            result

    };
}


// ------------------------------------------------------------
// Supported document types
// ------------------------------------------------------------

function getSupportedTypes() {

    return [

        {
            type: "txt",
            status: "supported"
        },

        {
            type: "md",
            status: "supported"
        },

        {
            type: "pdf",
            status: "parser-required"
        },

        {
            type: "docx",
            status: "parser-required"
        },

        {
            type: "csv",
            status: "data-analysis-engine"
        },

        {
            type: "xlsx",
            status: "data-analysis-engine"
        }

    ];
}


// ------------------------------------------------------------
// Create document metadata
// ------------------------------------------------------------

function createDocumentRecord({
    fileName = "",
    fileType = "",
    source = "upload"
} = {}) {

    if (!fileName) {

        return {
            success: false,
            error: "File name is required."
        };
    }


    return {

        success: true,

        fileName,

        fileType,

        source,

        status: "received",

        receivedAt:
            new Date().toISOString()

    };
}


// ------------------------------------------------------------
// Module exports
// ------------------------------------------------------------

module.exports = {

    prepareDocument,

    learnDocument,

    getSupportedTypes,

    createDocumentRecord

};
