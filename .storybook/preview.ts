import type { Preview } from "@storybook/react";
import "../src/index.css";

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: "dark",
      values: [
        {
          name: "dark",
          value: "#111827",
        },
        {
          name: "light",
          value: "#ffffff",
        },
      ],
    },
    // Accessibility addon configuration - WCAG 2.1 AA compliance
    a11y: {
      // axe-core configuration
      config: {
        rules: [
          // Ensure sufficient color contrast (4.5:1 for normal text, 3:1 for large text)
          { id: "color-contrast", enabled: true },
          // All form inputs must have labels
          { id: "label", enabled: true },
          // Buttons must have accessible names
          { id: "button-name", enabled: true },
          // Links must have accessible names
          { id: "link-name", enabled: true },
          // Images must have alt text
          { id: "image-alt", enabled: true },
          // ARIA attributes must be valid
          { id: "aria-valid-attr", enabled: true },
          { id: "aria-valid-attr-value", enabled: true },
          // Focus must be visible
          { id: "focus-order-semantics", enabled: true },
          // Dialog/modal specific
          { id: "aria-dialog-name", enabled: true },
        ],
      },
      // Options for the a11y panel
      options: {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"],
        },
      },
    },
  },
};

export default preview;
