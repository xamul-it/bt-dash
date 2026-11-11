const test = require("node:test");
const assert = require("node:assert/strict");

test("profile import preserves only a matching research variant", async () => {
  const { strategyForImportedProfile } = await import("../src/bt/utils/researchStrategy.mjs");
  const ah = "overnight_ah_spy_research.OvernightAHSpyThreshold";
  const mf = "overnight_ah_spy_research.MultiFactorSpyThreshold";
  assert.equal(strategyForImportedProfile(ah, "overnight_ah.OvernightAH"), ah);
  assert.equal(strategyForImportedProfile(mf, "overnight_ah_multifactor.OvernightAHMultiFactor"), mf);
  assert.equal(strategyForImportedProfile(ah, "generic.BuyAndHold"), "generic.BuyAndHold");
  assert.equal(strategyForImportedProfile("generic.BuyAndHold", "overnight_ah.OvernightAH"), "overnight_ah.OvernightAH");
});
