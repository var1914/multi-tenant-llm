import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "TokenTrail",
  description: "Track, control, and optimize your LLM costs",
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }]
  ],
  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Docs', link: '/getting-started' },
      { text: 'API', link: '/api-reference' },
      { text: 'Dashboard', link: 'https://app.tokentrailapp.com' }
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Introduction', link: '/introduction' },
          { text: 'Quick Start', link: '/getting-started' },
          { text: 'Integration Guide', link: '/integration' }
        ]
      },
      {
        text: 'Core Features',
        items: [
          { text: 'Budget Limits', link: '/budget-limits' },
          { text: 'Smart Routing', link: '/smart-routing' },
          { text: 'Customer Tracking', link: '/customer-tracking' },
          { text: 'Analytics', link: '/analytics' }
        ]
      },
      {
        text: 'API Reference',
        items: [
          { text: 'Overview', link: '/api-reference' },
          { text: 'Authentication', link: '/api-authentication' },
          { text: 'Endpoints', link: '/api-endpoints' }
        ]
      },
      {
        text: 'Advanced',
        items: [
          { text: 'Self-Hosting', link: '/self-hosting' },
          { text: 'Billing Integration', link: '/billing' },
          { text: 'Webhooks', link: '/webhooks' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/tokentrailapp/tokentrail' },
      { icon: 'discord', link: 'https://discord.gg/tokentrail' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present TokenTrail'
    },

    search: {
      provider: 'local'
    },

    editLink: {
      pattern: 'https://github.com/tokentrailapp/tokentrail/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    }
  }
})
