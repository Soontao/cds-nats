/* eslint-disable @typescript-eslint/no-var-requires */
import { cwdRequireCDS, setupTest } from "cds-internal-tool";
import type { NatsRFCService } from "../src/NatsRFCService";
import { afterAllThings, beforeAllSetup } from "./utils";

describe("RFC Test Suite", () => {

  const cds = cwdRequireCDS();
  const axios = setupTest(__dirname, "./app");

  beforeAll(beforeAllSetup);
  afterAll(afterAllThings);


  it("should find entity metadata", async () => {
    const response = await axios.get("/people/$metadata");
    expect(response.status).toBe(200);
    expect(response.data).toMatch(/People/);
  });

  it('should support connect to RFC Service', async () => {
    const cds = cwdRequireCDS()
    const messaging = await cds.connect.to("messaging") as NatsRFCService
    expect(messaging).toBeInstanceOf(require("../src/NatsRFCService").NatsRFCService)
    expect(messaging['appName']).toBe("demo-app-micro-service")
  });


  it('should support call remote msg with information', async () => {
    const cds = cwdRequireCDS()
    const { SELECT } = cds.ql
    const messaging = await cds.connect.to("messaging") as NatsRFCService
    const result = await messaging.execute(
      "demo-app-micro-service",
      "test.app.srv.theosun.PeopleService",
      SELECT.one.from("People").where({ Name: "Theo" })
    )
    expect(result).toBeNull()
  });


});
