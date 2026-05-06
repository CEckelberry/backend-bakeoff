#!/usr/bin/env python3
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
import sys

class TaxHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/tax':
            content_length = int(self.headers.get('content-length', 0))
            body = self.rfile.read(content_length)
            req = json.loads(body)
            
            subtotal = req.get('subtotal_cents', 0)
            state = req.get('state', 'CA')
            
            # Simple tax calculation: 8.5% for CA, 7% elsewhere
            tax_rate = 0.085 if state == 'CA' else 0.07
            tax_cents = int(subtotal * tax_rate)
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = json.dumps({'tax_cents': tax_cents})
            self.wfile.write(response.encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def log_message(self, format, *args):
        # Suppress default logging
        pass

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8080), TaxHandler)
    print("Tax service listening on :8080")
    server.serve_forever()
