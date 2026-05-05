/**
 * Mappt einen Einkaufs-Item-Namen auf eine Standard-Kategorie.
 * Wird nur als Fallback verwendet, wenn `ShoppingListItem.category` leer ist.
 */

export const CATEGORY_ORDER = [
  "Obst & Gemüse",
  "Backwaren",
  "Milchprodukte",
  "Fleisch & Fisch",
  "Vorrat",
  "Gewürze",
  "Tiefkühl",
  "Getränke",
  "Sonstiges",
] as const;

export type ShoppingCategory = (typeof CATEGORY_ORDER)[number];

const RULES: { category: ShoppingCategory; patterns: RegExp[] }[] = [
  {
    category: "Tiefkühl",
    patterns: [/tiefk[üu]hl/i, /tk[\s-]/i, /\btk\b/i, /gefrier/i, /eis\b/i],
  },
  {
    category: "Obst & Gemüse",
    patterns: [
      /tomate/i, /gurke/i, /salat/i, /paprika/i, /zwiebel/i, /knoblauch/i, /lauch/i, /porree/i,
      /kartoffel/i, /karotte/i, /m[öo]hre/i, /sellerie/i, /pilz/i, /champignon/i, /zucchini/i,
      /aubergine/i, /spinat/i, /ruccola/i, /rucola/i, /b[äa]rlauch/i, /kr[äa]uter/i, /petersilie/i,
      /basilikum/i, /schnittlauch/i, /dill/i, /minze/i, /apfel/i, /birne/i, /banane/i, /beere/i,
      /melone/i, /zitrone/i, /limette/i, /orange/i, /avocado/i, /spargel/i, /rhabarber/i,
      /k[üu]rbis/i, /broccoli/i, /brokkoli/i, /blumenkohl/i, /kohl/i, /rettich/i, /radieschen/i,
      /erbse/i, /bohne/i, /linse/i, /feld/i, /chicor/i, /rote\s+beete/i, /rosenkohl/i,
      /ingwer/i,
    ],
  },
  {
    category: "Backwaren",
    patterns: [/brot/i, /br[öo]tchen/i, /baguette/i, /toast/i, /sem(m|p)el/i, /croissant/i, /lavash/i, /tortilla/i, /wrap/i],
  },
  {
    category: "Milchprodukte",
    patterns: [
      /milch\b/i, /joghurt/i, /quark/i, /sahne/i, /schmand/i, /cr[èe]me\s*fra[îi]che/i,
      /butter/i, /k[äa]se/i, /mozzarella/i, /parmesan/i, /feta/i, /ricotta/i, /mascarpone/i,
      /frischk[äa]se/i, /gouda/i, /cheddar/i, /halloumi/i, /ei\b/i, /eier/i,
    ],
  },
  {
    category: "Fleisch & Fisch",
    patterns: [
      /h[äa]hnchen/i, /huhn/i, /hahn\b/i, /pute/i, /rind/i, /schwein/i, /lamm/i, /kalb/i,
      /hack/i, /faschiert/i, /steak/i, /filet/i, /braten/i, /wurst/i, /schinken/i, /salami/i,
      /speck/i, /bacon/i, /lachs/i, /thunfisch/i, /fisch/i, /forelle/i, /kabeljau/i, /scampi/i,
      /garnele/i, /shrimp/i, /tofu/i, /tempeh/i, /seitan/i,
    ],
  },
  {
    category: "Gewürze",
    patterns: [
      /salz\b/i, /pfeffer/i, /paprikapulver/i, /curry/i, /kreuzk[üu]mmel/i, /kumin/i, /koriander/i,
      /zimt/i, /muskat/i, /vanille/i, /lorbeer/i, /thymian/i, /rosmarin/i, /oregano/i, /majoran/i,
      /chili(?!\s+con)/i, /cayenne/i, /kurkuma/i, /sumach/i, /safran/i, /n[äa]gelein/i, /gew[üu]rz/i,
    ],
  },
  {
    category: "Vorrat",
    patterns: [
      /reis\b/i, /risotto-reis/i, /arborio/i, /pasta/i, /nudel/i, /spaghetti/i, /penne/i, /fusilli/i,
      /tagliatelle/i, /lasagne/i, /couscous/i, /bulgur/i, /quinoa/i, /haferflocken/i, /m[üu]sli/i,
      /mehl/i, /zucker/i, /backpulver/i, /hefe/i, /honig/i, /senf/i, /ketchup/i, /mayo/i,
      /[öo]l\b/i, /essig/i, /sojasauce/i, /soja-sauce/i, /tomatenmark/i, /passata/i, /dose/i, /konserve/i,
      /br[üu]he/i, /fond/i, /bouillon/i, /kokosmilch/i, /tahini/i, /hummus/i, /nuss/i, /mandel/i, /walnuss/i,
      /haseln/i, /samen/i, /kerne/i,
    ],
  },
  {
    category: "Getränke",
    patterns: [/wasser/i, /saft/i, /limonade/i, /cola/i, /bier/i, /wein\b/i, /schorle/i, /tee\b/i, /kaffee/i, /espresso/i, /milchgetr/i],
  },
];

export function categorize(name: string | null | undefined): ShoppingCategory {
  if (!name) return "Sonstiges";
  const text = name.toLowerCase();
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(text))) return rule.category;
  }
  return "Sonstiges";
}

export function sortCategoryKey(category: string): number {
  const idx = (CATEGORY_ORDER as readonly string[]).indexOf(category);
  return idx === -1 ? CATEGORY_ORDER.length : idx;
}
