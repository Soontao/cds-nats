# CDS NATS

> support the [nats message broker](https://nats.io/) for CAP NodeJS runtime.

[![node-test](https://github.com/Soontao/cds-nats/actions/workflows/nodejs.yml/badge.svg)](https://github.com/Soontao/cds-nats/actions/workflows/nodejs.yml)
[![node-lint](https://github.com/Soontao/cds-nats/actions/workflows/nodejs-lint.yml/badge.svg)](https://github.com/Soontao/cds-nats/actions/workflows/nodejs-lint.yml)
[![codecov](https://codecov.io/gh/Soontao/cds-nats/branch/main/graph/badge.svg?token=4kxWUSx1Ox)](https://codecov.io/gh/Soontao/cds-nats)

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=Soontao_cds-nats&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=Soontao_cds-nats)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=Soontao_cds-nats&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=Soontao_cds-nats)
[![Technical Debt](https://sonarcloud.io/api/project_badges/measure?project=Soontao_cds-nats&metric=sqale_index)](https://sonarcloud.io/summary/new_code?id=Soontao_cds-nats)

## Get Started

> install dependency

```bash
npm i -S cds-nats
```

> configure `package.json`

```json
{
  "cds": {
    "requires": {
      "messaging": {
        "kind": "nats"
      },
      "nats": {
        "impl": "cds-nats"
      }
    }
  }
}
```

> and ref the [Process Environment](https://cap.cloud.sap/docs/node.js/cds-env#process-env) document to configure the [`Nats Connection-Options`](https://github.com/nats-io/nats.js#Connection-Options)

```env
CDS_REQUIRES_NATS_SERVERS=127.0.0.1:4222
```

## Features

- [x] Pub/Sub
  - [ ] complex test case
- [x] Produce/Consume
  - [x] basic support and test case
- [ ] Outbox enable
- [ ] Nats options documentation
- [x] Nats KV Store
  - [x] get
  - [x] set
  - [x] delete
  - [x] update
- [x] Nats Lock Service
- [ ] `tenant` recover
- [ ] `user` recover
- [ ] `messaging`
  - [ ] `srv.on`
  - [x] `srv.emit`

## [LICENSE](./LICENSE)
