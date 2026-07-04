import os
import ssl
import tempfile
import subprocess
from http.server import HTTPServer, SimpleHTTPRequestHandler


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header(
            "Cache-Control",
            "no-store, no-cache, must-revalidate, max-age=0"
        )
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


with tempfile.TemporaryDirectory() as tmp:
    cert = os.path.join(tmp, "cert.pem")
    key = os.path.join(tmp, "key.pem")

    subprocess.run([
        "openssl",
        "req",
        "-x509",
        "-newkey", "rsa:2048",
        "-keyout", key,
        "-out", cert,
        "-days", "365",
        "-nodes",
        "-subj", "/CN=localhost"
    ], check=True)

    server = HTTPServer(("0.0.0.0", 8000), NoCacheHandler)

    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(cert, key)

    server.socket = ctx.wrap_socket(
        server.socket,
        server_side=True
    )

    print("https://localhost:8000")
    server.serve_forever()
