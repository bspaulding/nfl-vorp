FROM docker.io/denoland/deno:alpine

WORKDIR /vorp

COPY vorp.ts vorp.ts
COPY vorp-csv.ts vorp-csv.ts
COPY vorp-server.ts vorp-server.ts

ENTRYPOINT ["deno", "run", "--allow-net", "vorp-server.ts"]
