import errno
import http.server
import socketserver
import sys
import webbrowser
import os
from pathlib import Path

class Handler(http.server.SimpleHTTPRequestHandler):
    root = Path(__file__).resolve().parent

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=self.root, **kwargs)

    def do_GET(self):
        from urllib.parse import urlparse

        if urlparse(self.path).path == '/':
            self.send_response(302)
            self.send_header('Location', '/Webtool.html')
            self.end_headers()
            return
        return super().do_GET()
    
    def end_headers(self):
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        super().end_headers()
    
    def translate_path(self, path):
        # Handle requests for WASM files from the local wasm-lib directory
        if path.endswith('/CavalryWasm.js'):
            return str(self.root / 'wasm-lib' / 'CavalryWasm.js')
        elif path.endswith('/CavalryWasm.wasm'):
            return str(self.root / 'wasm-lib' / 'CavalryWasm.wasm')
        elif path.endswith('/CavalryWasm.data'):
            return str(self.root / 'wasm-lib' / 'CavalryWasm.data')
        else:
            return super().translate_path(path)

def find_available_port(start_port=8000, max_attempts=10):
    """Find an available port starting from start_port."""
    for port in range(start_port, start_port + max_attempts):
        try:
            test_server = socketserver.TCPServer(("", port), Handler)
            test_server.server_close()
            return port
        except OSError as e:
            if e.errno == errno.EADDRINUSE:
                continue
            else:
                raise
    
    print(f"Could not find an available port in range {start_port}-{start_port + max_attempts - 1}")
    sys.exit(1)

port_value = os.environ.get("PORT")
if port_value:
    port = int(port_value)
else:
    port = find_available_port()
url = f"http://127.0.0.1:{port}/Webtool.html"

# Create the actual server
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.ThreadingTCPServer(("0.0.0.0", port), Handler)
print(f"Serving Motion Toolkit page at {url}")
webbrowser.open_new_tab(url)

try:
    httpd.serve_forever()
except KeyboardInterrupt:
    print("\nShutting down...")
finally:
    httpd.shutdown()
    httpd.server_close()