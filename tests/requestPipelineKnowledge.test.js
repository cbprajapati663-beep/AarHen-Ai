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

test("buildRequestContext injects document answer context into request and brain", () => {
 const original = pipeline.buildDocumentKnowledgeBlock;
 const knowledge = require("../core/knowledgeContext");
 const originalAugment = knowledge.augmentBrainResult;
 knowledge.augmentBrainResult = () => ({
   unifiedKnowledge: {availability:{anyKnowledge:true}, documents:{results:[{title:"Guide"}],count:1,available:true}, rag:{context:"excerpt"}, knowledge:{documentKnowledge:[{title:"Guide"}]}},
   answerContext: "Grounded context",
   knowledgeContext: {available:true,context:"Grounded context"}
 });
 try {
   const result = pipeline.buildRequestContext("Question", {brain:{knowledge:{existingFlag:true}}});
   assert.equal(result.success,true);
   assert.equal(result.context.answerContext,"Grounded context");
   assert.equal(result.context.brain.knowledge.documentAnswerContext,"Grounded context");
   assert.equal(result.context.brain.knowledge.existingFlag,true);
   assert.equal(result.context.documentRag.context,"excerpt");
 } finally {
   knowledge.augmentBrainResult = originalAugment;
 }
});
