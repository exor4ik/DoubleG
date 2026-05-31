FROM coturn/coturn:latest
CMD ["turnserver", "-c", "turnserver.conf"]
