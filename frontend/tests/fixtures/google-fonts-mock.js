const css = (family) => `/* latin */
@font-face {
  font-family: '${family}';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/mock/v1/mock.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}
`;

module.exports = new Proxy({}, {
  get(_target, key) {
    if (typeof key !== 'string') return undefined;
    const match = /family=([^:&]+)/.exec(key);
    return css(match ? decodeURIComponent(match[1]).replace(/\+/g, ' ') : 'Mock');
  },
});
