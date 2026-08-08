# Visualbench

Desktop and mobile screenshots of the ManifoldGen studio.

```bash
# terminal A
cd frontend && bun run dev -- --port 3219

# terminal B
VISUALBENCH_BASE_URL=http://127.0.0.1:3219 node visualbench/capture.cjs
```

| file | view |
| --- | --- |
| `desktop-01-studio.png` / `mobile-01-studio.png` | full-bleed prompt studio |
| `*-02-settings.png` | settings cog sheet |
| `*-03-signin.png` | email auth modal |
| `*-04-signed-in.png` | signed-in studio |
| `*-05-account.png` | Stripe credits / plans |
