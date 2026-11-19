/**
 * Public business details. Address and contact number match the farm
 * contact FAQ seeded by server/utils/faq-seed.js; social links match the
 * links already published on the site.
 */
export const FARM = {
  name: "BOSSGUDO A.R.C. AQUA FARM",
  shortName: "Boss Gudo",
  address: "1111 Purok 12, Bacao 2, General Trias, Cavite",
  landmark: "Near EPZA",
  mapsQuery: "BOSSGUDO A.R.C. AQUA FARM",
  phoneDisplay: "0956 124 1825",
  phoneHref: "tel:+639561241825",
  facebook: "https://www.facebook.com/profile.php?id=61575088857931",
  tiktok: "https://www.tiktok.com/@jedd.angelo?is_from_webapp=1&sender_device=pc",
} as const;

export const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(FARM.mapsQuery)}`;
