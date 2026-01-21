# TokenTrail Documentation Site

Official documentation for TokenTrail built with VitePress.

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run docs:dev

# Build for production
npm run docs:build

# Preview production build
npm run docs:preview
```

The dev server will be available at http://localhost:5173

## Deployment

### Deploy to Vercel

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy:
```bash
cd docs-site
vercel
```

3. Configure custom domain in Vercel dashboard:
   - Add domain: `docs.tokentrail.dev`
   - Configure DNS records as instructed

### Deploy to Netlify

1. Build the site:
```bash
npm run docs:build
```

2. Deploy the `.vitepress/dist` folder to Netlify

3. Configure:
   - Build command: `npm run docs:build`
   - Publish directory: `.vitepress/dist`
   - Custom domain: `docs.tokentrail.dev`

### Deploy to GitHub Pages

1. Create `.github/workflows/deploy-docs.yml`:
```yaml
name: Deploy Docs

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install dependencies
        run: cd docs-site && npm install

      - name: Build
        run: cd docs-site && npm run docs:build

      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: docs-site/.vitepress/dist
          cname: docs.tokentrail.dev
```

2. Push to GitHub
3. Enable GitHub Pages in repository settings
4. Configure custom domain

## DNS Configuration

For `docs.tokentrail.dev`:

### Vercel
```
Type: CNAME
Name: docs
Value: cname.vercel-dns.com
```

### Netlify
```
Type: CNAME
Name: docs
Value: [your-site].netlify.app
```

### GitHub Pages
```
Type: CNAME
Name: docs
Value: [username].github.io
```

## Structure

```
docs-site/
├── .vitepress/
│   ├── config.mts       # VitePress configuration
│   └── dist/            # Build output
├── docs/
│   ├── index.md         # Homepage
│   ├── introduction.md  # Overview
│   ├── getting-started.md
│   ├── integration.md
│   ├── budget-limits.md
│   ├── smart-routing.md
│   ├── customer-tracking.md
│   ├── analytics.md
│   └── api-reference.md
└── package.json
```

## Customization

### Theme

Edit `.vitepress/config.mts` to customize:
- Navigation
- Sidebar
- Logo
- Colors
- Social links

### Content

All documentation is in Markdown format in the `docs/` directory.

## Search

VitePress includes built-in local search. For production, consider:
- [Algolia DocSearch](https://docsearch.algolia.com/) (free for open source)
- VitePress local search (enabled by default)

## Analytics

Add analytics in `.vitepress/config.mts`:

```typescript
export default defineConfig({
  head: [
    ['script', {
      async: true,
      src: 'https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX'
    }]
  ]
})
```

## License

MIT
