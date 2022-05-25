import { setupTest } from "cds-internal-tool";

describe("Demo Test Suite", () => {

  const axios = setupTest(__dirname, "./app");

  it("should find entity metadata", async () => {
    const response = await axios.get("/people/$metadata");
    expect(response.status).toBe(200);
    expect(response.data).toMatch(/People/);
  });

});
