# CDS NATS Messaging

> support the [nats message broker](https://nats.io/) for CAP NodeJS runtime.

## Get Started

> install dependency

```bash
npm i -S cds-nats-messaging
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

- [ ] Pub/Sub
- [x] Produce/Consume
  - [ ] basic support and test case
- [ ] Outbox enable
- [ ] Nats options
- [ ] `tenant` recover
- [ ] `user` recover
- [ ] `messaging`
  - [ ] `srv.on`
  - [ ] `srv.emit`

## [LICENSE](./LICENSE)
