"use strict";

const { VisionEngine, VisionEngineError } = require("./vision");
const providerManager = require("../providers/providerManager");

function createManagedEngine() {
  const provider = providerManager.isProviderAvailable("vision")
    ? providerManager.getProvider("vision")
    : null;
  return new VisionEngine(provider ? { analyzer: provider } : {});
}

let engine = null;

function configureVisionEngine(options = {}) {
  engine = new VisionEngine(options);
  return engine.getStatus();
}

function getVisionStatus() {
  return (engine || createManagedEngine()).getStatus();
}

async function analyzeImage(image, options = {}) {
  try {
    const result = await (engine || createManagedEngine()).analyze(image, options);
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
