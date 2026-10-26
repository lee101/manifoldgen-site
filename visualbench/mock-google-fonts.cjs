// Offline stand-in for next/font/google: NEXT_FONT_GOOGLE_MOCKED_RESPONSES=<this file>.
// Any requested font URL resolves to a one-face stylesheet; font bytes are mocked by Next itself.
const family = (url) => decodeURIComponent((String(url).match(/family=([^:&]+)/) || [, 'Mock'])[1]).replace(/\+/g, ' ');

module.exports = new Proxy({}, {
  get: (_, url) => typeof url === 'string'
    ? `/* latin */\n@font-face {\n  font-family: '${family(url)}';\n  font-style: normal;\n  font-weight: 400;\n  font-display: swap;\n  src: url(https://fonts.gstatic.com/s/mock/${encodeURIComponent(family(url))}.woff2) format('woff2');\n  unicode-range: U+0000-00FF;\n}\n`
    : undefined,
});
