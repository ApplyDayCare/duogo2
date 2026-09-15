/**
 * Canadian Postal Code & City Detection Utilities
 * Optimized for Ontario forward sortation areas (FSAs)
 */

export interface DetectedLocation {
  postalCode: string;
  fsa: string;
  city: string;
  neighborhood?: string;
  province: string;
  source: "fsa_table" | "api" | "geolocation";
  lat?: number;
  lon?: number;
}

// Normalized supported city options in duogo
export const ONTARIO_CITIES = [
  "Toronto",
  "Mississauga",
  "Brampton",
  "Markham",
  "Vaughan",
  "Richmond Hill",
  "Ottawa",
  "Hamilton",
  "Kitchener-Waterloo",
  "London",
  "Oakville",
  "Burlington",
  "Guelph",
  "Barrie",
  "Oshawa",
  "Other",
] as const;

export type OntarioCity = typeof ONTARIO_CITIES[number];

// FSA mapping table for Ontario (instant, offline, zero-latency)
const ONTARIO_FSA_MAP: Record<string, { city: string; neighborhood?: string }> = {
  // Toronto - Old Toronto / Downtown / Waterfront
  M5A: { city: "Toronto", neighborhood: "Downtown / Regent Park / Corktown" },
  M5B: { city: "Toronto", neighborhood: "Garden District / Ryerson" },
  M5C: { city: "Toronto", neighborhood: "St. James Town / Financial District" },
  M5E: { city: "Toronto", neighborhood: "Berczy Park / St. Lawrence" },
  M5G: { city: "Toronto", neighborhood: "Bay Street Corridor / Discovery District" },
  M5H: { city: "Toronto", neighborhood: "Financial District / Adelaide" },
  M5J: { city: "Toronto", neighborhood: "Harbourfront / Union Station" },
  M5K: { city: "Toronto", neighborhood: "Toronto Dominion Centre" },
  M5L: { city: "Toronto", neighborhood: "Commerce Court" },
  M5R: { city: "Toronto", neighborhood: "The Annex / Yorkville" },
  M5S: { city: "Toronto", neighborhood: "University of Toronto / Harbord" },
  M5T: { city: "Toronto", neighborhood: "Kensington Market / Chinatown" },
  M5V: { city: "Toronto", neighborhood: "Fashion District / Entertainment / King West" },
  M5W: { city: "Toronto", neighborhood: "Downtown Waterfront" },
  M5X: { city: "Toronto", neighborhood: "First Canadian Place" },

  // Toronto - West End / Midtown
  M6A: { city: "Toronto", neighborhood: "Lawrence Heights / Yorkdale" },
  M6B: { city: "Toronto", neighborhood: "Glencairn" },
  M6C: { city: "Toronto", neighborhood: "Humewood-Cedarvale" },
  M6E: { city: "Toronto", neighborhood: "Caledonia-Fairbanks" },
  M6G: { city: "Toronto", neighborhood: "Christie / Koreatown" },
  M6H: { city: "Toronto", neighborhood: "Dufferin / Dovercourt Village" },
  M6J: { city: "Toronto", neighborhood: "Little Portugal / Trinity Bellwoods" },
  M6K: { city: "Toronto", neighborhood: "Liberty Village / Parkdale" },
  M6L: { city: "Toronto", neighborhood: "North Park / Maple Leaf" },
  M6M: { city: "Toronto", neighborhood: "Mount Dennis / Keelesdale" },
  M6N: { city: "Toronto", neighborhood: "The Junction / Runnymede" },
  M6P: { city: "Toronto", neighborhood: "High Park / The Junction" },
  M6R: { city: "Toronto", neighborhood: "Parkdale / Roncesvalles" },
  M6S: { city: "Toronto", neighborhood: "Bloor West Village / Swansea" },

  // Toronto - East End / Midtown
  M4A: { city: "Toronto", neighborhood: "Victoria Village" },
  M4B: { city: "Toronto", neighborhood: "Parkview Hill / Woodbine Gardens" },
  M4C: { city: "Toronto", neighborhood: "Woodbine Heights" },
  M4E: { city: "Toronto", neighborhood: "The Beaches" },
  M4G: { city: "Toronto", neighborhood: "Leaside" },
  M4H: { city: "Toronto", neighborhood: "Thorncliffe Park" },
  M4J: { city: "Toronto", neighborhood: "The Danforth East" },
  M4K: { city: "Toronto", neighborhood: "Greektown / Riverdale" },
  M4L: { city: "Toronto", neighborhood: "India Bazaar / Leslieville" },
  M4M: { city: "Toronto", neighborhood: "Studio District / South Riverdale" },
  M4N: { city: "Toronto", neighborhood: "Lawrence Park" },
  M4P: { city: "Toronto", neighborhood: "Davisville North" },
  M4R: { city: "Toronto", neighborhood: "North Toronto" },
  M4S: { city: "Toronto", neighborhood: "Davisville" },
  M4T: { city: "Toronto", neighborhood: "Moore Park / Summerhill" },
  M4V: { city: "Toronto", neighborhood: "Deer Park / Forest Hill" },
  M4W: { city: "Toronto", neighborhood: "Rosedale" },
  M4X: { city: "Toronto", neighborhood: "St. James Town / Cabbagetown" },
  M4Y: { city: "Toronto", neighborhood: "Church and Wellesley / Village" },

  // Toronto - North York
  M2H: { city: "Toronto", neighborhood: "Hillcrest Village" },
  M2J: { city: "Toronto", neighborhood: "Fairview / Henry Farm" },
  M2K: { city: "Toronto", neighborhood: "Bayview Village" },
  M2L: { city: "Toronto", neighborhood: "Silver Hills / York Mills" },
  M2M: { city: "Toronto", neighborhood: "Newtonbrook" },
  M2N: { city: "Toronto", neighborhood: "Willowdale East" },
  M2P: { city: "Toronto", neighborhood: "York Mills West" },
  M2R: { city: "Toronto", neighborhood: "Willowdale West" },
  M3A: { city: "Toronto", neighborhood: "Parkwoods" },
  M3B: { city: "Toronto", neighborhood: "Don Mills North" },
  M3C: { city: "Toronto", neighborhood: "Don Mills South / Flemingdon" },
  M3H: { city: "Toronto", neighborhood: "Bathurst Manor / Wilson Heights" },
  M3J: { city: "Toronto", neighborhood: "York University / Northwood" },
  M3K: { city: "Toronto", neighborhood: "Downsview East" },
  M3L: { city: "Toronto", neighborhood: "Downsview West" },
  M3M: { city: "Toronto", neighborhood: "Downsview Central" },
  M3N: { city: "Toronto", neighborhood: "Jane and Finch" },

  // Toronto - Etobicoke
  M8V: { city: "Toronto", neighborhood: "New Toronto / Mimico" },
  M8W: { city: "Toronto", neighborhood: "Alderwood / Long Branch" },
  M8X: { city: "Toronto", neighborhood: "The Kingsway / Old Mill" },
  M8Y: { city: "Toronto", neighborhood: "Humber Bay / Sunnylea" },
  M8Z: { city: "Toronto", neighborhood: "Mimico NW / Queensway" },
  M9A: { city: "Toronto", neighborhood: "Islington Avenue" },
  M9B: { city: "Toronto", neighborhood: "West Deane Park / Princess Gardens" },
  M9C: { city: "Toronto", neighborhood: "Markland Wood / Eringate" },
  M9L: { city: "Toronto", neighborhood: "Humber Summit" },
  M9M: { city: "Toronto", neighborhood: "Humberlea / Emery" },
  M9N: { city: "Toronto", neighborhood: "Weston" },
  M9P: { city: "Toronto", neighborhood: "Westmount" },
  M9R: { city: "Toronto", neighborhood: "Kingsview Village / Martin Grove" },
  M9V: { city: "Toronto", neighborhood: "Albion / Mount Olive / South Steeles" },
  M9W: { city: "Toronto", neighborhood: "Clairville / Rexdale" },

  // Toronto - Scarborough
  M1B: { city: "Toronto", neighborhood: "Malvern / Rouge" },
  M1C: { city: "Toronto", neighborhood: "Highland Creek / Port Union" },
  M1E: { city: "Toronto", neighborhood: "Guildwood / Morningside" },
  M1G: { city: "Toronto", neighborhood: "Woburn" },
  M1H: { city: "Toronto", neighborhood: "Cedarbrae" },
  M1J: { city: "Toronto", neighborhood: "Scarborough Village" },
  M1K: { city: "Toronto", neighborhood: "Kennedy Park / Ionview" },
  M1L: { city: "Toronto", neighborhood: "Golden Mile / Clairlea" },
  M1M: { city: "Toronto", neighborhood: "Cliffside / Cliffcrest" },
  M1N: { city: "Toronto", neighborhood: "Birch Cliff" },
  M1P: { city: "Toronto", neighborhood: "Dorset Park / Wexford" },
  M1R: { city: "Toronto", neighborhood: "Maryvale / Wexford" },
  M1S: { city: "Toronto", neighborhood: "Agincourt" },
  M1T: { city: "Toronto", neighborhood: "Clarks Corners / Tam O'Shanter" },
  M1V: { city: "Toronto", neighborhood: "Milliken / Agincourt North" },
  M1W: { city: "Toronto", neighborhood: "Steeles West / L'Amoreaux" },
  M1X: { city: "Toronto", neighborhood: "Upper Rouge" },

  // Mississauga
  L4T: { city: "Mississauga", neighborhood: "Malton" },
  L4V: { city: "Mississauga", neighborhood: "Pearson Hub / Northeast" },
  L4W: { city: "Mississauga", neighborhood: "Matheson / Dixie" },
  L4X: { city: "Mississauga", neighborhood: "Applewood" },
  L4Y: { city: "Mississauga", neighborhood: "Dixie / Applewood East" },
  L4Z: { city: "Mississauga", neighborhood: "Hurontario North / Rathwood" },
  L5A: { city: "Mississauga", neighborhood: "Cooksville East" },
  L5B: { city: "Mississauga", neighborhood: "City Centre / Square One / Cooksville" },
  L5C: { city: "Mississauga", neighborhood: "Erindale / Credit Valley" },
  L5E: { city: "Mississauga", neighborhood: "Lakeview" },
  L5G: { city: "Mississauga", neighborhood: "Port Credit" },
  L5H: { city: "Mississauga", neighborhood: "Lorne Park / Clarkson North" },
  L5J: { city: "Mississauga", neighborhood: "Clarkson / Park Royal" },
  L5K: { city: "Mississauga", neighborhood: "Sheridan / Erin Mills South" },
  L5L: { city: "Mississauga", neighborhood: "Erin Mills / UTM" },
  L5M: { city: "Mississauga", neighborhood: "Streetsville / Central Erin Mills" },
  L5N: { city: "Mississauga", neighborhood: "Meadowvale / Lisgar" },
  L5R: { city: "Mississauga", neighborhood: "Creditview / East Credit" },
  L5V: { city: "Mississauga", neighborhood: "East Credit / Meadowvale Village" },
  L5W: { city: "Mississauga", neighborhood: "Meadowvale Village South" },

  // Brampton
  L6P: { city: "Brampton", neighborhood: "Bramalea North / Castlemore" },
  L6R: { city: "Brampton", neighborhood: "Sandringham / Springdale" },
  L6S: { city: "Brampton", neighborhood: "Central Park / Bramalea" },
  L6T: { city: "Brampton", neighborhood: "Southgate / Bramalea South" },
  L6V: { city: "Brampton", neighborhood: "Downtown Brampton / Heart Lake East" },
  L6W: { city: "Brampton", neighborhood: "Steeles / Brampton South" },
  L6X: { city: "Brampton", neighborhood: "Fletcher's Meadow / Queen St West" },
  L6Y: { city: "Brampton", neighborhood: "Fletcher's Creek / Credit Valley" },
  L6Z: { city: "Brampton", neighborhood: "Heart Lake" },
  L7A: { city: "Brampton", neighborhood: "Mount Pleasant / Northwest" },

  // Markham
  L3P: { city: "Markham", neighborhood: "Old Markham / Village" },
  L3R: { city: "Markham", neighborhood: "Unionville / Downtown Markham" },
  L3S: { city: "Markham", neighborhood: "Milliken Mills" },
  L6B: { city: "Markham", neighborhood: "Cornell / Box Grove" },
  L6C: { city: "Markham", neighborhood: "Cachet / Angus Glen" },
  L6E: { city: "Markham", neighborhood: "Wismer / Greensborough" },

  // Vaughan
  L4H: { city: "Vaughan", neighborhood: "Woodbridge North / Pine Valley" },
  L4J: { city: "Vaughan", neighborhood: "Thornhill Woods / Clark" },
  L4K: { city: "Vaughan", neighborhood: "Vaughan Metropolitan Centre / Concord" },
  L4L: { city: "Vaughan", neighborhood: "Woodbridge West / Highway 7" },
  L6A: { city: "Vaughan", neighborhood: "Maple / Patterson" },

  // Richmond Hill
  L4B: { city: "Richmond Hill", neighborhood: "Beaver Creek / Doncrest" },
  L4C: { city: "Richmond Hill", neighborhood: "South Richmond Hill / Mill Pond" },
  L4E: { city: "Richmond Hill", neighborhood: "Oak Ridges / Lake Wilcox" },
  L4S: { city: "Richmond Hill", neighborhood: "Rough River / Bayview Hill" },

  // Ottawa
  K1A: { city: "Ottawa", neighborhood: "Parliament Hill / Government Hub" },
  K1B: { city: "Ottawa", neighborhood: "Blackburn Hamlet / Gloucester" },
  K1C: { city: "Ottawa", neighborhood: "Orléans West" },
  K1E: { city: "Ottawa", neighborhood: "Orléans East" },
  K1G: { city: "Ottawa", neighborhood: "Riverview / Elmvale" },
  K1H: { city: "Ottawa", neighborhood: "Alta Vista" },
  K1J: { city: "Ottawa", neighborhood: "Beacon Hill / Cyrville" },
  K1K: { city: "Ottawa", neighborhood: "Rockcliffe Park / Vanier" },
  K1L: { city: "Ottawa", neighborhood: "Vanier North" },
  K1M: { city: "Ottawa", neighborhood: "Rockcliffe / Manor Park" },
  K1N: { city: "Ottawa", neighborhood: "ByWard Market / Sandy Hill" },
  K1P: { city: "Ottawa", neighborhood: "Centretown / Downtown" },
  K1R: { city: "Ottawa", neighborhood: "LeBreton Flats / Chinatown" },
  K1S: { city: "Ottawa", neighborhood: "The Glebe / Old Ottawa South" },
  K1T: { city: "Ottawa", neighborhood: "Greenboro / South Keys" },
  K1V: { city: "Ottawa", neighborhood: "Hunt Club / Airport" },
  K1W: { city: "Ottawa", neighborhood: "Notre-Dame-des-Champs" },
  K1X: { city: "Ottawa", neighborhood: "Leitrim / Carlsbad" },
  K1Y: { city: "Ottawa", neighborhood: "Hintonburg / Wellington West" },
  K1Z: { city: "Ottawa", neighborhood: "Westboro / Carlington" },
  K2A: { city: "Ottawa", neighborhood: "McKellar Park / Highland Park" },
  K2B: { city: "Ottawa", neighborhood: "Britannia / Lincoln Fields" },
  K2C: { city: "Ottawa", neighborhood: "Bells Corners East / Meadowlands" },
  K2E: { city: "Ottawa", neighborhood: "Rideau Heights / Merivale" },
  K2G: { city: "Ottawa", neighborhood: "Nepean / Barrhaven East" },
  K2H: { city: "Ottawa", neighborhood: "Bells Corners / Bayshore" },
  K2J: { city: "Ottawa", neighborhood: "Barrhaven Central" },
  K2K: { city: "Ottawa", neighborhood: "Kanata North / Tech Park" },
  K2L: { city: "Ottawa", neighborhood: "Kanata Central / Katimavik" },
  K2M: { city: "Ottawa", neighborhood: "Kanata South / Bridlewood" },
  K2P: { city: "Ottawa", neighborhood: "Centretown South" },
  K2R: { city: "Ottawa", neighborhood: "Cedarhill / Orchard" },
  K2S: { city: "Ottawa", neighborhood: "Stittsville" },
  K2T: { city: "Ottawa", neighborhood: "Kanata Lakes / March" },
  K2V: { city: "Ottawa", neighborhood: "Kanata Southwest" },
  K2W: { city: "Ottawa", neighborhood: "Dunrobin / Constance Bay" },
  K4A: { city: "Ottawa", neighborhood: "Orléans South / Avalon" },

  // Hamilton
  L8E: { city: "Hamilton", neighborhood: "Stoney Creek East" },
  L8G: { city: "Hamilton", neighborhood: "Stoney Creek Central" },
  L8H: { city: "Hamilton", neighborhood: "Hamilton East / Crown Point" },
  L8J: { city: "Hamilton", neighborhood: "Valley Park / Stoney Creek Mountain" },
  L8K: { city: "Hamilton", neighborhood: "Rosedale / Red Hill" },
  L8L: { city: "Hamilton", neighborhood: "Hamilton North / Bayfront" },
  L8M: { city: "Hamilton", neighborhood: "Gage Park / St. Clair" },
  L8N: { city: "Hamilton", neighborhood: "Downtown Hamilton / Corktown" },
  L8P: { city: "Hamilton", neighborhood: "Durand / Kirkendall / Locke St" },
  L8R: { city: "Hamilton", neighborhood: "Central Hamilton / James North" },
  L8S: { city: "Hamilton", neighborhood: "Westdale / McMaster University" },
  L8T: { city: "Hamilton", neighborhood: "Berrisfield / Mountview" },
  L8V: { city: "Hamilton", neighborhood: "Henderson / Centremount" },
  L8W: { city: "Hamilton", neighborhood: "Barnstown / Allison" },
  L9A: { city: "Hamilton", neighborhood: "Buchanan / Mohawk" },
  L9B: { city: "Hamilton", neighborhood: "Rymal / Carpenter" },
  L9C: { city: "Hamilton", neighborhood: "Gourley / Falkirk" },
  L9G: { city: "Hamilton", neighborhood: "Ancaster" },
  L9H: { city: "Hamilton", neighborhood: "Dundas" },
  L9K: { city: "Hamilton", neighborhood: "Ancaster East" },

  // Kitchener-Waterloo
  N2A: { city: "Kitchener-Waterloo", neighborhood: "Kitchener East / Chicopee" },
  N2B: { city: "Kitchener-Waterloo", neighborhood: "Kitchener Northeast / Heritage Park" },
  N2C: { city: "Kitchener-Waterloo", neighborhood: "Kitchener Central / Vanier" },
  N2E: { city: "Kitchener-Waterloo", neighborhood: "Kitchener South / Forest Heights" },
  N2G: { city: "Kitchener-Waterloo", neighborhood: "Downtown Kitchener" },
  N2H: { city: "Kitchener-Waterloo", neighborhood: "Kitchener Westmount / East Ward" },
  N2M: { city: "Kitchener-Waterloo", neighborhood: "Victoria Park / Highland West" },
  N2N: { city: "Kitchener-Waterloo", neighborhood: "Highland West / Boardwalk" },
  N2P: { city: "Kitchener-Waterloo", neighborhood: "Doon / Pioneer Park" },
  N2R: { city: "Kitchener-Waterloo", neighborhood: "Huron Park / Trussler" },
  N2K: { city: "Kitchener-Waterloo", neighborhood: "Waterloo Northeast / Lexington" },
  N2L: { city: "Kitchener-Waterloo", neighborhood: "University of Waterloo / Laurier" },
  N2T: { city: "Kitchener-Waterloo", neighborhood: "Waterloo West / Laurelwood" },
  N2V: { city: "Kitchener-Waterloo", neighborhood: "Waterloo Northwest" },

  // London
  N5V: { city: "London", neighborhood: "London Airport / Argyle" },
  N5W: { city: "London", neighborhood: "Hamilton Road / East London" },
  N5X: { city: "London", neighborhood: "Masonville / Stoney Creek" },
  N5Y: { city: "London", neighborhood: "Carling / North London" },
  N5Z: { city: "London", neighborhood: "Westminster / Pond Mills" },
  N6A: { city: "London", neighborhood: "Downtown London / Richmond Row" },
  N6B: { city: "London", neighborhood: "Woodfield / Old East Village" },
  N6C: { city: "London", neighborhood: "Old South / Wortley Village" },
  N6E: { city: "London", neighborhood: "White Oaks / South London" },
  N6G: { city: "London", neighborhood: "Western University / Orchard Park" },
  N6H: { city: "London", neighborhood: "Oakridge / Hyde Park South" },
  N6J: { city: "London", neighborhood: "Westmount / Berkshire" },
  N6K: { city: "London", neighborhood: "Byron / Riverbend" },
  N6L: { city: "London", neighborhood: "Lambeth" },
  N6M: { city: "London", neighborhood: "Summerside / Southeast" },
  N6P: { city: "London", neighborhood: "Hyde Park North" },

  // Oakville & Burlington
  L6H: { city: "Oakville", neighborhood: "College Park / Iroquois Ridge" },
  L6J: { city: "Oakville", neighborhood: "Old Oakville / Downtown Waterfront" },
  L6K: { city: "Oakville", neighborhood: "Kerr Village / West Harbour" },
  L6L: { city: "Oakville", neighborhood: "Bronte / West Oakville" },
  L6M: { city: "Oakville", neighborhood: "West Oak Trails / Glen Abbey" },
  L7L: { city: "Burlington", neighborhood: "Shoreacres / Appleby" },
  L7M: { city: "Burlington", neighborhood: "Tansley / Millcroft" },
  L7N: { city: "Burlington", neighborhood: "Roseland / Central" },
  L7P: { city: "Burlington", neighborhood: "Tyandaga / Brant Hills" },
  L7R: { city: "Burlington", neighborhood: "Downtown Burlington / Waterfront" },
  L7S: { city: "Burlington", neighborhood: "Maple / Aldershot East" },
  L7T: { city: "Burlington", neighborhood: "Aldershot / Plains Road" },

  // Guelph
  N1C: { city: "Guelph", neighborhood: "Guelph East" },
  N1E: { city: "Guelph", neighborhood: "Guelph North / St. George's" },
  N1G: { city: "Guelph", neighborhood: "University of Guelph / South" },
  N1H: { city: "Guelph", neighborhood: "Downtown Guelph / Exhibition Park" },
  N1K: { city: "Guelph", neighborhood: "Guelph West / Hanlon" },
  N1L: { city: "Guelph", neighborhood: "Clairfields / Kortright" },

  // Barrie
  L4M: { city: "Barrie", neighborhood: "East Barrie / Lake Simcoe" },
  L4N: { city: "Barrie", neighborhood: "West Barrie / Allandale" },

  // Oshawa & Durham
  L1H: { city: "Oshawa", neighborhood: "Downtown Oshawa / Lakeview" },
  L1J: { city: "Oshawa", neighborhood: "Vanier / Central Oshawa" },
  L1K: { city: "Oshawa", neighborhood: "Eastdale / Pinecrest" },
  L1L: { city: "Oshawa", neighborhood: "Taunton / Windfields" },
  L1N: { city: "Oshawa", neighborhood: "Whitby Downtown / Port Whitby" },
  L1P: { city: "Oshawa", neighborhood: "Whitby West" },
  L1R: { city: "Oshawa", neighborhood: "Brooklin / North Whitby" },
  L1V: { city: "Toronto", neighborhood: "Pickering South" },
  L1W: { city: "Toronto", neighborhood: "Pickering Waterfront" },
  L1X: { city: "Toronto", neighborhood: "Pickering North" },
  L1S: { city: "Toronto", neighborhood: "Ajax South" },
  L1T: { city: "Toronto", neighborhood: "Ajax North" },
};

/**
 * Clean and normalize a Canadian Postal Code input
 * Returns formatted 6-character code e.g. "M5V 2T6" or 3-character FSA e.g. "M5V"
 */
export function formatCanadianPostalCode(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.length > 3) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)}`;
  }
  return cleaned;
}

/**
 * Extract Forward Sortation Area (first 3 alphanumeric chars)
 */
export function extractFSA(raw: string): string | null {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.length >= 3) {
    const fsa = cleaned.slice(0, 3);
    // Canadian postal code format: Letter-Digit-Letter
    if (/^[A-CEGHJ-NPR-TVXY]\d[A-CEGHJ-NPR-TVXY]$/.test(fsa)) {
      return fsa;
    }
  }
  return null;
}

/**
 * Check if a code starts with an Ontario prefix (K, L, M, N, P)
 */
export function isOntarioPostalCode(raw: string): boolean {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!cleaned.length) return false;
  const firstChar = cleaned.charAt(0);
  return ["K", "L", "M", "N", "P"].includes(firstChar);
}

/**
 * City centroid coordinates used for general fallbacks
 */
export const CITY_CENTROIDS: Record<string, { lat: number; lon: number }> = {
  Toronto: { lat: 43.6532, lon: -79.3832 },
  Mississauga: { lat: 43.5890, lon: -79.6441 },
  Brampton: { lat: 43.7315, lon: -79.7624 },
  Markham: { lat: 43.8561, lon: -79.3370 },
  Vaughan: { lat: 43.8563, lon: -79.5085 },
  "Richmond Hill": { lat: 43.8828, lon: -79.4403 },
  Ottawa: { lat: 45.4215, lon: -75.6972 },
  Hamilton: { lat: 43.2557, lon: -79.8711 },
  "Kitchener-Waterloo": { lat: 43.4516, lon: -80.4925 },
  London: { lat: 42.9849, lon: -81.2453 },
  Oakville: { lat: 43.4675, lon: -79.6877 },
  Burlington: { lat: 43.3255, lon: -79.7990 },
  Guelph: { lat: 43.5448, lon: -80.2482 },
  Barrie: { lat: 44.3894, lon: -79.6903 },
  Oshawa: { lat: 43.8971, lon: -78.8658 },
  // Canadian Cities
  Vancouver: { lat: 49.2827, lon: -123.1207 },
  Calgary: { lat: 51.0447, lon: -114.0719 },
  Edmonton: { lat: 53.5461, lon: -113.4938 },
  Montreal: { lat: 45.5017, lon: -73.5673 },
  "Quebec City": { lat: 46.8139, lon: -71.2080 },
  Winnipeg: { lat: 49.8951, lon: -97.1384 },
  Halifax: { lat: 44.6488, lon: -63.5752 },
  Victoria: { lat: 48.4284, lon: -123.3656 },
  Saskatoon: { lat: 52.1332, lon: -106.6700 },
  Regina: { lat: 50.4547, lon: -104.6067 },
  // International Cities
  "New York": { lat: 40.7128, lon: -74.0060 },
  "Los Angeles": { lat: 34.0522, lon: -118.2437 },
  Chicago: { lat: 41.8781, lon: -87.6298 },
  "San Francisco": { lat: 37.7749, lon: -122.4194 },
  Seattle: { lat: 47.6062, lon: -122.3321 },
  Boston: { lat: 42.3601, lon: -71.0589 },
  Austin: { lat: 30.2672, lon: -97.7431 },
  "London, UK": { lat: 51.5074, lon: -0.1278 },
  Paris: { lat: 48.8566, lon: 2.3522 },
  Berlin: { lat: 52.5200, lon: 13.4050 },
  Sydney: { lat: -33.8688, lon: 151.2093 },
  Melbourne: { lat: -37.8136, lon: 144.9631 },
  Tokyo: { lat: 35.6762, lon: 139.6503 },
  Other: { lat: 43.6532, lon: -79.3832 },
};

/**
 * Centroid coordinates for Ontario FSAs to allow instant high-accuracy distance calculation
 */
export const FSA_COORDINATES: Record<string, { lat: number; lon: number }> = {
  // Toronto - Old Toronto / Downtown
  M5A: { lat: 43.6542, lon: -79.3608 },
  M5B: { lat: 43.6572, lon: -79.3789 },
  M5C: { lat: 43.6515, lon: -79.3754 },
  M5E: { lat: 43.6448, lon: -79.3733 },
  M5G: { lat: 43.6579, lon: -79.3874 },
  M5H: { lat: 43.6506, lon: -79.3846 },
  M5J: { lat: 43.6408, lon: -79.3817 },
  M5K: { lat: 43.6472, lon: -79.3815 },
  M5L: { lat: 43.6482, lon: -79.3798 },
  M5R: { lat: 43.6727, lon: -79.4057 },
  M5S: { lat: 43.6627, lon: -79.4000 },
  M5T: { lat: 43.6532, lon: -79.4000 },
  M5V: { lat: 43.6441, lon: -79.3949 },
  M5W: { lat: 43.6464, lon: -79.3748 },
  M5X: { lat: 43.6482, lon: -79.3819 },

  // Toronto - West End / Midtown
  M6A: { lat: 43.7185, lon: -79.4648 },
  M6B: { lat: 43.7095, lon: -79.4451 },
  M6C: { lat: 43.6938, lon: -79.4282 },
  M6E: { lat: 43.6890, lon: -79.4535 },
  M6G: { lat: 43.6695, lon: -79.4225 },
  M6H: { lat: 43.6690, lon: -79.4423 },
  M6J: { lat: 43.6479, lon: -79.4197 },
  M6K: { lat: 43.6368, lon: -79.4282 },
  M6L: { lat: 43.7138, lon: -79.4901 },
  M6M: { lat: 43.6969, lon: -79.4851 },
  M6N: { lat: 43.6762, lon: -79.4873 },
  M6P: { lat: 43.6595, lon: -79.4628 },
  M6R: { lat: 43.6489, lon: -79.4563 },
  M6S: { lat: 43.6515, lon: -79.4844 },

  // Toronto - East End / Midtown
  M4A: { lat: 43.7259, lon: -79.3156 },
  M4B: { lat: 43.7064, lon: -79.3099 },
  M4C: { lat: 43.6953, lon: -79.3184 },
  M4E: { lat: 43.6764, lon: -79.2930 },
  M4G: { lat: 43.7091, lon: -79.3635 },
  M4H: { lat: 43.7054, lon: -79.3494 },
  M4J: { lat: 43.6853, lon: -79.3381 },
  M4K: { lat: 43.6796, lon: -79.3522 },
  M4L: { lat: 43.6690, lon: -79.3156 },
  M4M: { lat: 43.6595, lon: -79.3409 },
  M4N: { lat: 43.7280, lon: -79.3888 },
  M4P: { lat: 43.7128, lon: -79.3902 },
  M4R: { lat: 43.7154, lon: -79.4057 },
  M4S: { lat: 43.7043, lon: -79.3888 },
  M4T: { lat: 43.6896, lon: -79.3832 },
  M4V: { lat: 43.6864, lon: -79.4000 },
  M4W: { lat: 43.6796, lon: -79.3775 },
  M4X: { lat: 43.6679, lon: -79.3677 },
  M4Y: { lat: 43.6659, lon: -79.3832 },

  // Toronto - North York
  M2H: { lat: 43.7928, lon: -79.3635 },
  M2J: { lat: 43.7785, lon: -79.3466 },
  M2K: { lat: 43.7869, lon: -79.3859 },
  M2L: { lat: 43.7574, lon: -79.3747 },
  M2M: { lat: 43.7891, lon: -79.4085 },
  M2N: { lat: 43.7701, lon: -79.4085 },
  M2P: { lat: 43.7528, lon: -79.4000 },
  M2R: { lat: 43.7828, lon: -79.4423 },
  M3A: { lat: 43.7533, lon: -79.3296 },
  M3B: { lat: 43.7459, lon: -79.3522 },
  M3C: { lat: 43.7259, lon: -79.3409 },
  M3H: { lat: 43.7543, lon: -79.4423 },
  M3J: { lat: 43.7680, lon: -79.4873 },
  M3K: { lat: 43.7375, lon: -79.4648 },
  M3L: { lat: 43.7390, lon: -79.5069 },
  M3M: { lat: 43.7285, lon: -79.4956 },
  M3N: { lat: 43.7616, lon: -79.5209 },

  // Toronto - Etobicoke
  M8V: { lat: 43.6056, lon: -79.5013 },
  M8W: { lat: 43.6024, lon: -79.5435 },
  M8X: { lat: 43.6536, lon: -79.5069 },
  M8Y: { lat: 43.6363, lon: -79.4985 },
  M8Z: { lat: 43.6288, lon: -79.5210 },
  M9A: { lat: 43.6679, lon: -79.5322 },
  M9B: { lat: 43.6509, lon: -79.5547 },
  M9C: { lat: 43.6436, lon: -79.5772 },
  M9L: { lat: 43.7563, lon: -79.5660 },
  M9M: { lat: 43.7248, lon: -79.5322 },
  M9N: { lat: 43.7069, lon: -79.5182 },
  M9P: { lat: 43.6963, lon: -79.5322 },
  M9R: { lat: 43.6889, lon: -79.5547 },
  M9V: { lat: 43.7394, lon: -79.5885 },
  M9W: { lat: 43.7145, lon: -79.5985 },

  // Toronto - Scarborough
  M1B: { lat: 43.8067, lon: -79.1944 },
  M1C: { lat: 43.7845, lon: -79.1605 },
  M1E: { lat: 43.7636, lon: -79.1887 },
  M1G: { lat: 43.7709, lon: -79.2169 },
  M1H: { lat: 43.7731, lon: -79.2395 },
  M1J: { lat: 43.7447, lon: -79.2395 },
  M1K: { lat: 43.7279, lon: -79.2620 },
  M1L: { lat: 43.7111, lon: -79.2846 },
  M1M: { lat: 43.7163, lon: -79.2395 },
  M1N: { lat: 43.6927, lon: -79.2648 },
  M1P: { lat: 43.7574, lon: -79.2734 },
  M1R: { lat: 43.7501, lon: -79.2958 },
  M1S: { lat: 43.7942, lon: -79.2620 },
  M1T: { lat: 43.7816, lon: -79.3043 },
  M1V: { lat: 43.8153, lon: -79.2846 },
  M1W: { lat: 43.7995, lon: -79.3184 },
  M1X: { lat: 43.8361, lon: -79.2056 },

  // Mississauga
  L4T: { lat: 43.7118, lon: -79.6481 },
  L4V: { lat: 43.6896, lon: -79.6256 },
  L4W: { lat: 43.6395, lon: -79.6200 },
  L4X: { lat: 43.6062, lon: -79.5898 },
  L4Y: { lat: 43.5975, lon: -79.5786 },
  L4Z: { lat: 43.6268, lon: -79.6644 },
  L5A: { lat: 43.5855, lon: -79.6094 },
  L5B: { lat: 43.5890, lon: -79.6441 },
  L5C: { lat: 43.5596, lon: -79.6612 },
  L5E: { lat: 43.5684, lon: -79.5623 },
  L5G: { lat: 43.5524, lon: -79.5849 },
  L5H: { lat: 43.5245, lon: -79.6212 },
  L5J: { lat: 43.5074, lon: -79.6385 },
  L5K: { lat: 43.5284, lon: -79.6698 },
  L5L: { lat: 43.5463, lon: -79.6894 },
  L5M: { lat: 43.5789, lon: -79.7145 },
  L5N: { lat: 43.5985, lon: -79.7423 },
  L5R: { lat: 43.6074, lon: -79.6789 },
  L5V: { lat: 43.6256, lon: -79.7012 },
  L5W: { lat: 43.6548, lon: -79.7189 },

  // Brampton
  L6P: { lat: 43.7845, lon: -79.7212 },
  L6R: { lat: 43.7654, lon: -79.7423 },
  L6S: { lat: 43.7289, lon: -79.7256 },
  L6T: { lat: 43.7089, lon: -79.7089 },
  L6V: { lat: 43.7012, lon: -79.7567 },
  L6W: { lat: 43.6789, lon: -79.7345 },
  L6X: { lat: 43.6845, lon: -79.7890 },
  L6Y: { lat: 43.6578, lon: -79.7645 },
  L6Z: { lat: 43.7256, lon: -79.7823 },
  L7A: { lat: 43.7089, lon: -79.8245 },

  // Markham
  L3P: { lat: 43.8789, lon: -79.2567 },
  L3R: { lat: 43.8561, lon: -79.3370 },
  L3S: { lat: 43.8345, lon: -79.2890 },
  L6B: { lat: 43.8823, lon: -79.2212 },
  L6C: { lat: 43.8956, lon: -79.3423 },
  L6E: { lat: 43.8912, lon: -79.2845 },

  // Vaughan
  L4H: { lat: 43.7989, lon: -79.6123 },
  L4J: { lat: 43.8089, lon: -79.4423 },
  L4K: { lat: 43.7956, lon: -79.5245 },
  L4L: { lat: 43.7789, lon: -79.5890 },
  L6A: { lat: 43.8645, lon: -79.5234 },

  // Richmond Hill
  L4B: { lat: 43.8545, lon: -79.4012 },
  L4C: { lat: 43.8756, lon: -79.4456 },
  L4E: { lat: 43.9245, lon: -79.4567 },
  L4S: { lat: 43.8923, lon: -79.4123 },

  // Ottawa
  K1A: { lat: 45.4248, lon: -75.7001 },
  K1B: { lat: 45.4345, lon: -75.5678 },
  K1C: { lat: 45.4789, lon: -75.5212 },
  K1E: { lat: 45.4678, lon: -75.4890 },
  K1G: { lat: 45.4089, lon: -75.6423 },
  K1H: { lat: 45.3890, lon: -75.6612 },
  K1J: { lat: 45.4456, lon: -75.6012 },
  K1K: { lat: 45.4412, lon: -75.6567 },
  K1L: { lat: 45.4345, lon: -75.6712 },
  K1M: { lat: 45.4512, lon: -75.6789 },
  K1N: { lat: 45.4289, lon: -75.6890 },
  K1P: { lat: 45.4215, lon: -75.6972 },
  K1R: { lat: 45.4123, lon: -75.7123 },
  K1S: { lat: 45.4012, lon: -75.6890 },
  K1T: { lat: 45.3456, lon: -75.6234 },
  K1V: { lat: 45.3489, lon: -75.6712 },
  K1W: { lat: 45.4312, lon: -75.4567 },
  K1X: { lat: 45.3012, lon: -75.5890 },
  K1Y: { lat: 45.3989, lon: -75.7289 },
  K1Z: { lat: 45.3890, lon: -75.7456 },
  K2A: { lat: 45.3812, lon: -75.7612 },
  K2B: { lat: 45.3654, lon: -75.7890 },
  K2C: { lat: 45.3567, lon: -75.7345 },
  K2E: { lat: 45.3512, lon: -75.7089 },
  K2G: { lat: 45.3289, lon: -75.7567 },
  K2H: { lat: 45.3345, lon: -75.8012 },
  K2J: { lat: 45.2789, lon: -75.7567 },
  K2K: { lat: 45.3412, lon: -75.9123 },
  K2L: { lat: 45.3123, lon: -75.8890 },
  K2M: { lat: 45.2890, lon: -75.8654 },
  K2P: { lat: 45.4156, lon: -75.6912 },
  K2R: { lat: 45.3123, lon: -75.7890 },
  K2S: { lat: 45.2612, lon: -75.9234 },
  K2T: { lat: 45.3289, lon: -75.9345 },
  K2V: { lat: 45.2956, lon: -75.9123 },
  K2W: { lat: 45.3989, lon: -75.9678 },
  K4A: { lat: 45.4512, lon: -75.4789 },

  // Hamilton
  L8E: { lat: 43.2345, lon: -79.7234 },
  L8G: { lat: 43.2289, lon: -79.7567 },
  L8H: { lat: 43.2456, lon: -79.8012 },
  L8J: { lat: 43.2012, lon: -79.7890 },
  L8K: { lat: 43.2245, lon: -79.8234 },
  L8L: { lat: 43.2678, lon: -79.8456 },
  L8M: { lat: 43.2456, lon: -79.8423 },
  L8N: { lat: 43.2557, lon: -79.8711 },
  L8P: { lat: 43.2545, lon: -79.8890 },
  L8R: { lat: 43.2654, lon: -79.8765 },
  L8S: { lat: 43.2612, lon: -79.9123 },
  L8T: { lat: 43.2234, lon: -79.8654 },
  L8V: { lat: 43.2189, lon: -79.8823 },
  L8W: { lat: 43.1956, lon: -79.8567 },
  L9A: { lat: 43.2289, lon: -79.9012 },
  L9B: { lat: 43.1989, lon: -79.9123 },
  L9C: { lat: 43.2245, lon: -79.9234 },
  L9G: { lat: 43.2089, lon: -79.9823 },
  L9H: { lat: 43.2712, lon: -79.9567 },
  L9K: { lat: 43.2189, lon: -79.9567 },

  // Kitchener-Waterloo
  N2A: { lat: 43.4345, lon: -80.4423 },
  N2B: { lat: 43.4567, lon: -80.4678 },
  N2C: { lat: 43.4212, lon: -80.4612 },
  N2E: { lat: 43.4189, lon: -80.5123 },
  N2G: { lat: 43.4489, lon: -80.4876 },
  N2H: { lat: 43.4589, lon: -80.4812 },
  N2J: { lat: 43.4756, lon: -80.5212 },
  N2K: { lat: 43.5012, lon: -80.4956 },
  N2L: { lat: 43.4789, lon: -80.5423 },
  N2M: { lat: 43.4389, lon: -80.5012 },
  N2N: { lat: 43.4256, lon: -80.5456 },
  N2P: { lat: 43.3989, lon: -80.4789 },
  N2R: { lat: 43.3856, lon: -80.5012 },
  N2T: { lat: 43.4512, lon: -80.5678 },
  N2V: { lat: 43.4789, lon: -80.5890 },

  // London
  N5V: { lat: 43.0123, lon: -81.1890 },
  N5W: { lat: 42.9912, lon: -81.2123 },
  N5X: { lat: 43.0345, lon: -81.2456 },
  N5Y: { lat: 43.0123, lon: -81.2345 },
  N5Z: { lat: 42.9567, lon: -81.2123 },
  N6A: { lat: 42.9867, lon: -81.2512 },
  N6B: { lat: 42.9812, lon: -81.2412 },
  N6C: { lat: 42.9612, lon: -81.2456 },
  N6E: { lat: 42.9345, lon: -81.2234 },
  N6G: { lat: 43.0234, lon: -81.2890 },
  N6H: { lat: 42.9845, lon: -81.2890 },
  N6J: { lat: 42.9567, lon: -81.2712 },
  N6K: { lat: 42.9512, lon: -81.3123 },
  N6L: { lat: 42.9123, lon: -81.2890 },
  N6M: { lat: 42.9678, lon: -81.1890 },
  N6P: { lat: 42.9189, lon: -81.3345 },

  // Oakville
  L6H: { lat: 43.4756, lon: -79.7123 },
  L6J: { lat: 43.4545, lon: -79.6789 },
  L6K: { lat: 43.4389, lon: -79.6890 },
  L6L: { lat: 43.4089, lon: -79.7234 },
  L6M: { lat: 43.4345, lon: -79.7567 },

  // Burlington
  L7L: { lat: 43.3789, lon: -79.7567 },
  L7M: { lat: 43.3890, lon: -79.8123 },
  L7N: { lat: 43.3545, lon: -79.7890 },
  L7P: { lat: 43.3678, lon: -79.8456 },
  L7R: { lat: 43.3289, lon: -79.7989 },
  L7S: { lat: 43.3189, lon: -79.8123 },
  L7T: { lat: 43.3089, lon: -79.8345 },

  // Guelph
  N1C: { lat: 43.5123, lon: -80.2234 },
  N1E: { lat: 43.5678, lon: -80.2345 },
  N1G: { lat: 43.5289, lon: -80.2189 },
  N1H: { lat: 43.5456, lon: -80.2567 },
  N1K: { lat: 43.5234, lon: -80.3012 },
  N1L: { lat: 43.5412, lon: -80.1890 },

  // Barrie
  L4M: { lat: 44.4012, lon: -79.6612 },
  L4N: { lat: 44.3678, lon: -79.6890 },

  // Oshawa / Durham
  L1H: { lat: 43.8823, lon: -78.8456 },
  L1J: { lat: 43.8678, lon: -78.8890 },
  L1K: { lat: 43.9345, lon: -78.8123 },
  L1L: { lat: 43.9567, lon: -78.8345 },
  L1N: { lat: 43.8789, lon: -78.9345 },
  L1P: { lat: 43.9012, lon: -78.9456 },
  L1R: { lat: 43.9234, lon: -78.9678 },
  L1S: { lat: 43.8456, lon: -79.0234 },
  L1T: { lat: 43.8712, lon: -79.0345 },
  L1V: { lat: 43.8345, lon: -79.0890 },
  L1W: { lat: 43.8123, lon: -79.0765 },
  L1X: { lat: 43.8567, lon: -79.1123 },
};

/**
 * Detect City and Neighborhood from Postal Code
 * 1. Checks fast local table
 * 2. If not found and valid Canadian FSA, calls free Zippopotam API as backup
 */
export async function detectCityFromPostalCode(
  rawPostal: string
): Promise<DetectedLocation | null> {
  const formatted = formatCanadianPostalCode(rawPostal);
  const fsa = extractFSA(rawPostal);

  if (!fsa) return null;

  // 1. Fast local lookup
  if (ONTARIO_FSA_MAP[fsa]) {
    const match = ONTARIO_FSA_MAP[fsa];
    const coords = FSA_COORDINATES[fsa] || (CITY_CENTROIDS[match.city] ?? CITY_CENTROIDS["Toronto"]);
    return {
      postalCode: formatted,
      fsa,
      city: match.city,
      neighborhood: match.neighborhood,
      province: "Ontario",
      source: "fsa_table",
      lat: coords.lat,
      lon: coords.lon,
    };
  }

  // Check generic province indicator based on Canada Post standards
  const firstLetter = fsa.charAt(0);
  let guessedCity: string = "Other";
  let guessedProvince = "Ontario";

  if (firstLetter === "M") {
    guessedCity = "Toronto";
  } else if (firstLetter === "K") {
    guessedCity = "Ottawa";
  } else if (firstLetter === "L") {
    guessedCity = "Mississauga";
  } else if (firstLetter === "N") {
    guessedCity = "London";
  } else if (firstLetter === "P") {
    guessedCity = "Other";
    guessedProvince = "Northern Ontario";
  } else {
    guessedProvince = "Outside Ontario";
  }

  // 2. Fallback network lookup for rural or newly created FSAs
  try {
    const response = await fetch(`https://api.zippopotam.us/ca/${fsa.toLowerCase()}`);
    if (response.ok) {
      const data = await response.json();
      if (data && data.places && data.places.length > 0) {
        const place = data.places[0];
        const placeName: string = place["place name"] || "";
        const state: string = place["state"] || guessedProvince;
        const apiLat = place["latitude"] ? parseFloat(place["latitude"]) : undefined;
        const apiLon = place["longitude"] ? parseFloat(place["longitude"]) : undefined;

        // Map to known duogo city if close match
        const lowerPlace = placeName.toLowerCase();
        let finalCity: string = guessedCity;

        if (lowerPlace.includes("toronto") || lowerPlace.includes("scarborough") || lowerPlace.includes("north york") || lowerPlace.includes("etobicoke") || lowerPlace.includes("york")) {
          finalCity = "Toronto";
        } else if (lowerPlace.includes("mississauga")) {
          finalCity = "Mississauga";
        } else if (lowerPlace.includes("brampton")) {
          finalCity = "Brampton";
        } else if (lowerPlace.includes("markham")) {
          finalCity = "Markham";
        } else if (lowerPlace.includes("vaughan") || lowerPlace.includes("woodbridge") || lowerPlace.includes("maple") || lowerPlace.includes("thornhill")) {
          finalCity = "Vaughan";
        } else if (lowerPlace.includes("richmond hill")) {
          finalCity = "Richmond Hill";
        } else if (lowerPlace.includes("ottawa") || lowerPlace.includes("kanata") || lowerPlace.includes("nepean") || lowerPlace.includes("orleans")) {
          finalCity = "Ottawa";
        } else if (lowerPlace.includes("hamilton") || lowerPlace.includes("ancaster") || lowerPlace.includes("dundas") || lowerPlace.includes("stoney creek")) {
          finalCity = "Hamilton";
        } else if (lowerPlace.includes("kitchener") || lowerPlace.includes("waterloo")) {
          finalCity = "Kitchener-Waterloo";
        } else if (lowerPlace.includes("london")) {
          finalCity = "London";
        } else if (lowerPlace.includes("oakville")) {
          finalCity = "Oakville";
        } else if (lowerPlace.includes("burlington")) {
          finalCity = "Burlington";
        } else if (lowerPlace.includes("guelph")) {
          finalCity = "Guelph";
        } else if (lowerPlace.includes("barrie")) {
          finalCity = "Barrie";
        } else if (lowerPlace.includes("oshawa") || lowerPlace.includes("whitby") || lowerPlace.includes("pickering") || lowerPlace.includes("ajax")) {
          finalCity = "Oshawa";
        } else {
          finalCity = placeName || "Other";
        }

        const fallbackCoords = FSA_COORDINATES[fsa] || CITY_CENTROIDS[finalCity] || CITY_CENTROIDS["Toronto"];

        return {
          postalCode: formatted,
          fsa,
          city: finalCity,
          neighborhood: placeName !== finalCity ? placeName : undefined,
          province: state,
          source: "api",
          lat: apiLat || fallbackCoords.lat,
          lon: apiLon || fallbackCoords.lon,
        };
      }
    }
  } catch (err) {
    // Network lookup fail, gracefully fall back to initial guess
    console.debug("Postal code lookup network error", err);
  }

  // Return best guess if Ontario letter
  const finalCoords = FSA_COORDINATES[fsa] || CITY_CENTROIDS[guessedCity] || CITY_CENTROIDS["Toronto"];
  return {
    postalCode: formatted,
    fsa,
    city: guessedCity,
    province: guessedProvince,
    source: "fsa_table",
    lat: finalCoords.lat,
    lon: finalCoords.lon,
  };
}

/**
 * Reverse Geocode browser coordinates to nearest Ontario city
 */
export async function detectCityFromCoordinates(
  lat: number,
  lon: number
): Promise<{ city: string; postalCode?: string; neighborhood?: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "en" },
    });
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const rawCity =
        addr.city || addr.town || addr.municipality || addr.county || addr.suburb || "";
      const rawPostcode = addr.postcode || "";

      let mappedCity = "Other";
      const lc = rawCity.toLowerCase();
      if (lc.includes("toronto") || lc.includes("scarborough") || lc.includes("north york") || lc.includes("etobicoke")) {
        mappedCity = "Toronto";
      } else if (lc.includes("mississauga")) {
        mappedCity = "Mississauga";
      } else if (lc.includes("brampton")) {
        mappedCity = "Brampton";
      } else if (lc.includes("markham")) {
        mappedCity = "Markham";
      } else if (lc.includes("vaughan")) {
        mappedCity = "Vaughan";
      } else if (lc.includes("richmond hill")) {
        mappedCity = "Richmond Hill";
      } else if (lc.includes("ottawa")) {
        mappedCity = "Ottawa";
      } else if (lc.includes("hamilton")) {
        mappedCity = "Hamilton";
      } else if (lc.includes("kitchener") || lc.includes("waterloo")) {
        mappedCity = "Kitchener-Waterloo";
      } else if (lc.includes("london")) {
        mappedCity = "London";
      } else if (lc.includes("oakville")) {
        mappedCity = "Oakville";
      } else if (lc.includes("burlington")) {
        mappedCity = "Burlington";
      } else if (lc.includes("guelph")) {
        mappedCity = "Guelph";
      } else if (lc.includes("barrie")) {
        mappedCity = "Barrie";
      } else if (lc.includes("oshawa") || lc.includes("whitby")) {
        mappedCity = "Oshawa";
      } else if (rawCity) {
        mappedCity = rawCity;
      }

      return {
        city: mappedCity,
        postalCode: rawPostcode ? formatCanadianPostalCode(rawPostcode) : undefined,
        neighborhood: addr.neighbourhood || addr.suburb || undefined,
      };
    }
  } catch (e) {
    console.debug("Geolocation reverse lookup error", e);
  }

  // Fallback distance calculation to prominent hubs
  const hubs = [
    { city: "Toronto", lat: 43.6532, lon: -79.3832 },
    { city: "Mississauga", lat: 43.589, lon: -79.6441 },
    { city: "Brampton", lat: 43.7315, lon: -79.7624 },
    { city: "Markham", lat: 43.8561, lon: -79.337 },
    { city: "Vaughan", lat: 43.8563, lon: -79.5085 },
    { city: "Richmond Hill", lat: 43.8828, lon: -79.4403 },
    { city: "Ottawa", lat: 45.4215, lon: -75.6972 },
    { city: "Hamilton", lat: 43.2557, lon: -79.8711 },
    { city: "Kitchener-Waterloo", lat: 43.4516, lon: -80.4925 },
    { city: "London", lat: 42.9849, lon: -81.2453 },
  ];

  let closest = hubs[0];
  let minDistance = Infinity;

  for (const h of hubs) {
    const d = Math.hypot(lat - h.lat, lon - h.lon);
    if (d < minDistance) {
      minDistance = d;
      closest = h;
    }
  }

  return { city: closest.city };
}

/**
 * Extract Canadian postal code (e.g. "M5V 2T6" or "M5V") from any location string
 * Works with "Toronto · M5V 2T6", "M5V 2T6", "Toronto (M5V 2T6)", etc.
 */
export function extractPostalCode(raw?: string | null): string | null {
  if (!raw) return null;
  // Look for 6-char code A1A 1A1 or A1A1A1
  const fullMatch = raw.match(/\b([A-CEGHJ-NPR-TVXY]\d[A-CEGHJ-NPR-TVXY])\s*(\d[A-CEGHJ-NPR-TVXY]\d)\b/i);
  if (fullMatch) {
    return `${fullMatch[1].toUpperCase()} ${fullMatch[2].toUpperCase()}`;
  }
  // Look for 3-char FSA
  const fsaMatch = raw.match(/\b([A-CEGHJ-NPR-TVXY]\d[A-CEGHJ-NPR-TVXY])\b/i);
  if (fsaMatch) {
    return fsaMatch[1].toUpperCase();
  }
  return null;
}

/**
 * Extract clean city name from a location string e.g. "Toronto · M5V 2T6" -> "Toronto"
 */
export function extractCityName(raw?: string | null): string {
  if (!raw) return "";
  // Split on "·", "-", "/", or "("
  const parts = raw.split(/[·\-/(]/);
  const candidate = parts[0]?.trim();
  if (candidate && candidate.length > 1 && !/^[A-CEGHJ-NPR-TVXY]\d/i.test(candidate)) {
    return candidate;
  }
  return raw.trim() || "";
}

/**
 * Get coordinates for a postal code, FSA, or location string
 */
export function getCoordinatesForPostalOrLocation(
  str?: string | null
): { lat: number; lon: number } | null {
  if (!str) return null;

  // 1. Try extracting FSA
  const fsa = extractFSA(str);
  if (fsa && FSA_COORDINATES[fsa]) {
    return FSA_COORDINATES[fsa];
  }

  // 2. Check if FSA map has it and fallback to city centroid
  if (fsa && ONTARIO_FSA_MAP[fsa]) {
    const c = ONTARIO_FSA_MAP[fsa].city;
    if (CITY_CENTROIDS[c]) return CITY_CENTROIDS[c];
  }

  // 3. Try matching city name
  const city = extractCityName(str);
  if (CITY_CENTROIDS[city]) {
    return CITY_CENTROIDS[city];
  }

  // Check case-insensitive match for cities
  for (const [knownCity, coords] of Object.entries(CITY_CENTROIDS)) {
    if (str.toLowerCase().includes(knownCity.toLowerCase())) {
      return coords;
    }
  }

  return null;
}

/**
 * Great-circle distance calculation via Haversine formula
 * Returns distance in kilometers, rounded to 1 decimal place
 */
export function calculateDistanceBetweenCoords(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 10) / 10;
}

/**
 * Calculate distance in km between two locations (postal code, FSA, or location string)
 * Returns number (in km) or null if cannot be calculated
 */
export function calculateDistanceKm(
  locA?: string | null,
  locB?: string | null
): number | null {
  if (!locA || !locB) return null;

  const fsaA = extractFSA(locA);
  const fsaB = extractFSA(locB);

  // If both have the exact same FSA (e.g. both in M5V), they are in the exact same neighborhood!
  if (fsaA && fsaB && fsaA === fsaB) {
    return 1.2; // Intra-neighborhood proximity (~1.2 km, safely within 5 km)
  }

  const coordsA = getCoordinatesForPostalOrLocation(locA);
  const coordsB = getCoordinatesForPostalOrLocation(locB);

  if (!coordsA || !coordsB) return null;

  return calculateDistanceBetweenCoords(
    coordsA.lat,
    coordsA.lon,
    coordsB.lat,
    coordsB.lon
  );
}

/**
 * Check whether two locations are within a specified radius (in km)
 */
export function isWithinRadius(
  locA?: string | null,
  locB?: string | null,
  maxRadiusKm: number = 5
): boolean {
  const dist = calculateDistanceKm(locA, locB);
  if (dist === null) return false;
  return dist <= maxRadiusKm;
}

/**
 * Check whether two locations are within 5 km radius
 */
export function isWithin5Km(
  locA?: string | null,
  locB?: string | null
): boolean {
  return isWithinRadius(locA, locB, 5.0);
}
