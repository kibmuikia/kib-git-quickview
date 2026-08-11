import { defineManifest } from "@crxjs/vite-plugin";
import packageJson from "../package.json";

const { version } = packageJson;
const [major, minor, patch] = version.replace("-beta", "").split(".");

export default defineManifest(async () => ({
  manifest_version: 3,
  name: "kib-git-quickview",
  description:
    "A Chrome extension that turns any GitHub username into a compact developer dashboard — repo count, latest repos, public activity, top languages — in one click, without leaving the current page.",
  version: `${major}.${minor}.${patch}`,
  version_name: version,
  permissions: ["storage", "sidePanel"],
  host_permissions: ["https://api.github.com/*"],
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  options_ui: {
    page: "public/options.html",
    open_in_tab: true,
  },
  icons: {
    16: "icons/icon16.png",
    32: "icons/icon32.png",
    48: "icons/icon48.png",
    128: "icons/icon128.png",
  },
  action: {
    default_title: "Kib-Git-Quickview",
    default_popup: "public/popup.html",
    default_icon: {
      16: "icons/icon16.png",
      32: "icons/icon32.png",
      48: "icons/icon48.png",
      128: "icons/icon128.png",
    },
  },
}));
