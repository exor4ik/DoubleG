FROM peerjs/peerjs-server:latest
CMD ["sh", "-c", "node bin/peerjs --port ${PORT:-9000} --path / --proxied true"]
