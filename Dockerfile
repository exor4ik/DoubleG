FROM coturn/coturn:latest
COPY turnserver.conf /etc/coturn/turnserver.conf
CMD ["turnserver", "-c", "/etc/coturn/turnserver.conf"]
