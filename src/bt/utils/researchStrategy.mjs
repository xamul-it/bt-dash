const parents = {
  "overnight_ah_spy_research.OvernightAHSpyThreshold": "overnight_ah.OvernightAH",
  "overnight_ah_spy_research.MultiFactorSpyThreshold": "overnight_ah_multifactor.OvernightAHMultiFactor",
};

export function strategyForImportedProfile(selected, profileStrategy) {
  return parents[selected] === profileStrategy ? selected : profileStrategy;
}
