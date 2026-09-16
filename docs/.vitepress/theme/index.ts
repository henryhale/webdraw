import DefaultTheme from "vitepress/theme";
import { inBrowser } from "vitepress";
import WebdrawDemo from "../../components/WebdrawDemo.vue";
import "./custom.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("WebdrawDemo", WebdrawDemo);
    if (inBrowser) void import("../../../src/webdraw");
  },
};
