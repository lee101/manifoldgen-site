// Minimal clean-URL static server for verifying the Next.js export locally.
const root = new URL(`file://${process.cwd()}/frontend/out`);
Bun.serve({
  port: Number(process.env.PORT || 3900),
  async fetch(req) {
    const url = new URL(req.url);
    let path = decodeURIComponent(url.pathname);
    let file = Bun.file(root.pathname + path);
    if (path.endsWith('/')) file = Bun.file(root.pathname + path + 'index.html');
    if (!(await file.exists())) file = Bun.file(root.pathname + path + '.html');
    if (!(await file.exists())) file = Bun.file(root.pathname + path + '/index.html');
    if (!(await file.exists())) return new Response('not found\n', { status: 404 });
    return new Response(file);
  },
});
console.log('serving on :' + (process.env.PORT || 3900));
