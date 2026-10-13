# syntax=docker/dockerfile:1
FROM caddy:2

COPY src/ /opt/thai-flash-card

CMD ["caddy", "file-server", "--root", "/opt/thai-flash-card", "--listen", "0.0.0.0:8080"]
