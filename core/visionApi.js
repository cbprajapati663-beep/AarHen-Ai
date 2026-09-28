"use strict";

const { VisionEngine, VisionEngineError } = require("./vision");

let engine = new VisionEngine();

function configureVisionEngine(options = {}) {
  engine = new VisionEngine(options);
  return engine.getStatus();
}

function getVisionStatus() {
  return engine.getStatus();
}

async function analyzeImage(image, options = {}) {
  try {
    const result = await engine.analyze(image, options);
    return { success: true, result };
  } catch (error) {
    if (error instanceof VisionEngineError) {
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
    return {
      success: false,
      error: "Image analysis failed.",
      code: "VISION_ERROR",
    };
  }
}

module.exports = {
  configureVisionEngine,
  getVisionStatus,
  analyzeImage,
};
