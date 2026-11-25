import type { MoaGroup, Reason, ReasonCode, Severity } from "./types";

const g = (x: MoaGroup) => `Group ${x.short}`;
const gHi = (x: MoaGroup) => `ग्रुप ${x.short}`;

const r = (code: ReasonCode, severity: Severity, en: string, hi: string): Reason => ({ code, severity, en, hi });

/** Every user-facing rule message, in English and Hindi. Kept in one place so wording can be reviewed by an agronomist. */
export const msg = {
  notApproved: (detail: "pest" | "crop" | "unregistered") =>
    detail === "pest"
      ? r("NOT_APPROVED", "block", "Approved for this crop, but not for this pest. Using it here is off-label.", "यह दवा इस फसल के लिए है, पर इस कीट/रोग के लिए स्वीकृत नहीं है।")
      : detail === "crop"
        ? r("NOT_APPROVED", "block", "Not approved for this crop in the CIB&RC list.", "यह दवा इस फसल के लिए CIB&RC सूची में स्वीकृत नहीं है।")
        : r("NOT_APPROVED", "block", "This formulation is not in the CIB&RC registered list. It may be unregistered or spurious.", "यह फ़ॉर्मूलेशन CIB&RC पंजीकृत सूची में नहीं है। यह नकली या अपंजीकृत हो सकता है।"),

  sameAsLast: (grp: MoaGroup, lastLabel: string) =>
    r(
      "SAME_GROUP_AS_LAST_SPRAY",
      "block",
      `Same mode of action as the last spray (${lastLabel}, ${g(grp)}). Back-to-back use of one group is how resistance builds.`,
      `पिछला छिड़काव (${lastLabel}) भी ${gHi(grp)} का था। एक ही ग्रुप लगातार इस्तेमाल करने से कीट में प्रतिरोध बढ़ता है।`,
    ),

  seasonLimit: (grp: MoaGroup, used: number, block: boolean) =>
    r(
      "GROUP_SEASON_LIMIT",
      block ? "block" : "warn",
      block
        ? `${g(grp)} has already been used ${used} times this season. Rotate to a different group.`
        : `This would be use number ${used + 1} of ${g(grp)} this season. Prefer a different group if one is available.`,
      block
        ? `${gHi(grp)} इस सीज़न में ${used} बार पहले ही इस्तेमाल हो चुका है। दूसरा ग्रुप चुनें।`
        : `इस सीज़न में यह ${gHi(grp)} का ${used + 1}वां इस्तेमाल होगा। हो सके तो दूसरा ग्रुप चुनें।`,
    ),

  usedBefore: (grp: MoaGroup) =>
    r("GROUP_USED_BEFORE", "info", `${g(grp)} was used once earlier this season (not the last spray).`, `${gHi(grp)} इस सीज़न में पहले एक बार इस्तेमाल हुआ है।`),

  newGroup: () =>
    r("NEW_GROUP", "good", "New mode of action for this field this season.", "इस सीज़न में इस खेत के लिए नया ग्रुप।"),

  phiExceeds: (phi: number, days: number) =>
    r(
      "PHI_EXCEEDS_HARVEST",
      "block",
      `Needs ${phi} days before harvest, but the next harvest is in ${days} days. Residue risk.`,
      `इस दवा के बाद ${phi} दिन तक तुड़ाई नहीं कर सकते, पर तुड़ाई ${days} दिन में है। अवशेष (रेज़िड्यू) का खतरा।`,
    ),

  phiUnknown: () =>
    r("PHI_UNKNOWN", "info", "Waiting period is not listed in the CIB&RC table. Read the label before harvest.", "प्रतीक्षा अवधि सूची में नहीं है। तुड़ाई से पहले लेबल पढ़ें।"),

  unknownGroup: (active: string) =>
    r("UNKNOWN_GROUP", "warn", `Mode of action for ${active} is not confirmed, so rotation cannot be checked.`, `${active} का ग्रुप पक्का नहीं है, इसलिए रोटेशन जाँचा नहीं जा सका।`),

  beeHazard: () =>
    r("BEE_HAZARD_FLOWERING", "warn", "Crop is flowering and this chemistry is toxic to bees. Spray late evening, not on open flowers.", "फसल में फूल हैं और यह दवा मधुमक्खियों के लिए ज़हरीली है। शाम को छिड़काव करें।"),

  pyrethroidEarly: () =>
    r(
      "PYRETHROID_EARLY_COTTON",
      "warn",
      "Pyrethroids early in the cotton season are linked to whitefly resurgence. Keep them for later in the season.",
      "कपास में शुरुआती दिनों में पायरेथ्रॉइड से सफ़ेद मक्खी बढ़ सकती है। इन्हें सीज़न के बाद के लिए रखें।",
    ),

  highRiskFungicide: (grp: MoaGroup) =>
    r(
      "HIGH_RISK_FUNGICIDE",
      "warn",
      `${grp.name} carry a high resistance risk. Limit the number of sprays and alternate with a multi-site fungicide.`,
      `${g(grp)} में प्रतिरोध का खतरा ज़्यादा है। छिड़काव सीमित रखें और मल्टी-साइट फफूंदनाशक के साथ बदल-बदल कर दें।`,
    ),

  selective: () =>
    r("SELECTIVE", "good", "Narrow-spectrum chemistry, gentler on natural enemies.", "चुनिंदा असर वाली दवा, मित्र कीटों पर कम असर।"),

  noResistance: () =>
    r("NO_RESISTANCE_RISK", "good", "Pheromone-based. No insecticide resistance pressure.", "फेरोमोन आधारित। कीटनाशक प्रतिरोध का खतरा नहीं।"),

  genericBollworm: () =>
    r("GENERIC_BOLLWORM_CLAIM", "info", "Label claim reads 'bollworms' (the bollworm complex), not this species by name.", "लेबल पर 'बॉलवर्म' (सुंडी समूह) लिखा है, इस कीट का नाम अलग से नहीं।"),

  specialMethod: (method: string) =>
    r(
      "SPECIAL_METHOD",
      "info",
      method === "granules"
        ? "Granules: broadcast in the field, not a spray."
        : method === "soil_drench"
          ? "Soil drench application, not a foliar spray."
          : method === "seed_treatment"
            ? "Seed treatment only."
            : "Nursery application only.",
      method === "granules" ? "दानेदार दवा: खेत में बिखेरें, छिड़काव नहीं।" : method === "soil_drench" ? "जड़ों में डालने (ड्रेंच) के लिए।" : "केवल बीज/नर्सरी उपचार के लिए।",
    ),
};
