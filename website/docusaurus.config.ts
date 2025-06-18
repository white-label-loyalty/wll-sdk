import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'WLL SDK Docs',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://white-label-loyalty.github.io',
  baseUrl: '/wll-sdk',
  trailingSlash: true,

  organizationName: 'white-label-loyalty',
  projectName: 'wll-sdk',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
          remarkPlugins: [
            [require('@docusaurus/remark-plugin-npm2yarn'), {sync: true}],
          ],
        },
        blog: false,
        theme: {
          customCss: './theme.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    navbar: {
      title: 'WLL SDK',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'typescriptSidebar',
          position: 'left',
          label: 'TypeScript',
        },
        {
          type: 'docSidebar',
          sidebarId: 'pythonSidebar',
          position: 'left',
          label: 'Python',
        },
        {
          type: 'docSidebar',
          sidebarId: 'javaSidebar',
          position: 'left',
          label: 'Java',
        },
      ],
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
    colorMode: {
      respectPrefersColorScheme: true,
    }
  } satisfies Preset.ThemeConfig,
};

export default config;
