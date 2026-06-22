import http.server, json, os
PORT = 8080
DIR = os.path.dirname(os.path.abspath(__file__))
SYNC_FILE = os.path.join(DIR, 'sync-data.json')
if not os.path.exists(SYNC_FILE):
    with open(SYNC_FILE, 'w', encoding='utf-8') as f:
        json.dump({'user1': None, 'user2': None, 'messages': []}, f)

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=DIR, **k)
    def end_headers(self): self.send_header('Access-Control-Allow-Origin', '*'); self.send_header('Cache-Control', 'no-cache'); super().end_headers()
    def do_GET(self):
        if self.path.startswith('/api/sync'):
            self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers()
            with open(SYNC_FILE, 'r', encoding='utf-8') as f: self.wfile.write(f.read().encode())
            return
        super().do_GET()
    def do_POST(self):
        if self.path.startswith('/api/sync'):
            try:
                l = int(self.headers.get('Content-Length', 0)); body = self.rfile.read(l).decode()
                data = json.loads(body)
                with open(SYNC_FILE, 'w', encoding='utf-8') as f: json.dump(data, f, ensure_ascii=False, indent=2)
                self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(b'{"ok":true}')
            except Exception as e:
                self.send_response(400); self.end_headers(); self.wfile.write(b'{"error":"%s"}' % str(e).encode())
            return
        self.send_response(405); self.end_headers()
    def do_OPTIONS(self):
        self.send_response(204); self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); self.send_header('Access-Control-Allow-Headers', 'Content-Type'); self.end_headers()

http.server.HTTPServer(('0.0.0.0', PORT), H).serve_forever()
