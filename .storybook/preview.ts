import type { Preview } from "@storybook/react";
import "../src/App.css";

const preview: Preview = {
  parameters: {
    a11y: {
      test: "error",
    },
    backgrounds: {
      default: "canvas",
      values: [
        { name: "canvas", value: "#0b0f19" },
        { name: "window", value: "#0f172a" },
        { name: "surface", value: "#1e293b" },
      ],
    },
  },
};

export default preview;
