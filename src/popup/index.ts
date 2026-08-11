import { PopupController } from './popup.ts';

document.addEventListener('DOMContentLoaded', () => {
  const controller = new PopupController();
  // Expose controller instance for debugging
  (window as unknown as { popupController: PopupController }).popupController = controller;
});
