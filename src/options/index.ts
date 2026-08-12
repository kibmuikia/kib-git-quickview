// file: src/options/index.ts
import { OptionsController } from "./options.ts";

document.addEventListener("DOMContentLoaded", () => {
  const controller = new OptionsController();
  // Expose controller instance for debugging
  (window as unknown as { optionsController: OptionsController }).optionsController = controller;
});
