"""Serve Next.js static export, including extensionless routes, without dependencies."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, unquote
ROOT = Path(__file__).resolve().parents[1] / 'out'
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def do_GET(self):
        path = unquote(urlsplit(self.path).path)
        candidate = (ROOT / path.lstrip('/')).resolve()
        if ROOT in candidate.parents and not candidate.suffix and candidate.with_suffix('.html').is_file():
            self.path = path.rstrip('/') + '.html'
        elif not candidate.exists() and not candidate.suffix:
            self.send_response(404)
            self.send_header('Content-type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write((ROOT / '404.html').read_bytes())
            return
        super().do_GET()
if __name__ == '__main__':
    print('Udayan Cinema preview: http://localhost:3000', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 3000), Handler).serve_forever()
