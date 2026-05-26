import { describe, it, expect } from "vitest";
import { classifyRegion, type RegionVerdict } from "./region-filter";

function classify(location: string, region: string, remote = false): RegionVerdict {
  return classifyRegion(location, region, remote);
}

describe("classifyRegion - spec edge cases", () => {
  it('Berlin, Germany + Europe region → eu', () => {
    expect(classify("Berlin, Germany", "Europe", false)).toBe("eu");
  });

  it('Remote within Canada or United States → non_eu', () => {
    expect(classify("Remote within Canada or United States", "Remote", true)).toBe("non_eu");
  });

  it('Argentina Remote → non_eu', () => {
    expect(classify("Argentina Remote", "Remote", true)).toBe("non_eu");
  });

  it('Worldwide → unknown', () => {
    expect(classify("Worldwide", "Remote", true)).toBe("unknown");
  });

  it('Remote (EU) → eu', () => {
    expect(classify("Remote (EU)", "Remote")).toBe("eu");
  });

  it('Lithuania + Europe region → eu', () => {
    expect(classify("Lithuania", "Europe")).toBe("eu");
  });

  it('empty location + Remote region → unknown', () => {
    expect(classify("", "Remote", true)).toBe("unknown");
  });

  it('San Francisco, CA + North America region → non_eu', () => {
    expect(classify("San Francisco, CA", "North America")).toBe("non_eu");
  });
});

describe("classifyRegion - EU detection", () => {
  it('EU region field alone → eu', () => {
    expect(classify("Remote", "Europe")).toBe("eu");
  });

  it('UK region field alone → eu', () => {
    expect(classify("Remote", "UK")).toBe("eu");
  });

  it('location contains EU country name → eu', () => {
    expect(classify("Munich, Bavaria, Germany", "Remote")).toBe("eu");
  });

  it('location contains EU city → eu', () => {
    expect(classify("Dublin, Ireland", "Remote")).toBe("eu");
  });

  it('Helsinki, Finland → eu', () => {
    expect(classify("Helsinki, Uusimaa, Finland", "Remote")).toBe("eu");
  });

  it('Zurich Swiss variant Zürich → eu', () => {
    expect(classify("Zürich, CH", "Remote")).toBe("eu");
  });

  it('Spain in full city string → eu', () => {
    expect(classify("Valencia, Valencian Community, Spain", "Remote")).toBe("eu");
  });

  it('"UK" word boundary prevents matching Ukraine → Ukraine is non_eu', () => {
    expect(classify("Ukraine", "Remote")).toBe("non_eu");
  });

  it('"UK" as standalone word → eu', () => {
    expect(classify("London, UK", "Remote")).toBe("eu");
  });

  it('Slovakia → eu', () => {
    expect(classify("Slovakia", "Remote")).toBe("eu");
  });

  it('Romania → eu', () => {
    expect(classify("Romania", "Remote")).toBe("eu");
  });

  it('Norway (EEA) → eu', () => {
    expect(classify("Oslo, Norway", "Remote")).toBe("eu");
  });

  it('Switzerland (non-EU but included) → eu', () => {
    expect(classify("Zurich, Switzerland", "Remote")).toBe("eu");
  });
});

describe("classifyRegion - non-EU detection", () => {
  it('North America region field → non_eu', () => {
    expect(classify("New York", "North America")).toBe("non_eu");
  });

  it('Asia region field → non_eu', () => {
    expect(classify("Tokyo", "Asia")).toBe("non_eu");
  });

  it('India in location → non_eu', () => {
    expect(classify("Bengaluru, Karnataka, India", "Remote")).toBe("non_eu");
  });

  it('Singapore in location → non_eu', () => {
    expect(classify("Singapore", "Remote")).toBe("non_eu");
  });

  it('Canada in location → non_eu', () => {
    expect(classify("Toronto, Ontario, Canada", "Remote")).toBe("non_eu");
  });

  it('Australia in location → non_eu', () => {
    expect(classify("Sydney, New South Wales, Australia", "Remote")).toBe("non_eu");
  });

  it('Brazil in location → non_eu', () => {
    expect(classify("São Paulo, Brazil", "Remote")).toBe("non_eu");
  });

  it('US state code comma pattern → non_eu', () => {
    expect(classify("Pittsburgh, PA", "Remote")).toBe("non_eu");
  });

  it('US state code at end of string → non_eu', () => {
    expect(classify("Seattle, WA", "Remote")).toBe("non_eu");
  });

  it('US state does NOT match inside longer word (Illinois stays unknown without other tells)', () => {
    // "Chicago, Illinois" - ", IL" regex would try to match ", IL\b" inside
    // "Illinois" but word boundary fails after "Il" → no match. Chicago is
    // not in the EU city list. Falls to unknown (conservative).
    expect(classify("Chicago, Illinois", "Remote")).toBe("unknown");
  });

  it('Remote USA → non_eu', () => {
    expect(classify("Remote USA", "Remote")).toBe("non_eu");
  });

  it('Remote-USA → non_eu', () => {
    expect(classify("Remote-USA", "Remote")).toBe("non_eu");
  });

  it('USA, Remote → non_eu', () => {
    expect(classify("USA, Remote", "Remote")).toBe("non_eu");
  });

  it('US Remote phrase → non_eu', () => {
    expect(classify("US Remote", "Remote")).toBe("non_eu");
  });

  it('Remote (US/Canada) phrase → non_eu', () => {
    expect(classify("Remote (US/Canada)", "Remote")).toBe("non_eu");
  });

  it('United Arab Emirates → non_eu', () => {
    expect(classify("Abu Dhabi, United Arab Emirates", "Remote")).toBe("non_eu");
  });

  it('Saudi Arabia → non_eu', () => {
    expect(classify("Riyadh, Saudi Arabia", "Remote")).toBe("non_eu");
  });

  it('LATAM Remote phrase → non_eu', () => {
    expect(classify("LATAM Remote", "Remote")).toBe("non_eu");
  });

  it('multi-city US string → non_eu via country name', () => {
    expect(classify(
      "San Francisco, CA, New York, NY, Portland, OR, or Remote within Canada or United States",
      "Remote",
      true,
    )).toBe("non_eu");
  });
});

describe("classifyRegion - unknown (conservative fallback)", () => {
  it('Worldwide with no tells → unknown', () => {
    expect(classify("Worldwide", "Remote")).toBe("unknown");
  });

  it('bare Remote location → unknown', () => {
    expect(classify("Remote", "Remote")).toBe("unknown");
  });

  it('In-Office with no location context → unknown', () => {
    expect(classify("In-Office", "Remote")).toBe("unknown");
  });

  it('city with no country context (Wroclaw) → unknown', () => {
    expect(classify("Wroclaw Metropolitan Area", "Remote")).toBe("unknown");
  });

  it('Belgrade, Serbia (non-listed country) → unknown', () => {
    expect(classify("Belgrade, Serbia", "Remote")).toBe("unknown");
  });
});
