# CDS NATS

> support the [nats message broker](https://nats.io/) for CAP NodeJS runtime.

[![node-test](https://github.com/Soontao/cds-nats/actions/workflows/nodejs.yml/badge.svg)](https://github.com/Soontao/cds-nats/actions/workflows/nodejs.yml)
[![node-lint](https://github.com/Soontao/cds-nats/actions/workflows/nodejs-lint.yml/badge.svg)](https://github.com/Soontao/cds-nats/actions/workflows/nodejs-lint.yml)

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
        "impl": "cds-nats-messaging"
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
  - [ ] basic support and test case
- [ ] Outbox enable
- [ ] Nats options documentation
- [ ] Nats KV Store
- [ ] `tenant` recover
- [ ] `user` recover
- [ ] `messaging`
  - [ ] `srv.on`
  - [ ] `srv.emit`

## [LICENSE](./LICENSE)
