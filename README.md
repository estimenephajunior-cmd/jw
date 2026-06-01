# Expo React Native Template

This is a React Native template using Expo Router and configured for web, iOS, and Android development.

## Quick Start

```bash
# Fast installation with Bun (recommended)
bun install

# Or use npm (slower but more stable)
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`

## Available Commands

### Development
- `npm run dev` - Start development server for web on port 3000
- `npm start` - Start development server (shows QR code for mobile)
- `npm run start:web` - Start web development server
- `npm run start:ios` - Start iOS development server
- `npm run start:android` - Start Android development server

### Building
- `npm run build:web` - Build for web production
- `npm run build:ios` - Build for iOS
- `npm run build:android` - Build for Android

### Package Management (Bun - Fast)
- `bun install` - Install dependencies (fastest)
- `npm run install:fast` - Install with Bun, skip postinstall (very fast)
- `npm run add <package>` - Add package with Bun
- `npm run setup` - Run Expo install for native linking

### Package Management (npm - Stable)
- `npm install` - Install dependencies (slower but stable)
- `npm run setup` - Run Expo install for native linking

### Utilities
- `npm run doctor` - Check project setup and dependencies
- `npm run upgrade` - Upgrade Expo SDK and dependencies
- `npm run lint` - Run linting
- `npm run eject` - Eject from Expo (use with caution)

## Project Structure

```
├── app/                 # Expo Router pages
├── components/          # Reusable components
├── assets/             # Images, fonts, etc.
├── hooks/              # Custom hooks
└── package.json        # Dependencies and scripts
```

## Performance Tips

### For fastest installation:
1. Use `bun install` (2-10x faster than npm)
2. Use `npm run install:fast` to skip postinstall steps
3. Only run `npm run setup` when you need native linking

### For most stable installation:
1. Use `npm install` (slower but more compatible)
2. Run `npm run setup` after installing new native dependencies

## Notes for AI Agents

- **Fast setup**: Use `bun install` then `npm run dev`
- **Stable setup**: Use `npm install` then `npm run dev`
- Use `npm run doctor` to diagnose issues
- Use `npm run setup` instead of `npm run install` for Expo packages
- The project uses Expo Router for navigation
- Web version runs on port 3000 by default
- Bun is 2-10x faster than npm for package installation 

## MCP Gateway (for AI research)

This repo includes a minimal Node gateway at `tools/mcp-gateway-server.js` that gives the Expo web app one HTTP endpoint for JW/WOL tools. The browser never runs MCP directly; it calls the deployed gateway through `EXPO_PUBLIC_MCP_GATEWAY_URL`. JW.org tools run through local MCP runtimes on the server, and WOL tools run directly through this gateway.

Quick start (local):

- Install dependencies (if not already): `npm install`
- Install/update the MCP runtimes: `npm run setup:mcp-runtimes`
- Set `EXPO_PUBLIC_MCP_GATEWAY_URL=http://localhost:8788`
- Run the gateway: `npm run start:mcp-gateway`

Same-origin web deployment:

- Build the web app with the MCP gateway left relative/same-origin: `npm run build:web:same-origin`
- Start the app and gateway from the same Node service: `npm run start:online`
- Your app is served from `/`, and MCP routes are served from `/api/mcp/*`, for example `/api/mcp/wol/search` and `/api/mcp/call`.

Deployment notes:
- Host this gateway as a small long-running Node service (Render, Fly, Railway, a VPS, or a container). Set `EXPO_PUBLIC_MCP_GATEWAY_URL` in the Expo web build to the deployed gateway URL.
- During deployment, run `npm run setup:mcp-runtimes` before starting `npm run start:mcp-gateway`, or provide your own commands with `JW_MCP_COMMAND`/`JW_MCP_ARGS` and `JWORG_MCP_COMMAND`/`JWORG_MCP_ARGS`.
- WOL does not need a separate service. This gateway uses direct WOL HTTP retrieval for `/api/mcp/wol/*`, so the same deployed Node service powers local and online web.
- The gateway uses stdio MCP, so it should run as a persistent service. A static-only Expo host cannot run MCP by itself.

MCP runtimes:

The app expects MCP-like servers for enriched JW.org source retrieval. WOL source retrieval is built into the gateway:
- https://github.com/advenimus/jw-mcp
- https://github.com/Bjern/jw-org-mcp

Default runtime commands:
- `jw-mcp`: `node vendor/mcp/jw-mcp/src/index.js`
- `jw-org-mcp`: `uv --directory vendor/mcp/jw-org-mcp run jw-org-mcp`

`npm run dev` starts the local proxy, MCP gateway, and Expo web together so you do not need to run the web app twice.

Named MCP routes:
- JW.org: `/api/mcp/jworg/search`, `/api/mcp/jworg/article`, `/api/mcp/jworg/scripture`, `/api/mcp/jworg/cache-stats`
- WOL: `/api/mcp/wol/search`, `/api/mcp/wol/document`, `/api/mcp/wol/publications`
- jw-mcp: `/api/mcp/jw/search_bible_books`, `/api/mcp/jw/get_bible_verse`, `/api/mcp/jw/get_verse_with_study`, `/api/mcp/jw/get_bible_verse_url`, `/api/mcp/jw/getWorkbookLinks`, `/api/mcp/jw/getWorkbookContent`, `/api/mcp/jw/getWatchtowerLinks`, `/api/mcp/jw/getWatchtowerContent`, `/api/mcp/jw/get_jw_captions`
- Any configured tool: `/api/mcp/call`

AI-provider-neutral tool API:
- Tool manifest for OpenAI/Anthropic-style function definitions: `/api/ai/tools`
- Tool execution endpoint for any AI provider you integrate: `POST /api/ai/tool` with `{ "name": "wol_search", "arguments": { "query": "faith", "language": "en" } }`
