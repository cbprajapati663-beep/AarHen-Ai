const test = require("node:test");
const assert = require("node:assert/strict");
const pipeline = require("../core/requestPipeline");

test("buildDocumentKnowledgeBlock preserves answer and RAG context", () => {
 const block = pipeline.buildDocumentKnowledgeBlock({unifiedKnowledge:{availability:{anyKnowledge:true},documents:{results:[{title:"Policy.pdf"}],count:1,available:true},rag:{context:"RAG excerpt"},knowledge:{documentKnowledge:[{title:"Policy"}]}},answerContext:"Policy answer context"});
 assert.equal(block.answerContext,"Policy answer context");
 assert.equal(block.rag.context,"RAG excerpt");
 assert.equal(block.documents.results[0].title,"Policy.pdf");
 assert.equal(block.documentKnowledge[0].title,"Policy");
 assert.equal(block.available,true);
 assert.equal(block.documentDetected,true);
});

test("buildDocumentKnowledgeBlock safely defaults empty input", () => {
 const block = pipeline.buildDocumentKnowledgeBlock({});
 assert.deepEqual(block.documents.results,[]);
 assert.deepEqual(block.documentKnowledge,[]);
 assert.equal(block.answerContext,"");
 assert.equal(block.available,false);
 assert.equal(block.documentDetected,false);
});
