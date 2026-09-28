// Renders DESIGN.md into design.html (same content, styled, with Mermaid diagrams). Run: npm run docs
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const [source, target] = process.argv.slice(2);
const markdown = readFileSync(source, 'utf8');
if (markdown.includes('</script')) throw new Error('DESIGN.md contains </script — cannot embed');

// Where GitHub renders this repository's files. The page is served as-is (raw.githack, a local
// file), where a relative link to a .md or source file would show raw text, so those go to GitHub.
const git = (...args) => {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};
const remote = git('remote', 'get-url', 'origin').replace(/\.git$/, '').replace(/^git@github\.com:/, 'https://github.com/');
const blobBase = remote.startsWith('https://github.com/') ? `${remote}/blob/${git('rev-parse', '--abbrev-ref', 'HEAD') || 'master'}/` : '';

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mission Control — Design Document</title>
<!-- Generated from DESIGN.md by npm run docs: edit the markdown, then regenerate. -->
<script src="https://cdn.jsdelivr.net/npm/marked@12/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<style>
  :root { --bg:#0d1117; --surface:#161b22; --border:#30363d; --text:#e6edf3; --muted:#8b949e; --accent:#58a6ff; --green:#3fb950; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.65 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  .layout { display: flex; max-width: 1440px; margin: 0 auto; }
  nav { position: sticky; top: 0; align-self: flex-start; height: 100vh; overflow-y: auto; width: 270px; flex-shrink: 0; padding: 24px 16px; border-right: 1px solid var(--border); }
  nav h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); margin: 0 0 12px; }
  nav a { display: block; color: var(--text); text-decoration: none; padding: 5px 8px; border-radius: 6px; font-size: 13.5px; }
  nav a:hover { background: var(--surface); color: var(--accent); }
  main { flex: 1; padding: 32px 48px 96px; min-width: 0; }
  h1 { font-size: 30px; margin: 0 0 8px; }
  h2 { font-size: 22px; margin: 48px 0 12px; padding-top: 16px; border-top: 1px solid var(--border); }
  h3 { font-size: 16px; margin: 28px 0 8px; color: var(--accent); }
  a { color: var(--accent); }
  p, li { margin: 6px 0; }
  blockquote { margin: 12px 0; padding: 8px 16px; border-left: 3px solid var(--accent); background: var(--surface); border-radius: 0 8px 8px 0; color: var(--muted); }
  code { background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 1px 6px; font: 13px/1.5 "SF Mono", Consolas, monospace; color: #79c0ff; }
  pre { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 14px 18px; overflow-x: auto; }
  pre code { border: none; padding: 0; color: #7ee787; }
  table { border-collapse: collapse; width: 100%; margin: 14px 0; font-size: 13.5px; display: block; overflow-x: auto; }
  th, td { border: 1px solid var(--border); padding: 8px 10px; text-align: left; vertical-align: top; }
  th { background: var(--surface); font-weight: 600; }
  tr:nth-child(even) td { background: rgba(22,27,34,.5); }
  strong { color: #f0f6fc; }
  p > strong:first-child { color: var(--green); }
  .mermaid { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 20px; margin: 16px 0; text-align: center; overflow-x: auto; }
  @media (max-width: 900px) { nav { display: none; } main { padding: 24px 16px 64px; } }
</style>
</head>
<body>
<div class="layout">
  <nav><h2>Mission Control</h2><div id="toc"></div></nav>
  <main id="content"><p style="color:var(--muted)">Rendering…</p></main>
</div>
<script type="text/markdown" id="design-md">
${markdown}
</script>
<script>
  const content = document.getElementById('content');
  content.innerHTML = marked.parse(document.getElementById('design-md').textContent);
  // Links to other .md or source files open on GitHub (rendered); links to the other .html pages stay relative.
  const blobBase = ${JSON.stringify(blobBase)};
  if (blobBase) {
    content.querySelectorAll('a[href]').forEach((link) => {
      const href = link.getAttribute('href');
      if (/^([a-z]+:|#)/i.test(href) || /[.]html(#|$)/.test(href)) return;
      link.href = blobBase + href.replace(/^[.][/]/, '');
    });
  }
  document.querySelectorAll('pre > code.language-mermaid').forEach((code) => {
    const diagram = document.createElement('div');
    diagram.className = 'mermaid';
    diagram.textContent = code.textContent;
    code.parentElement.replaceWith(diagram);
  });
  const toc = document.getElementById('toc');
  content.querySelectorAll('h2, h3').forEach((heading) => {
    heading.id = heading.textContent.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (heading.tagName !== 'H2') return;
    const link = document.createElement('a');
    link.href = '#' + heading.id;
    link.textContent = heading.textContent;
    toc.appendChild(link);
  });
  // Headings get their ids only now, so follow a #section link (e.g. from test-report.html) by hand,
  // and again once the diagrams have rendered and moved the layout.
  const followHash = () => {
    const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) target.scrollIntoView();
  };
  followHash();
  mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict', flowchart: { htmlLabels: true } });
  mermaid.run().then(followHash);
</script>
</body>
</html>
`;
writeFileSync(target, html);
console.log(`wrote ${target} (${html.length} bytes)`);
