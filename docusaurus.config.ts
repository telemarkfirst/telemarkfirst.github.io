import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import fs from 'node:fs';
import path from 'node:path';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

function localCommit(): string {
  try {
    const gitDirectory = path.join(process.cwd(), '.git');
    const head = fs.readFileSync(path.join(gitDirectory, 'HEAD'), 'utf8').trim();
    if (!head.startsWith('ref: ')) return head;
    return fs.readFileSync(
      path.join(gitDirectory, head.slice('ref: '.length)),
      'utf8',
    ).trim();
  } catch {
    return 'unknown';
  }
}

const buildCommit = process.env.TELEMARK_BUILD_COMMIT
  ?? process.env.GITHUB_SHA
  ?? localCommit();

const config: Config = {
  title: 'Telemark',
  tagline: 'FTC software and mechanical design, from setup to competition.',
  favicon: 'img/telemark.png',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // The canonical deployment is the root GitHub Pages site. The legacy
  // repository supplies overrides in its workflow until redirects activate.
  url: process.env.TELEMARK_URL ?? 'https://telemarkfirst.github.io',
  baseUrl: process.env.TELEMARK_BASE_URL ?? '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'telemarkfirst', // Usually your GitHub org/user name.
  projectName: 'telemarkfirst.github.io', // Usually your repo name.
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  onBrokenLinks: 'throw',

  // The gtag plugin calls window.gtag on every client side route change, but
  // Docusaurus only injects its inline stub in production builds. In dev, or
  // any time an ad blocker stops the remote script, window.gtag is undefined
  // and navigation throws. This defines the standard queueing stub when one is
  // missing, which is also how analytics is meant to degrade: events queue on
  // dataLayer and are delivered if the real script ever loads.
  headTags: [
    {
      tagName: 'script',
      attributes: {},
      innerHTML:
        'window.dataLayer=window.dataLayer||[];'
        + 'if(typeof window.gtag!=="function"){'
        + 'window.gtag=function(){window.dataLayer.push(arguments)}}',
    },
  ],

  customFields: {
    buildCommit,
    adminEmail: process.env.TELEMARK_ADMIN_EMAIL?.trim().toLowerCase() ?? '',
  },

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
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
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/telemarkfirst/telemarkfirst.github.io/tree/main/',
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/',
          // Useful options to enforce blogging best practices
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        pages: {
          // Keep the unfinished coach assessments in source control without
          // publishing a /coaches route until the section is ready.
          exclude: [
            '**/_*.{js,jsx,ts,tsx,md,mdx}',
            '**/_*/**',
            '**/*.test.{js,jsx,ts,tsx}',
            '**/__tests__/**',
            '**/coaches.{js,jsx,ts,tsx,md,mdx}',
          ],
        },
        theme: {
          customCss: './src/css/custom.css',
        },
        gtag: {
          trackingID: 'G-VXW7YL7R06',
          anonymizeIP: true,
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    './plugins/telemark-search',
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'mechanical',
        path: 'mechanical',
        routeBasePath: 'mechanical',
        sidebarPath: './sidebarsMechanical.ts',
        editUrl:
          'https://github.com/telemarkfirst/telemarkfirst.github.io/tree/main/',
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'blocks',
        path: 'blocks',
        routeBasePath: 'blocks',
        sidebarPath: './sidebarsBlocks.ts',
        editUrl:
          'https://github.com/telemarkfirst/telemarkfirst.github.io/tree/main/',
      },
    ],
  ],

  themeConfig: {
    // The card shown when a link is shared. Without it a Telemark link posted
    // in a team chat is a bare URL with no title card at all.
    image: 'img/og.png',
    colorMode: {
      defaultMode: 'light',
      disableSwitch: false, // Both themes ship; the toggle is in the navbar
      respectPrefersColorScheme: true,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['java'],
    },
    navbar: {
      title: 'Telemark',
      logo: {
        alt: 'Telemark Logo',
        src: 'img/telemark_logo.png',
      },
      items: [
        {
          to: '/docs/unit-00/classes-and-objects',
          label: 'Software',
          position: 'left',
        },
        {
          to: '/mechanical/module-00/design-cycle',
          label: 'Mechanical',
          position: 'left',
        },
        {
          to: '/simulator',
          label: 'Tools',
          position: 'left',
        },
        {
          to: '/search',
          label: 'Search',
          position: 'left',
        },
        {
          href: 'https://github.com/telemarkfirst/telemarkfirst.github.io',
          label: 'GitHub',
          position: 'left',
        },
        {
          to: '/dashboard',
          label: 'Dashboard',
          position: 'right',
          className: 'navbar-auth-link',
        },
      ],
    },
    footer: {
      style: 'dark',
      // One link, so a returning reader can find the record of what changed
      // even after dismissing the card on the homepage.
      links: [
        {
          title: 'Telemark',
          items: [{label: 'Changelog', to: '/changelog'}],
        },
      ],
      copyright:
        '© 2026 Telemark. Built with Docusaurus. Not affiliated with FIRST®',
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
