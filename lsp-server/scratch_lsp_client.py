import os
import sys
import json
import subprocess

def read_lsp_message(proc, out_file):
    content_length = 0
    while True:
        line = proc.stdout.readline()
        if not line:
            return None
        line = line.decode('utf-8').strip()
        if line == "":
            break
        if line.lower().startswith("content-length:"):
            content_length = int(line.split(":")[1].strip())
            
    if content_length > 0:
        content = proc.stdout.read(content_length)
        parsed = json.loads(content.decode('utf-8'))
        out_file.write(f"RECV: {json.dumps(parsed, indent=2)}\n\n")
        return parsed
    return None

def write_lsp_message(proc, out_file, msg):
    content = json.dumps(msg)
    header = f"Content-Length: {len(content)}\r\n\r\n"
    proc.stdin.write(header.encode('utf-8'))
    proc.stdin.write(content.encode('utf-8'))
    proc.stdin.flush()
    out_file.write(f"SENT: {json.dumps(msg, indent=2)}\n\n")

def main():
    with open('lsp_debug.txt', 'w', encoding='utf-8') as f:
        f.write("Starting test...\n")
        
        server_cmd = [sys.executable, "server.py"]
        proc = subprocess.Popen(
            server_cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL
        )
        
        # 1. Initialize
        init_msg = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "processId": os.getpid(),
                "rootUri": f"file:///{os.getcwd()}",
                "capabilities": {}
            }
        }
        write_lsp_message(proc, f, init_msg)
        read_lsp_message(proc, f)
        
        # 2. Get Health Smells
        smells_msg = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "workspace/executeCommand",
            "params": {
                "command": "nexusSentinel/getHealthSmells",
                "arguments": []
            }
        }
        write_lsp_message(proc, f, smells_msg)
        read_lsp_message(proc, f)
        
        proc.terminate()

if __name__ == "__main__":
    main()
