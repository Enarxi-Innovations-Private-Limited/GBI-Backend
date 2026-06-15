# Changelog

## [1.3.0](https://github.com/chellakumarr/GBI-Backend/compare/v1.2.1...v1.3.0) (2026-06-15)

### Features

* deactivate all non-pro plans during seed ([2ddee03](https://github.com/chellakumarr/GBI-Backend/commit/2ddee03c61cb9867b15d734cbdb7718456d80800))

## [1.2.1](https://github.com/chellakumarr/GBI-Backend/compare/v1.2.0...v1.2.1) (2026-06-15)

### Bug Fixes

* resolve prisma seed TypeScript compilation error with null features ([5ed967e](https://github.com/chellakumarr/GBI-Backend/commit/5ed967e977ddda87a4da769fd7b928b9ae2fc085))

## [1.2.0](https://github.com/chellakumarr/GBI-Backend/compare/v1.1.0...v1.2.0) (2026-06-15)

### Features

* **backend:** add check-telemetry utility script and support dynamic device IDs in simulator ([ff3daa3](https://github.com/chellakumarr/GBI-Backend/commit/ff3daa35c9cbdd0927692259a3cb3b93df9c807c))
* **devices:** update default telemetry lookback window to 12 hours ([4f67b9b](https://github.com/chellakumarr/GBI-Backend/commit/4f67b9b0f18e54cbbdd7ed6e1fa0b35345568b3e))
* migrate pricing plan catalog to a single Pro plan ([51d7803](https://github.com/chellakumarr/GBI-Backend/commit/51d7803d9ec998df34e49f4d0bf6f904ba4ca40c))

### Bug Fixes

* **auth:** rename admin cookies and clear legacy cookies to resolve session collision ([4351c07](https://github.com/chellakumarr/GBI-Backend/commit/4351c0768f2960fb550b632a27097f58f3ff8d5d))

## [1.1.0](https://github.com/chellakumarr/GBI-Backend/compare/v1.0...v1.1.0) (2026-06-12)

### Features

* **mqtt:** enforce strict MQTT_CONSUMER_GROUP env variable requirement ([146ec8b](https://github.com/chellakumarr/GBI-Backend/commit/146ec8b736f079fd953735fd2ebae37b4bf3e3ad))

### Bug Fixes

* **auth:** enable trustProxy in Fastify to support secure cookies ([11c716e](https://github.com/chellakumarr/GBI-Backend/commit/11c716e4eb6e204dd6874ab5cd55d4c260d9cb3b))
