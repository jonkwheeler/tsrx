export type DemoSnippet = {
	value: string;
	label: string;
	source: string;
	targets?: string[];
};

export const DEMO_SNIPPETS: DemoSnippet[] = [
	{
		value: 'feature-card',
		label: 'Feature card',
		targets: ['hono', 'hono-dom', 'octane', 'react', 'preact', 'ripple', 'solid', 'vue'],
		source: `export function FeatureCard({
  title,
  items,
  ready,
}: {
  title: string;
  items: string[];
  ready: boolean;
}) @{
  <>
    <section class="feature-card">
      <h2>{title}</h2>

      @if (ready) {
        <ul>
          @for (const item of items; index index) {
            <li>{item}</li>
          }
        </ul>
      } @else {
        <p>Loading output...</p>
      }
    </section>

    <style>
      .feature-card {
        padding: 1rem;
        border: 1px solid rgba(90, 108, 255, 0.2);
        background: rgba(255, 255, 255, 0.78);
      }

      .feature-card h2 {
        margin: 0 0 0.75rem;
        font-size: 1.15rem;
      }

      .feature-card ul {
        margin: 0;
        padding-left: 1.1rem;
      }
    </style>
  </>
}`,
	},
	{
		value: 'components',
		label: 'Components + style',
		source: `export function Button({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) @{
  <>
    <button class="btn" {onClick}>{label}</button>

    <style>
      .btn {
        padding: 0.5rem 1rem;
        border-radius: 4px;
      }
    </style>
  </>
}`,
	},
	{
		value: 'conditional-rendering',
		label: 'Conditional rendering',
		targets: ['hono', 'hono-dom', 'octane', 'react', 'preact', 'ripple', 'solid', 'vue'],
		source: `function StatusBadge({ status }: { status: 'active' | 'idle' | 'offline' }) @{
  @if (status === 'active') {
    <span class="badge active">Online</span>
  } @else if (status === 'idle') {
    <span class="badge idle">Away</span>
  } @else {
    <span class="badge">Offline</span>
  }
}`,
	},
	{
		value: 'list-rendering',
		label: 'List rendering',
		targets: ['hono', 'hono-dom', 'octane', 'react', 'preact', 'ripple', 'solid', 'vue'],
		source: `function TodoList({ items }: { items: { text: string }[] }) @{
  <ul>
    @for (const item of items; index i) {
      <li>{i + 1}. {item.text}</li>
    }
  </ul>
}`,
	},
	{
		value: 'switch-statements',
		label: 'Switch statements',
		targets: ['hono', 'hono-dom', 'octane', 'react', 'preact', 'ripple', 'solid', 'vue'],
		source: `function StatusMessage({ status }: { status: string }) @{
  @switch (status) {
    @case 'loading': {
      <p>Loading...</p>
    }
    @case 'success': {
      <p class="success">Done!</p>
    }
    @default: {
      <p>Unknown status.</p>
    }
  }
}`,
	},
	{
		value: 'error-boundary',
		label: 'Error boundary',
		targets: ['hono', 'hono-dom', 'octane', 'react', 'preact', 'ripple', 'solid', 'vue'],
		source: `function SafeProfile({ userId }: { userId: string }) @{
  @try {
    <UserProfile id={userId} />
  } @catch (error) {
    <div class="error">
      <p>Something went wrong.</p>
    </div>
  }
}`,
	},
	{
		value: 'async-boundary',
		label: 'Async boundary',
		targets: ['hono', 'octane', 'react', 'preact', 'ripple', 'solid', 'vue'],
		source: `import { AsyncProfile } from './profile.tsrx';

export function App() @{
  @try {
    <AsyncProfile />
  } @pending {
    <p class="pending">Loading profile...</p>
  }
}`,
	},
	{
		value: 'async-boundary-error',
		label: 'Async + Error boundary',
		targets: ['hono', 'octane', 'react', 'preact', 'ripple', 'solid', 'vue'],
		source: `import { AsyncProfile } from './profile.tsrx';

export function App() @{
  @try {
    <AsyncProfile />
  } @pending {
    <p class="pending">Loading profile...</p>
  } @catch (error) {
    <p class="error">{(error as Error).message}</p>
  }
}`,
	},
	{
		value: 'scoped-styles',
		label: 'Scoped styles',
		source: `function Card() @{
  <>
    <div class="card">
      <h2>Scoped title</h2>
      <p>Styles here do not leak out.</p>
    </div>

    <style>
      .card {
        padding: 1.5rem;
        border: 1px solid #ddd;
      }

      h2 {
        color: #333;
      }
    </style>
  </>
}`,
	},
	{
		value: 'themes-apply',
		label: 'Themes with apply',
		// Octane and Ripple pin an older @tsrx/core without `$class`/`apply`.
		targets: ['hono', 'hono-dom', 'react', 'preact', 'solid', 'vue'],
		source: `export const theme = <style>
  div {
    color: green;
  }

  .dark {
    color: purple;
  }
</style>;

export function Panel() @{
  <>
    <style apply={theme}>
      /* Scope A; also stamps theme.$class on every element of A. */
      div {
        color: black;
      }
    </style>

    <span class={theme.dark}>Purple</span>
    <div>Black: the local rule beats the theme's green.</div>

    @{
      <>
        <style>
          /* Scope B, nested inside A. */
          div {
            font-weight: bold;
          }
        </style>
        <div>Black and bold: A, B, and the theme all reach here.</div>
      </>
    }
  </>
}`,
	},
	{
		value: 'themes-class',
		label: 'Theme opt-in with $class',
		// Octane and Ripple pin an older @tsrx/core without `$class`/`apply`.
		targets: ['hono', 'hono-dom', 'react', 'preact', 'solid', 'vue'],
		source: `function Card({ parentClass }: { parentClass: string }) @{
  <>
    <style>
      .local {
        padding: 0;
      }
    </style>
    <article class={\`local \${parentClass}\`}>
      <h2 class={parentClass}>Title</h2>
    </article>
  </>
}

export function App() @{
  // Reading theme.$class makes the block a theme: div { ... } is kept.
  const theme = <style>
    div {
      color: blue;
    }

    .card {
      color: red;
    }
  </style>;

  <>
    <Card parentClass={theme.$class} />
    <div class={theme.$class}>Blue: opted in</div>
    <div class={theme.card}>Red: theme.card</div>
    <p>Untouched</p>
  </>
}`,
	},
	{
		value: 'hono-server-starter',
		label: 'Hono server starter',
		targets: ['hono'],
		source: `import { Hono } from 'hono';

function Page({ name }: { name: string }) @{
  <main>
    <h1>Hello, {name}!</h1>
    <p>This page is rendered by Hono on the server.</p>
  </main>
}

const app = new Hono();
app.get('/', (c) => c.html(<Page name={c.req.query('name') ?? 'TSRX'} />));
export default app;`,
	},
	{
		value: 'hono-dom-starter',
		label: 'Hono DOM state + refs',
		targets: ['hono-dom'],
		source: `import { useRef, useState } from 'hono/jsx';

export function Counter() @{
  const [count, setCount] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  <section>
    <button onClick={() => setCount((value) => value + 1)}>Count: {count}</button>
    <input ref={input} placeholder="Focus me" />
    <button onClick={() => input.current?.focus()}>Focus input</button>
  </section>
}`,
	},
	{
		value: 'hono-keyed-list',
		label: 'Hono keyed list + empty state',
		targets: ['hono', 'hono-dom'],
		source: `type Todo = { id: string; title: string; done: boolean };

export function TodoList({ items }: { items: Todo[] }) @{
  <ul>
    @for (const item of items; index i; key item.id) {
      const status = item.done ? 'Done' : 'To do';
      <li>{i + 1}. {item.title} — {status}</li>
    } @empty {
      <li>No todos yet.</li>
    }
  </ul>
}`,
	},
	{
		value: 'hono-dynamic-tags',
		label: 'Hono dynamic tags',
		targets: ['hono', 'hono-dom'],
		source: `export function Panel({
  tag = 'section',
  title,
}: {
  tag?: 'section' | 'article';
  title: string;
}) @{
  <{tag} class="panel">
    <h2>{title}</h2>
    <p>The element follows the tag prop.</p>
  </{tag}>
}`,
	},
	{
		value: 'hono-server-streaming',
		label: 'Hono server async + streaming',
		targets: ['hono'],
		source: `import { Hono } from 'hono';
import { renderToReadableStream } from 'hono/jsx/streaming';

async function Profile() @{
  const profile = await Promise.resolve({ name: 'Ada' });
  <p>Hello, {profile.name}!</p>
}

function Page() @{
  @try {
    <Profile />
  } @pending {
    <p>Loading profile...</p>
  } @catch (error) {
    <p role="alert">{(error as Error).message}</p>
  }
}

const app = new Hono();
app.get('/', (c) => c.body(renderToReadableStream(<Page />), {
  headers: { 'Content-Type': 'text/html; charset=UTF-8' },
}));
export default app;`,
	},
	{
		value: 'hono-dom-suspense',
		label: 'Hono DOM use + async boundary',
		targets: ['hono-dom'],
		source: `import { use } from 'hono/jsx';

// Keep the promise stable across renders. DOM components stay synchronous.
const profilePromise = Promise.resolve({ name: 'Ada' });

function Profile() @{
  const profile = use(profilePromise);
  <p>Hello, {profile.name}!</p>
}

export function App() @{
  @try {
    <Profile />
  } @pending {
    <p>Loading profile...</p>
  } @catch (error) {
    <p role="alert">{(error as Error).message}</p>
  }
}`,
	},
	{
		value: 'hono-dom-context',
		label: 'Hono DOM context',
		targets: ['hono-dom'],
		source: `import { createContext, useContext } from 'hono/jsx/dom';

const Theme = createContext('light');

function ThemeLabel() @{
  const theme = useContext(Theme);
  <p class={theme}>Current theme: {theme}</p>
}

export function App() @{
  <Theme.Provider value="dark">
    <ThemeLabel />
  </Theme.Provider>
}`,
	},
	{
		value: 'octane-starter',
		label: 'Octane starter',
		targets: ['octane'],
		source: `import { useEffect, useState } from 'octane';

function App() @{
  const [count, setCount] = useState(0);

  useEffect(() => {
    document.title = \`Count: \${count}\`;
  });

  <main>
    <h1>Hello from TSRX + Octane</h1>
    <button onClick={() => setCount(count + 1)}>Count: {count}</button>
  </main>
}

export default App;`,
	},
	{
		value: 'vue-starter',
		label: 'Vue starter',
		targets: ['vue'],
		source: `import { ref } from 'vue';

function App() @{
  const count = ref(0);

  <main>
    <h1>Hello from TSRX Vue</h1>
    <p>This is a minimal Vue-compatible TSRX snippet.</p>
    <button onClick={() => count.value++}>Count: {count.value}</button>
  </main>
}

export default App;`,
	},
];
