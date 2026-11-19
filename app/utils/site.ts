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

/** Attribution for the CC BY-SA 4.0 photos in public/images. */
export const PHOTO_CREDITS = [
  {
    file: "redclaw-crayfish.jpg",
    subject: "Red Claw crayfish",
    author: "5snake5",
    source: "https://commons.wikimedia.org/wiki/File:Cherax_quadricarinatus_im_Aquarium.jpg",
  },
  {
    file: "redclaw-crayfish-wild.jpg",
    subject: "Red Claw on leaf litter",
    author: "nature.catcher",
    source: "https://commons.wikimedia.org/wiki/File:Australian_red_claw_crayfish_(Cherax_quadricarinatus).jpg",
  },
  {
    file: "aquaculture-ponds.jpg",
    subject: "Dumangas Brackishwater Station",
    author: "RDBD86",
    source: "https://commons.wikimedia.org/wiki/File:Dumangas_Brackishwater_Station.jpg",
  },
] as const;
