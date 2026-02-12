# Ripple Metaframework Design

## Overview

This document outlines the design for a Ripple metaframework that provides SSR (Server-Side Rendering) capabilities while maintaining simplicity and leveraging standard Web APIs. The design prioritizes:

- **Standard Web APIs**: Using `fetch`, `Request`, `Response` throughout
- **Platform Agnostic Core**: Server core works anywhere via adapters
- **Single Template**: One `basic` template with SSR as an option
- **Development/Production Parity**: User code is identical in dev and prod
- **Type Safety**: Full TypeScript support with type-safe routing and navigation

## Architecture

### High-Level Flow

```
Platform Runtime (Node, Cloudflare, Vercel, etc.)
  ↓
Adapter (IO translation, platform-specific)
  ↓
Framework Entry: fetch(request) → Response
  ↓
Middleware Pipeline (user-provided)
  ↓
Router → Match route → Execute handlers
  ↓
Render Component OR Execute API Handler
  ↓
HTML Assembly (inject into index.html)
  ↓
Response (Headers + Body)
  ↓
Adapter → Platform Runtime
```

### Core Components

#### 1. **Ripple Server Core** (`ripple` package)

Platform-agnostic server functionality built on standard Web APIs.

**Location**: Inside the main `ripple` package (not separate)

**Key Functions**:

- `createApp(options)` - Creates the main application instance
- `render(Component)` - Server-side rendering
- Standard middleware/routing utilities

**Environment Handling**:

```typescript
// Development Mode
import { createServer as createViteServer } from 'vite';

const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: 'custom',
});

// Load modules dynamically
const { App } = await vite.ssrLoadModule('./src/App.ripple');

// Transform HTML
const html = await vite.transformIndexHtml(url, template);
```

```typescript
// Production Mode
import { App } from './dist/server/entry-server.js';
import indexHtml from './dist/client/index.html';

// Direct imports, no Vite needed
```

#### 2. **Adapters** (e.g., `@ripple-ts/adapter-node`)

Platform-specific implementations that translate between platform I/O and standard Web APIs.

**Characteristics**:

- No knowledge of app structure, middleware, or routes
- Same code for dev and prod
- Only handle request/response translation
- Can provide platform-specific context

**Example: Node Adapter**

```typescript
// @ripple-ts/adapter-node/index.js
import { createServer } from 'node:http';

export function serve(fetchHandler, options = {}) {
  const { port = 3000, hostname = 'localhost' } = options;

  const server = createServer(async (nodeReq, nodeRes) => {
    // Translate Node.js request to Web API Request
    const request = nodeRequestToWebRequest(nodeReq);

    // Call the framework's fetch handler
    const response = await fetchHandler(request);

    // Translate Web API Response to Node.js response
    webResponseToNodeResponse(response, nodeRes);
  });

  return {
    listen(port = options.port) {
      server.listen(port, hostname, () => {
        console.log(`Server running at http://${hostname}:${port}/`);
      });
      return server;
    },
    close() {
      server.close();
    },
  };
}

function nodeRequestToWebRequest(nodeReq) {
  const url = `http://${nodeReq.headers.host}${nodeReq.url}`;
  return new Request(url, {
    method: nodeReq.method,
    headers: nodeReq.headers,
    body: nodeReq.method !== 'GET' && nodeReq.method !== 'HEAD' ? nodeReq : undefined,
  });
}

function webResponseToNodeResponse(webRes, nodeRes) {
  nodeRes.statusCode = webRes.status;

  webRes.headers.forEach((value, key) => {
    nodeRes.setHeader(key, value);
  });

  if (webRes.body) {
    webRes.body.pipeTo(
      new WritableStream({
        write(chunk) {
          nodeRes.write(chunk);
        },
        close() {
          nodeRes.end();
        },
      }),
    );
  } else {
    nodeRes.end();
  }
}
```

**Example: Cloudflare Adapter (Future)**

```typescript
// @ripple-ts/adapter-cloudflare/index.js
export default {
  async fetch(request, env, ctx) {
    // request is already a Web API Request
    // Just pass through to framework
    return await fetchHandler(request, {
      env, // Cloudflare environment variables
      ctx, // Execution context
      waitUntil: ctx.waitUntil.bind(ctx),
    });
  },
};
```

#### 3. **User Entry Code** (`src/entry-server.js` or `server.js`)

User-defined application that wires everything together.

```typescript
// src/server.js
import { createApp } from 'ripple';
import { serve } from '@ripple-ts/adapter-node';
import { routes } from './routes.js';
import { authMiddleware, loggingMiddleware } from './middleware.js';

// Create the application
const app = createApp({
  routes,
  mode: 'ssr', // 'ssr' | 'client-only' | 'hybrid'
  disableHydration: false,
});

// Register middleware
app.use(loggingMiddleware);
app.use(authMiddleware);

// Get the fetch handler
const { fetch } = app;

// Start the server with the adapter
if (import.meta.env.PROD) {
  const server = serve(fetch, { port: 3000 });
  server.listen();
}

// Export for development mode
export { fetch };
```

#### 4. **Route Configuration** (`src/routes.js`)

Type-safe, JavaScript/TypeScript-based route configuration.

```typescript
// src/routes.js
import { RenderRoute, ServerRoute, RouteGroup } from 'ripple/routing';
import Home from './pages/Home.ripple';
import About from './pages/About.ripple';
import BlogPost from './pages/BlogPost.ripple';
import { requireAuth, loadUser } from './middleware.js';

export const routes = [
  // Simple render route
  new RenderRoute({
    path: '/',
    component: Home,
    deliveryMode: 'ssr-stream', // 'ssr-pre-render' | 'ssr-stream' | 'ssr-complete' | 'client-only'
  }),

  // Route with middleware
  new RenderRoute({
    path: '/about',
    component: About,
    before: [loadUser],
    after: [],
  }),

  // Dynamic route with params
  new RenderRoute({
    path: '/blog/:slug',
    component: BlogPost,
    before: [loadUser],
  }),

  // API route (server-only)
  new ServerRoute({
    path: '/api/user/:id',
    methods: ['GET', 'POST'],
    handler: async (request, context, app) => {
      const { id } = context.params;
      const user = await db.user.findById(id);
      return Response.json(user);
    },
  }),

  // Route group - shared path prefix and middleware
  new RouteGroup({
    path: '/dashboard',
    before: [requireAuth],
    routes: [
      new RenderRoute({
        path: '/',
        component: Dashboard,
      }),
      new RenderRoute({
        path: '/settings',
        component: Settings,
      }),
      new ServerRoute({
        path: '/api/data',
        methods: ['GET'],
        handler: async (req, ctx, app) => {
          // Handler here
        },
      }),
    ],
  }),
];
```

**Route Types**:

```typescript
// Type definitions for routes

interface RenderRouteOptions {
  path: string;
  component: Component;
  deliveryMode?: 'ssr-pre-render' | 'ssr-stream' | 'ssr-complete' | 'client-only';
  before?: Middleware[];
  after?: Middleware[];
  meta?: Record<string, any>;
}

interface ServerRouteOptions {
  path: string;
  methods?: string[]; // ['GET', 'POST'], defaults to all methods
  handler: Handler;
  before?: Middleware[];
}

interface RouteGroupOptions {
  path: string;
  before?: Middleware[];
  routes: Route[];
}

type Handler = (request: Request, context: Context, app: App) => Response | Promise<Response>;
```

## Middleware System

Middleware functions receive four parameters and follow standard Web API patterns.

### Middleware Signature

```typescript
type Middleware = (
  request: Request, // Web API Request
  context: Context, // Mutable request-scoped state
  app: App, // Immutable application state
  next: () => Promise<Response>, // Continue to next handler
) => Promise<Response>;
```

### Parameter Details

**`request`**: Standard Web API Request object

```typescript
const url = new URL(request.url);
const method = request.method;
const headers = request.headers;
const body = await request.json();
```

**`context`**: Mutable request-scoped state

```typescript
interface Context {
  params: Record<string, string>; // Route parameters
  query: URLSearchParams; // Query string
  state: Map<string, any>; // Custom state storage
  locals: Record<string, any>; // Response locals
  set(key: string, value: any): void;
  get(key: string): any;
}
```

**`app`**: Immutable application state

```typescript
interface App {
  routes: Routes;
  navigation: Navigation; // Type-safe navigation utilities
  config: AppConfig;
  // Platform-specific context (from adapter)
  platform?: {
    env?: any; // Environment variables
    ctx?: any; // Execution context
  };
}
```

**`next`**: Function to continue the middleware chain

```typescript
const response = await next(); // Continue to next middleware
```

### Middleware Examples

**Logging Middleware**

```typescript
export async function loggingMiddleware(request, context, app, next) {
  const start = Date.now();
  const { method, url } = request;

  console.log(`→ ${method} ${url}`);

  const response = await next();

  const duration = Date.now() - start;
  console.log(`← ${method} ${url} ${response.status} (${duration}ms)`);

  return response;
}
```

**Authentication Middleware**

```typescript
export async function requireAuth(request, context, app, next) {
  const token = request.headers.get('Authorization');

  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const user = await verifyToken(token);
    context.set('user', user);
    return await next();
  } catch (error) {
    return new Response('Invalid token', { status: 403 });
  }
}
```

**CORS Middleware**

```typescript
export async function cors(request, context, app, next) {
  const response = await next();

  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
```

**Data Loading Middleware**

```typescript
export async function loadUser(request, context, app, next) {
  const userId = context.params.id || context.get('userId');

  if (userId) {
    const user = await db.user.findById(userId);
    context.set('user', user);
  }

  return await next();
}
```

## Type-Safe Navigation

The routing system provides type-safe navigation utilities.

```typescript
// Generate in routes.js (or auto-generated)
export const navigation = createNavigation(routes);

// Usage in components
import { navigation } from './routes.js';

component BlogPost() {
  const handleClick = () => {
    // Type-safe navigation with auto-complete and validation
    navigation.navigateTo('/blog/:slug', {
      params: { slug: 'hello-world' },
      query: { ref: 'homepage' }
    });
  };

  // Type-safe URL generation
  const url = navigation.url('/blog/:slug', { slug: 'hello-world' });

  <div>
    <button onClick={handleClick}>{"Navigate"}</button>
    <Link href={url}>{"Read Post"}</Link>
  </div>
}
```

**Navigation API**:

```typescript
interface Navigation {
  navigateTo(path: string, options?: NavigateOptions): void;
  url(path: string, params?: Record<string, string>): string;
  back(): void;
  forward(): void;
  push(path: string): void;
  replace(path: string): void;
  history: History;
}
```

## Component-Level Server Code

Using Ripple's `#server` blocks for co-located server logic.

```typescript
// BlogPost.ripple
import { track } from 'ripple';

component BlogPost({ slug }) {
  let post = track(null);

  #server {
    // Runs only on server
    const loadPost = async () => {
      const data = await db.posts.findBySlug(slug);
      return data;
    };

    // Can register middleware/hooks inline
    this.before(requireAuth);
    this.before(async (request, context, app) => {
      const data = await loadPost();
      context.set('post', data);
    });
  }

  // Client code
  effect(() => {
    // Load post data on client
    if (!@post) {
      fetchPost(slug).then(data => post = data);
    }
  });

  return (
    <article>
      <h1>{@post?.title}</h1>
      <div>{@post?.content}</div>
    </article>
  );
}
```

## Installation & Project Setup

### Create New Project

```bash
# Basic client-only app
npm create ripple@latest my-app

# With SSR support
npm create ripple@latest my-app --ssr

# With SSR and specific adapter
npm create ripple@latest my-app --ssr --adapter=node

# With mode selection (which npm script to run after install)
npm create ripple@latest my-app --ssr --mode=server --adapter=node
```

**CLI Options**:

- `--ssr`: Install SSR development server and dependencies (default: false)
- `--mode`: Which mode to start after installation: `client` | `server` (default: `server` if ssr, otherwise `client`)
- `--adapter`: Adapter to install: `node` | `cloudflare` | `vercel` (default: `node`)

### Project Structure

```
my-app/
├── src/
│   ├── App.ripple           # Main app component
│   ├── server.js            # Server entry (if --ssr)
│   ├── routes.js            # Route configuration (if --ssr)
│   ├── middleware.js        # Middleware functions (if --ssr)
│   ├── pages/               # Page components
│   │   ├── Home.ripple
│   │   ├── About.ripple
│   │   └── Blog.ripple
│   └── components/          # Reusable components
├── public/                  # Static assets
├── index.html               # HTML template
├── package.json
├── vite.config.js
└── tsconfig.json
```

### package.json Scripts

```json
{
  "name": "my-app",
  "scripts": {
    "dev": "vite --host",
    "dev:ssr": "node src/server.js",
    "build:client": "vite build --outDir dist/client",
    "build:ssr": "vite build --ssr src/server.js --outDir dist/server",
    "build": "pnpm run build:client && pnpm run build:ssr",
    "preview": "node dist/server/server.js"
  },
  "dependencies": {
    "ripple": "latest"
  },
  "devDependencies": {
    "@ripple-ts/vite-plugin": "latest",
    "@ripple-ts/adapter-node": "latest",
    "vite": "latest"
  }
}
```

## Configuration Variations

### 1. Client-Only Mode

```typescript
// src/main.js
import { mount } from 'ripple';
import App from './App.ripple';

mount(App, {
  target: document.getElementById('root'),
});
```

**package.json**:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  }
}
```

### 2. SSR with Streaming

```typescript
// src/server.js
import { createApp, renderToStream } from 'ripple';
import { serve } from '@ripple-ts/adapter-node';
import { routes } from './routes.js';

const app = createApp({
  routes,
  mode: 'ssr',
  streaming: true,
});

app.use(async (request, context, app, next) => {
  const route = app.routes.match(new URL(request.url).pathname);

  if (route?.type === 'render') {
    const stream = await renderToStream(route.component);

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/html',
        'Transfer-Encoding': 'chunked',
      },
    });
  }

  return await next();
});

const { fetch } = app;
const server = serve(fetch, { port: 3000 });
server.listen();
```

### 3. Hybrid Mode (Some SSR, Some Client-Only)

```typescript
// src/routes.js
export const routes = [
  new RenderRoute({
    path: '/',
    component: Home,
    deliveryMode: 'ssr-complete', // Full SSR
  }),

  new RenderRoute({
    path: '/dashboard',
    component: Dashboard,
    deliveryMode: 'client-only', // Client-side only
  }),

  new RenderRoute({
    path: '/blog/:slug',
    component: BlogPost,
    deliveryMode: 'ssr-stream', // Streaming SSR
  }),
];
```

### 4. Static Site Generation (Pre-rendering)

```typescript
// scripts/generate-static.js
import { createApp, renderToString } from 'ripple';
import { routes } from './src/routes.js';
import fs from 'node:fs';
import path from 'node:path';

const app = createApp({ routes, mode: 'ssr' });

const staticRoutes = [
  '/',
  '/about',
  '/contact',
  // ... other static routes
];

for (const route of staticRoutes) {
  const request = new Request(`http://localhost${route}`);
  const response = await app.fetch(request);
  const html = await response.text();

  const filePath = path.join('dist', route === '/' ? 'index.html' : `${route}.html`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, html);
}
```

**package.json**:

```json
{
  "scripts": {
    "build": "vite build && node scripts/generate-static.js"
  }
}
```

## Advanced Features

### Static/Server Components

Components that only render on the server and don't hydrate on the client.

```typescript
// Variation 1: Using keyword
static component Header() {
  // Only rendered on server, no client bundle
  return <header>{"Server-only header"}</header>;
}

// Variation 2: Using keyword
server component DatabaseStatus() {
  #server {
    const stats = await db.getStats();
  }

  return (
    <div>
      {"Active connections: "}{stats.connections}
    </div>
  );
}

// Usage
component Page() {
  return (
    <div>
      <Header />
      <DatabaseStatus />
      {"Regular content"}
    </div>
  );
}
```

### Service Worker Configuration

```typescript
// src/sw-config.js
import { routes } from './routes.js';

export const swConfig = {
  // Import base routes
  routes: routes.map((r) => ({
    url: r.path,
    strategy: 'network-first', // 'cache-first' | 'network-first' | 'stale-while-revalidate'
  })),

  // Additional SW-specific config
  cacheFirst: ['/assets/**', '/images/**'],

  networkFirst: ['/api/**'],

  precache: ['/', '/about', '/contact'],
};

// Generate service worker
// scripts/generate-sw.js
import { generateServiceWorker } from 'ripple/sw';
import { swConfig } from './src/sw-config.js';

generateServiceWorker(swConfig, 'dist/sw.js');
```

### File-Based Routing (Community Package)

```typescript
// @ripple-ts/file-routing (potential community package)
import { generateRoutes } from '@ripple-ts/file-routing';

// Scans src/pages/ and generates route config
const routes = generateRoutes('./src/pages', {
  // pages/index.ripple → /
  // pages/about.ripple → /about
  // pages/blog/[slug].ripple → /blog/:slug
  // pages/api/users/[id].js → /api/users/:id (ServerRoute)

  conventions: {
    dynamic: '[param]', // Dynamic segments
    optional: '[[param]]', // Optional segments
    catch: '[...rest]', // Catch-all
  },
});

export { routes };
```

## Implementation Notes

### Development vs Production

**Development**:

- Uses Vite server in middleware mode
- Hot module replacement (HMR)
- Source maps
- `vite.ssrLoadModule()` for dynamic imports
- `vite.transformIndexHtml()` for HTML processing

**Production**:

- Pre-built bundles
- Direct imports (no Vite)
- Optimized assets
- Static HTML templates

**Key Principle**: User code is identical in both modes. The framework handles the differences internally.

### HTML Assembly

Template: `index.html`

```html
<!DOCTYPE html>
<html>
  <head>
    <!--ssr-head-->
    <!-- Ripple injects: meta tags, title, CSS -->
  </head>
  <body>
    <div id="root">
      <!--ssr-body-->
      <!-- Ripple injects: rendered HTML -->
    </div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

Server processing:

```typescript
const template = fs.readFileSync('index.html', 'utf-8');
const { head, body, css } = await render(Component);

const html = template
  .replace('<!--ssr-head-->', head + cssToTags(css))
  .replace('<!--ssr-body-->', body);

return new Response(html, {
  headers: { 'Content-Type': 'text/html' },
});
```

### Adapters Implementation Strategy

Each adapter follows the same pattern:

1. **Receive platform-specific request**
2. **Convert to Web API Request**
3. **Call `fetch(request, platformContext)`**
4. **Convert Web API Response to platform-specific response**
5. **Return to platform runtime**

Platform context is passed through the `app` object in middleware, allowing platform-specific features while keeping core code portable.

## Migration Path

### From Client-Only to SSR

1. Install adapter: `npm install @ripple-ts/adapter-node`
2. Create `src/server.js` entry
3. Create `src/routes.js` configuration
4. Update `package.json` scripts
5. Test with `npm run dev:ssr`

### From Existing SSR to This Design

1. Refactor routes into configuration format
2. Convert middleware to standard Web API pattern
3. Update entry file to use `createApp()`
4. Replace platform-specific code with adapters

## Future Extensions

### Potential Community Packages

- `@ripple-ts/file-routing` - File-based routing
- `@ripple-ts/adapter-cloudflare` - Cloudflare Workers adapter
- `@ripple-ts/adapter-vercel` - Vercel Edge Functions adapter
- `@ripple-ts/adapter-deno` - Deno adapter
- `@ripple-ts/adapter-bun` - Bun adapter
- `@ripple-ts/sw-generator` - Service worker generation
- `@ripple-ts/static-gen` - Static site generation utilities

### Additional Features

- Middleware composition utilities
- Built-in validation (request/response)
- Built-in session management
- Built-in auth patterns
- Built-in caching strategies
- GraphQL integration
- WebSocket support
- Edge computing optimizations

## Summary

This metaframework design provides:

✅ **Simple Setup**: One template, optional SSR via CLI flags
✅ **Standard Web APIs**: Request/Response throughout
✅ **Platform Agnostic**: Adapters for any runtime
✅ **Dev/Prod Parity**: Same user code in both environments
✅ **Type Safety**: Full TypeScript support with type-safe routing
✅ **Flexibility**: Client-only, SSR, hybrid, or static generation
✅ **Extensibility**: Community packages for additional features
✅ **Co-location**: Server code can live with components
✅ **Progressive Enhancement**: Start simple, add SSR when needed

The design balances simplicity for getting started with power for advanced use cases, all while maintaining the ergonomics and performance that make Ripple unique.
