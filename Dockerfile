FROM docker.io/denoland/deno:alpine

WORKDIR /vorp

COPY vorp.ts vorp.ts
COPY vorp-csv.ts vorp-csv.ts
COPY vorp-data.ts vorp-data.ts
COPY vorp-cli.ts vorp-cli.ts
COPY vorp-projections.ts vorp-projections.ts
COPY vorp-projections-cli.ts vorp-projections-cli.ts
COPY vorp-trade.ts vorp-trade.ts
COPY vorp-trade-cli.ts vorp-trade-cli.ts
COPY vorp-report.ts vorp-report.ts
COPY vorp-report-cli.ts vorp-report-cli.ts
COPY vorp-draft.ts vorp-draft.ts
COPY vorp-draft-cli.ts vorp-draft-cli.ts

ENTRYPOINT ["deno", "run", "--allow-read", "--allow-write", "vorp-cli.ts"]
