"""Start GharSetu backend on first available local port.

Prefers port 8000 and falls back to 8001..8010 if occupied.
"""

import os
import socket
import subprocess
import sys
from typing import Iterable


def _is_port_available(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((host, port))
            return True
        except OSError:
            return False


def _candidate_ports() -> Iterable[int]:
    yield 8000
    for port in range(8001, 8011):
        yield port


def main() -> int:
    selected_port = None
    for port in _candidate_ports():
        if _is_port_available(port):
            selected_port = port
            break

    if selected_port is None:
        print("No available port found in range 8000-8010.", file=sys.stderr)
        return 1

    backend_url = f"http://127.0.0.1:{selected_port}"
    os.environ["REACT_APP_BACKEND_URL"] = backend_url
    print(f"Starting backend on {backend_url}")
    print("Tip: set frontend env REACT_APP_BACKEND_URL to the same URL if needed.")

    command = [
        sys.executable,
        "-m",
        "uvicorn",
        "server:socket_app",
        "--reload",
        "--port",
        str(selected_port),
    ]
    return subprocess.call(command)


if __name__ == "__main__":
    raise SystemExit(main())
