"use strict";

const { VisionEngine, VisionEngineError } = require("./vision");
const providerManager = require("../providers/providerManager");
const { analyzeMultilingual } = require("./multilingualMedia");

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
    return await analyzeMultilingual(
      async (input, providerOptions) => ({
        success: true,
        result: await (engine || createManagedEngine()).analyze(input, providerOptions),
      }),
      image,
      options,
    );
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
