/* eslint-disable @typescript-eslint/no-var-requires */
import { cwdRequireCDS, setupTest } from "cds-internal-tool";
import type NatsRFCService from "../src/NatsRFCService";
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
    const messaging = await cds.connect.to("rfc") as any as NatsRFCService
    expect(messaging).toBeInstanceOf(require("../src/NatsRFCService"))
    expect(messaging['appName']).toBe("demo-app-micro-service")
  });


  it('should support call remote msg with information', async () => {
    const cds = cwdRequireCDS()
    const { SELECT } = cds.ql
    const messaging = await cds.connect.to("rfc") as any as NatsRFCService
    const result = await messaging.execute(
      "demo-app-micro-service",
      {
        serviceName: "test.app.srv.theosun.PeopleService",
        methodName: "send",
        args: [{ query: SELECT.one.from("People").where({ Name: "Theo" }) }]
      }
    )
    expect(result).toBeNull()
  });


  it('should support trigger native errors', async () => {
    const cds = cwdRequireCDS()
    const messaging = await cds.connect.to("rfc") as any as NatsRFCService
    const remoteApp = messaging.app("demo-app-micro-service");
    const rfcService = remoteApp.service("test.app.srv.theosun.PeopleService")
    await expect(() => rfcService.send({ event: "multiErrors", data: { ID: cds.utils.uuid() } }))
      .rejects
      .toMatchObject({
        details: [
          {
            "message": "400",
            "numericSeverity": 4,
            "target": "ERROR_1",
          },
          {
            "message": "FATAL: error",
            "numericSeverity": 4,
          },
        ],
        message: "MULTIPLE_ERRORS"
      })
  });

  it('should support shortcut of execute', async () => {
    const cds = cwdRequireCDS()
    const { SELECT, INSERT } = cds.ql
    const messaging = await cds.connect.to("rfc") as any as NatsRFCService
    const remoteApp = messaging.app("demo-app-micro-service");
    const rfcService = remoteApp.service("test.app.srv.theosun.PeopleService")
    const result = await rfcService.run(SELECT.one.from("People").where({ Name: "Theo" }))
    expect(result).toBeNull()
    const newName = cds.utils.uuid();
    const newPeople = await rfcService.run(INSERT.into("People").entries({ Name: newName }))
    expect(newPeople.Name).toBe(newName)
  });

  it('should support throw remote service reported error', async () => {
    const cds = cwdRequireCDS()
    const { SELECT } = cds.ql
    const messaging = await cds.connect.to("rfc") as any as NatsRFCService
    await expect(
      () => messaging.execute(
        "demo-app-micro-service",
        {
          serviceName: "test.app.srv.theosun.PeopleService",
          methodName: "send",
          args: [
            { query: SELECT.one.from("NotExistedEntity").where({ Name: "Theo" }) }
          ]
        },

      )
    ).rejects.toMatchSnapshot()
  });

  it('should support update weight by rest api & rfc', async () => {
    let response = await axios.post("/people/People", { Name: cds.utils.uuid() })
    expect(response.status).toBe(201)
    const newPeopleId = response.data.ID
    const newPeopleName = response.data.Name
    response = await axios.post("/people/updateWeight", { ID: newPeopleId, Weight: 99.9 })
    expect(response.status).toBe(200)
    expect(response.data.Name).toBe(newPeopleName)
    const messaging = await cds.connect.to("rfc") as any as NatsRFCService
    const updatedData = await messaging.execute(
      "demo-app-micro-service",
      {
        serviceName: "test.app.srv.theosun.PeopleService",
        methodName: "send",
        args: [{ event: "updateWeight", data: { ID: newPeopleId, Weight: 130.2 } }]
      }
    )
    expect(updatedData).toMatchObject({ ID: newPeopleId, Name: newPeopleName, Weight: 130.2 })
  });

  it('should support invoke custom handler by RFCService proxy', async () => {
    const cds = cwdRequireCDS()
    const { INSERT } = cds.ql
    const messaging = await cds.connect.to("rfc") as any as NatsRFCService
    const remoteApp = messaging.app("demo-app-micro-service");
    const remotePeopleService = remoteApp.service("test.app.srv.theosun.PeopleService")
    const newPeople = await remotePeopleService.run(
      INSERT.into("People").entries({ Name: cds.utils.uuid() })
    )
    expect(newPeople).not.toBeNull()
    expect(newPeople.Name).not.toBeUndefined()
    const updatedPeople = await remotePeopleService.updateWeight(newPeople.ID, 12.3)
    expect(updatedPeople.Name).toBe(newPeople.Name)
    expect(updatedPeople.Weight).toBe(12.3)

    await expect(() => remotePeopleService.notExistFunction()).
      rejects.
      toMatchSnapshot()

  });


});
