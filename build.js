const fs = require('fs');
const d = __dirname + '/';
const rd = f => fs.readFileSync(d + f, 'utf8');
const app = "(function () {\n'use strict';\n" + rd('app-common.js') + '\n' + rd('app-student.js') + '\n' + rd('app-teacher.js') + '\n})();';
if (/<\/script/i.test(app) || /<\/script/i.test(rd('omr-core.js'))) throw new Error('script terminator inside source');
const clean = app.replace('/*__TEST_HOOK__*/', '');
const html = rd('shell.html').replace('<!--OMR-->', () => rd('omr-core.js')).replace('<!--APP-->', () => clean);
fs.writeFileSync(d + 'pencilmark.html', html);
// pencilmark.html is the Claude artifact: the artifact host wraps it in a document with a viewport tag.
// Static hosts (Vercel) serve the file as is, so index.html gets its own document head: without the
// viewport tag, Android and iPhone browsers lay the page out 980px wide and shrink it.
const doc = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
  '<meta name="theme-color" content="#F5F6F1" media="(prefers-color-scheme: light)">\n' +
  '<meta name="theme-color" content="#141618" media="(prefers-color-scheme: dark)">\n' +
  '<meta name="apple-mobile-web-app-title" content="SnapGrade">\n<meta name="format-detection" content="telephone=no">\n' +
  '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n' +
  html + '\n</html>\n';
fs.writeFileSync(d + 'index.html', doc);   // static hosts serve it at /
fs.mkdirSync(d + 'public', { recursive: true });
fs.writeFileSync(d + 'public/index.html', doc);   // what Vercel publishes (see vercel.json)
fs.writeFileSync(d + 'bundle.js', rd('omr-core.js') + '\n' + app.replace('/*__TEST_HOOK__*/', 'if (window.__PM_TEST) window.__PM_TEST.api = { T, saveScan, scanCard, render, examsHTML, resultsHTML, settingsHTML, restore: restoreBackup };'));
console.log('built', html.length, 'bytes');
