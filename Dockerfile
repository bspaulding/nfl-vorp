FROM docker.io/denoland/deno:alpine

WORKDIR /vorp

COPY vorp.ts vorp.ts
COPY vorp-csv.ts vorp-csv.ts
COPY vorp-cli.ts vorp-cli.ts

ENTRYPOINT ["deno", "run", "--allow-read", "--allow-write", "vorp-cli.ts"]
