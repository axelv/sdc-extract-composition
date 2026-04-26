import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    "@chromatic-com/storybook",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
  ],
  framework: "@storybook/react-vite",
  staticDirs: ["../public"],
  async viteFinal(config) {
    config.optimizeDeps = {
      ...(config.optimizeDeps ?? {}),
      exclude: [...(config.optimizeDeps?.exclude ?? []), "fhirpath-rs"],
    };
    return config;
  },
};

export default config;
