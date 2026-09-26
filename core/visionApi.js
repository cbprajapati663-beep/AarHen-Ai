"use strict";

const { VisionEngine, VisionEngineError } = require("./vision");
const { createOpenAIVisionProvider } = require("./openaiVisionProvider");

let engine = new VisionEngine(process.env.OPENAI_API_KEY ? { analyzer: createOpenAIVisionProvider() } : {});

function configureVisionEngine(options = {}) {
  engine = new VisionEngine(options);
  return engine.getStatus();
}

function getVisionStatus() {
  return engine.getStatus();
}

async function analyzeImage(image, options = {}) {
  try {
    return { success: true, result: await engine.analyze(image, options) };
  } catch (error) {
    if (error instanceof VisionEngineError) {
      return { success: false, error: error.message, code: error.code };
    }
    return { success: false, error: "Image analysis failed.", code: error.code || "VISION_ERROR" };
  }
}

module.exports = { configureVisionEngine, getVisionStatus, analyzeImage };
