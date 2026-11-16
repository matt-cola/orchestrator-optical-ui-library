module.exports = {
  reactStrictMode: false,
  output: 'standalone',
  i18n: {
    locales: ['en-GB', 'nl-NL'],
    defaultLocale: 'en-GB',
  },
  transpilePackages: [
    '@copilotkit/react-core',
    '@orchestrator-ui/orchestrator-ui-components',
    'pydantic-forms',
    // Required: the library shares the orchestrator API store of
    // @orchestrator-ui/orchestrator-ui-components, so both must be bundled
    // by Next.js.
    'orchestrator-optical-ui-library',
  ],
};
