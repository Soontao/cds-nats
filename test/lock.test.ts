import { cwdRequireCDS, setupTest } from "cds-internal-tool";
import { LockTimeoutError } from "../src/errors";
import type NatsLockService from "../src/NatsLockService";
import { afterAllThings, beforeAllSetup, sleep } from "./utils";


describe('Lock Service Test Suite', () => {

  const axios = setupTest(__dirname, "./app");

  beforeAll(beforeAllSetup);
  afterAll(afterAllThings);

  it("should find entity metadata", async () => {
    const response = await axios.get("/people/$metadata");
    expect(response.status).toBe(200);
    expect(response.data).toMatch(/People/);
  });

  it('should support connect lock service', async () => {
    const NatsKVService = require("../src/NatsKVService");
    const NatsLockService = require("../src/NatsLockService");
    const cds = cwdRequireCDS();
    const lock = await cds.connect.to("lock") as any as NatsLockService;
    expect(lock).toBeInstanceOf(NatsKVService)
    expect(lock).toBeInstanceOf(NatsLockService)
    expect(lock['lockDefaultAcquireTimeout']).toBe(10000)
    expect(lock['lockCheckInterval']).toBe(10)
    expect(lock['ttl']).toBe(60 * 60 * 1000)
  });

  it('should support lock/unlock the resource', async () => {

    const cds = cwdRequireCDS();
    const lock = await cds.connect.to("lock") as any as NatsLockService;
    const k = cds.utils.uuid()
    let unlock = await lock.lock(k)
    await unlock()
    unlock = await lock.lock(k)
    await unlock()

  });

  it('should support throw error when acquire timeout', async () => {
    const cds = cwdRequireCDS();
    const lock = await cds.connect.to("lock") as any as NatsLockService;
    const k = cds.utils.uuid()
    await lock.lock(k)
    await expect(() => lock.lock(k, 500)).rejects.toThrow(LockTimeoutError)
  });

  it('should support determine remote lock timeout', async () => {
    const cds = cwdRequireCDS();
    // the remote lock will be forced unlocked after 1 seconds
    const lock = await cds.connect.to("lock1000") as any as NatsLockService;
    const k = cds.utils.uuid()
    await lock.lock(k)
    const unlock = await lock.lock(k)
    await unlock()
  });

  it('should support concurrency check test 100', async () => {
    const cds = cwdRequireCDS();
    const lock = await cds.connect.to("lock") as any as NatsLockService;
    let value = 0

    const asyncOp = async () => {
      const unlock = await lock.lock("asyncOp")
      const localValue = value
      await sleep(Math.round(Math.random() * 50))
      value = localValue + 1
      return unlock()
    }

    await Promise.all(Array(50).fill(0).map(() => asyncOp()))

    expect(value).toBe(50)

  });

  it('should support synchronized method', async () => {
    const cds = cwdRequireCDS();
    const lock = await cds.connect.to("lock") as any as NatsLockService;
    let value = 0

    await Promise.all(Array(50).fill(0).map(() => lock.synchronized("asyncOp2", async () => {
      const localValue = value
      await sleep(Math.round(Math.random() * 50))
      value = localValue + 1
    })))

    expect(value).toBe(50)

  });


});
