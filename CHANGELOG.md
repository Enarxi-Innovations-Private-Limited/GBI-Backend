# Changelog

## [1.4.2](https://github.com/chellakumarr/GBI-Backend/compare/v1.4.1...v1.4.2) (2026-07-22)

### Features

* add admin endpoints to manage Redis email suppression list ([d342f5a](https://github.com/chellakumarr/GBI-Backend/commit/d342f5abe641e72bc5ef338e3bd2c881b35dd4ca))
* add AWS SES mailbox simulator users seed script ([aa333d3](https://github.com/chellakumarr/GBI-Backend/commit/aa333d3413de4ec88670867fae8c0f83f7467b39))
* add ENABLE_PAYMENTS feature flag guard and status to plans API ([6b5ec47](https://github.com/chellakumarr/GBI-Backend/commit/6b5ec47e018330231aa6261542aa633a1f0cb9f3))
* add password Test@123 to mailbox simulator users ([e01641e](https://github.com/chellakumarr/GBI-Backend/commit/e01641ea341622bd84e817d3a7af46499521bdbf))
* **admin,auth:** enforce user deletion safeguards, exclude admin emails from user list, make organization validation optional, and apply Indian mobile format regex validators ([347ba94](https://github.com/chellakumarr/GBI-Backend/commit/347ba9464025fe803e34791565ea52f7d286664a))
* **admin:** support user id/email and custom device name in getDevices global search query ([9577a3f](https://github.com/chellakumarr/GBI-Backend/commit/9577a3fada7f874f7dad8b0687322aa7e14903c8))
* configure Razorpay credentials and webhook csrf bypass ([4755f15](https://github.com/chellakumarr/GBI-Backend/commit/4755f1595cf117a95ae3a46c1547d0ad8969a4bd))
* **database:** migrate to local Docker containers and optimize telemetry snapping ([eaf4612](https://github.com/chellakumarr/GBI-Backend/commit/eaf4612894106f364f8ce2656ffba271dde975e6))
* implement AWS SES bounce & complaint SNS webhook and mailer suppression system ([cd71729](https://github.com/chellakumarr/GBI-Backend/commit/cd71729930e3f96461f71cb06e39c2f0658dfe7f))
* implement razorpay webhook listener for secure subscription activation ([7a67052](https://github.com/chellakumarr/GBI-Backend/commit/7a67052b4340047c87c5936b7dc1aa5ad21d4f7a))
* optimize telemetry schema by dropping redundant id column ([f517d43](https://github.com/chellakumarr/GBI-Backend/commit/f517d436e0142eb4b1e57b11fe22f1291730183d))
* **telemetry:** calculate and output peakValue for telemetry data, and add dev9 seed/mock scripts ([b4f2be8](https://github.com/chellakumarr/GBI-Backend/commit/b4f2be8fb9ef06f98b6eb9b9e10f2919899c6e96))

### Bug Fixes

* **auth/admin:** throw 423 lockout on 5th OTP failure, make lockout configurable, and match admin stats total users ([8cb52bc](https://github.com/chellakumarr/GBI-Backend/commit/8cb52bcab908bbe4bcb19e4ea560cbc010d24683))
* set isRestricted to true on bounce/complaint and add test script ([73bc7a9](https://github.com/chellakumarr/GBI-Backend/commit/73bc7a9337d49c30865c9a9608b30b34a64e6ccb))
* **tsconfig:** resolve TS6059 rootDir compiler errors for test spec files in IDE ([a07ae77](https://github.com/chellakumarr/GBI-Backend/commit/a07ae777fd956c210bb2c235be66a8abce66852a))

### Performance Improvements

* cap prisma connection pool & add night gap test scripts ([fb71ee3](https://github.com/chellakumarr/GBI-Backend/commit/fb71ee3db6dcf296fd4db379966ae3814afb0417))

## [1.4.1](https://github.com/chellakumarr/GBI-Backend/compare/v1.4.0...v1.4.1) (2026-07-02)

### Bug Fixes

* include thresholds in getMyDevices and invalidate cache on threshold changes ([79b4813](https://github.com/chellakumarr/GBI-Backend/commit/79b4813c4b00f35f5b596a5b72d56bf0e99cbab6))

## [1.4.0](https://github.com/chellakumarr/GBI-Backend/compare/v1.3.1...v1.4.0) (2026-07-01)

### Features

* **prisma:** implement blocking connection retry and fix E2E test isolation data wipes and connections leak ([000c4e0](https://github.com/chellakumarr/GBI-Backend/commit/000c4e0732b827f10136b2110e736e916bd18e50))

## [1.3.1](https://github.com/chellakumarr/GBI-Backend/compare/v1.3.0...v1.3.1) (2026-06-30)

### Bug Fixes

* **alerts:** update default global thresholds, including Noise, to match frontend defaults ([341f96a](https://github.com/chellakumarr/GBI-Backend/commit/341f96ada810be9382856dbd9c8c300a811bd48f))

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
