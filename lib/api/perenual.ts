const BASE = "https://perenual.com/api/v2";

export type PerenualPlant = {
  id: number;
  common_name: string;
  scientific_name: string[];
  other_name: string[];
  family: string | null;
  type: string | null;
  description: string | null;
  default_image: { medium_url: string | null; small_url: string | null } | null;
  cycle: string | null;
  sunlight: string[];
  watering: string | null;
  maintenance: string | null;
  care_level: string | null;
  flowers: boolean | null;
  fruiting: boolean | null;
  edible_fruit: boolean | null;
  leaf: boolean | null;
  growth_rate: string | null;
  harvest_season: string | null;
  harvest_method: string | null;
  spacing: number | null;
  depth_water_requirement: { unit: string; value: string } | null;
  volume_water_requirement: { unit: string; value: string } | null;
  watering_period: string | null;
  plant_anatomy: Array<{ part: string; color: string[] }> | null;
  seeds: number | null;
  propagation: string[];
  hardiness: { min: string; max: string } | null;
  hardiness_location: { full_url: string; full_iframe: string } | null;
  flowers_color: string | null;
  soil: string[];
  pest_susceptibility: string[];
  indoor: boolean | null;
};

export type PerenualListItem = {
  id: number;
  common_name: string;
  scientific_name: string[];
  other_name: string[];
  cycle: string | null;
  watering: string | null;
  sunlight: string[];
  default_image: { medium_url: string | null; small_url: string | null } | null;
};

export type PerenualSearchResult = {
  data: PerenualListItem[];
  to: number;
  per_page: number;
  current_page: number;
  from: number;
  last_page: number;
  total: number;
};

function apiKey() {
  const key = process.env.PERENUAL_API_KEY;
  if (!key) throw new Error("PERENUAL_API_KEY not set");
  return key;
}

export async function searchPerenual(
  query: string,
  page = 1
): Promise<PerenualSearchResult | null> {
  try {
    const params = new URLSearchParams({
      key: apiKey(),
      q: query,
      page: String(page),
    });
    const res = await fetch(`${BASE}/species-list?${params}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function getPerenualPlant(id: number): Promise<PerenualPlant | null> {
  try {
    const params = new URLSearchParams({ key: apiKey() });
    const res = await fetch(`${BASE}/species/details/${id}?${params}`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
