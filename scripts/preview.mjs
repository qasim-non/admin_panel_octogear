// Local preview of the production build; not a production hosting server.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';

const root = resolve('dist/octogear-admin/browser');
if (!existsSync(resolve(root, 'index.html'))) throw new Error('Run npm run build before npm run preview.');
const contentTypes = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.ttf':'font/ttf', '.woff2':'font/woff2', '.ico':'image/x-icon' };
const server = createServer((request, response) => {
    if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
    let file;
    try {
        const path = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
        file = resolve(root, '.' + path);
        if (file !== root && !file.startsWith(root + sep)) { response.writeHead(403); response.end(); return; }
        if (!existsSync(file) || !statSync(file).isFile()) {
            if (extname(path)) { response.writeHead(404); response.end(); return; }
            file = resolve(root, 'index.html');
        }
    } catch { response.writeHead(400); response.end(); return; }
    response.writeHead(200, { 'Content-Type': contentTypes[extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' });
    if (request.method === 'HEAD') { response.end(); return; }
    createReadStream(file).on('error', () => response.destroy()).pipe(response);
});
server.listen(4200, '127.0.0.1', () => console.log('OctoGear preview: http://127.0.0.1:4200'));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
