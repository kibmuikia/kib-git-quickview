// file: src/sidepanel/index.ts
import { SidePanelController } from "./sidepanel.ts";

document.addEventListener("DOMContentLoaded", () => {
  const controller = new SidePanelController();
  // Expose controller instance for debugging — mirrors the popup/options convention
  (window as unknown as { sidePanelController: SidePanelController }).sidePanelController = controller;
});
