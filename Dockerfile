FROM peerjs/peerjs-server:latest
EXPOSE 80
CMD ["sh", "-c", "node bin/peerjs --port 80 --path /"]
