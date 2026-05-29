FROM peerjs/peerjs-server:latest
EXPOSE 80
CMD ["node", "bin/peerjs", "--port", "80", "--path", "/"]
