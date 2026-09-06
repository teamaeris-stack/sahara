import type { L } from "./i18n";
import type { EmergencyType, SOSFlag, SOSResponses } from "./sos";

/**
 * Data-driven, context-aware SOS questions.
 * Each emergency type declares its own ordered questions; the UI renders them generically.
 * Option values are English enums so stored packets stay machine-readable in any UI language.
 */

export interface FlowOption {
  value: string;
  label: L;
}

export interface FlowQuestion {
  id: string;
  prompt: L;
  kind: "single" | "text";
  options?: FlowOption[];
  /** Text questions only. */
  placeholder?: L;
  maxLength?: number;
  /** Ask only when earlier answers match. */
  showIf?: (responses: SOSResponses) => boolean;
}

export interface EmergencyFlow {
  type: EmergencyType;
  questions: FlowQuestion[];
  /** Prompt for the people stepper; omit to skip the people question. */
  peoplePrompt?: L;
  /** Ask people count only when this returns true (default: always). */
  peopleIf?: (responses: SOSResponses) => boolean;
  /** Relevant optional flags for this emergency; empty = none shown. */
  flags: SOSFlag[];
  /** Offer FIND SAFE PLACE on the saved screen. */
  suggestShelter: boolean;
}

const YES_NO_UNSURE: FlowOption[] = [
  { value: "YES", label: { en: "YES", hi: "हाँ" } },
  { value: "NO", label: { en: "NO", hi: "नहीं" } },
  { value: "UNSURE", label: { en: "UNSURE", hi: "पता नहीं" } },
];

const YES_NO: FlowOption[] = [
  { value: "YES", label: { en: "YES", hi: "हाँ" } },
  { value: "NO", label: { en: "NO", hi: "नहीं" } },
];

const PEOPLE_DEFAULT: L = { en: "HOW MANY PEOPLE NEED HELP?", hi: "कितने लोगों को मदद चाहिए?" };

export const FLOWS: Record<EmergencyType, EmergencyFlow> = {
  // SOS NOW never asks questions; this entry only keeps shared screens (saved / status) type-complete.
  URGENT_UNSPECIFIED: { type: "URGENT_UNSPECIFIED", questions: [], flags: [], suggestShelter: true },

  EARTHQUAKE: {
    type: "EARTHQUAKE",
    questions: [
      {
        id: "subType",
        kind: "single",
        prompt: { en: "WHAT IS YOUR SITUATION?", hi: "आपकी स्थिति क्या है?" },
        options: [
          { value: "BUILDING_DAMAGED", label: { en: "BUILDING DAMAGED", hi: "इमारत क्षतिग्रस्त" } },
          { value: "TRAPPED_INSIDE", label: { en: "TRAPPED INSIDE", hi: "अंदर फँसे हैं" } },
          { value: "PEOPLE_INJURED", label: { en: "PEOPLE INJURED", hi: "लोग घायल हैं" } },
          { value: "GAS_OR_FIRE", label: { en: "GAS SMELL / FIRE", hi: "गैस की गंध / आग" } },
          { value: "SAFE_OUTSIDE_NEED_HELP", label: { en: "OUTSIDE, NEED HELP", hi: "बाहर हैं, मदद चाहिए" } },
        ],
      },
      {
        id: "canExit",
        kind: "single",
        prompt: { en: "CAN YOU EXIT THE BUILDING SAFELY?", hi: "क्या आप सुरक्षित बाहर निकल सकते हैं?" },
        options: YES_NO_UNSURE,
        showIf: (r) => r["subType"] === "BUILDING_DAMAGED" || r["subType"] === "TRAPPED_INSIDE",
      },
      {
        id: "aftershocks",
        kind: "single",
        prompt: { en: "IS THE GROUND STILL SHAKING?", hi: "क्या ज़मीन अभी भी हिल रही है?" },
        options: YES_NO_UNSURE,
      },
    ],
    peoplePrompt: PEOPLE_DEFAULT,
    flags: ["CANNOT_MOVE", "CHILD", "ELDERLY", "ACCESSIBILITY", "MEDICAL_HELP"],
    suggestShelter: true,
  },

  CYCLONE: {
    type: "CYCLONE",
    questions: [
      {
        id: "subType",
        kind: "single",
        prompt: { en: "WHAT IS HAPPENING?", hi: "क्या हो रहा है?" },
        options: [
          { value: "ROOF_DAMAGE", label: { en: "ROOF / WALL DAMAGE", hi: "छत / दीवार को नुकसान" } },
          { value: "FLOODING_WITH_STORM", label: { en: "FLOODING WITH STORM", hi: "तूफ़ान के साथ बाढ़" } },
          { value: "FALLEN_TREE_OR_POLE", label: { en: "FALLEN TREE / POLE", hi: "गिरा पेड़ / खंभा" } },
          { value: "NEED_SHELTER", label: { en: "NEED A SAFE SHELTER", hi: "सुरक्षित आश्रय चाहिए" } },
          { value: "OTHER", label: { en: "OTHER", hi: "अन्य" } },
        ],
      },
      {
        id: "indoors",
        kind: "single",
        prompt: { en: "ARE YOU INDOORS?", hi: "क्या आप घर के अंदर हैं?" },
        options: YES_NO,
      },
      {
        id: "powerLines",
        kind: "single",
        prompt: { en: "ARE POWER LINES DOWN NEARBY?", hi: "क्या पास में बिजली के तार गिरे हैं?" },
        options: YES_NO_UNSURE,
      },
    ],
    peoplePrompt: PEOPLE_DEFAULT,
    flags: ["CHILD", "ELDERLY", "ACCESSIBILITY", "MEDICAL_DEPENDENCY"],
    suggestShelter: true,
  },

  LANDSLIDE: {
    type: "LANDSLIDE",
    questions: [
      {
        id: "subType",
        kind: "single",
        prompt: { en: "WHAT IS YOUR SITUATION?", hi: "आपकी स्थिति क्या है?" },
        options: [
          { value: "SLOPE_MOVING", label: { en: "SLOPE / SOIL MOVING", hi: "ढलान / मिट्टी खिसक रही है" } },
          { value: "HOUSE_HIT", label: { en: "HOUSE HIT BY DEBRIS", hi: "घर पर मलबा गिरा" } },
          { value: "ROAD_CUT_OFF", label: { en: "ROAD CUT OFF", hi: "रास्ता कट गया" } },
          { value: "PEOPLE_BURIED", label: { en: "PEOPLE BURIED / TRAPPED", hi: "लोग दबे / फँसे हैं" } },
        ],
      },
      {
        id: "stillMoving",
        kind: "single",
        prompt: { en: "IS THE GROUND STILL MOVING?", hi: "क्या ज़मीन अभी भी खिसक रही है?" },
        options: YES_NO_UNSURE,
      },
      {
        id: "canMoveAway",
        kind: "single",
        prompt: { en: "CAN YOU MOVE AWAY FROM THE SLOPE?", hi: "क्या आप ढलान से दूर जा सकते हैं?" },
        options: YES_NO_UNSURE,
      },
    ],
    peoplePrompt: PEOPLE_DEFAULT,
    flags: ["CANNOT_MOVE", "CHILD", "ELDERLY", "MEDICAL_HELP"],
    suggestShelter: true,
  },

  MEDICAL: {
    type: "MEDICAL",
    questions: [
      {
        id: "subType",
        kind: "single",
        prompt: { en: "WHAT KIND OF MEDICAL EMERGENCY?", hi: "किस तरह की चिकित्सा आपात स्थिति?" },
        options: [
          { value: "BREATHING_DIFFICULTY", label: { en: "BREATHING DIFFICULTY", hi: "साँस लेने में कठिनाई" } },
          { value: "UNRESPONSIVE", label: { en: "UNRESPONSIVE / FAINTED", hi: "बेहोश / कोई प्रतिक्रिया नहीं" } },
          { value: "SEVERE_PAIN", label: { en: "SEVERE PAIN", hi: "तेज़ दर्द" } },
          { value: "SEIZURE", label: { en: "SEIZURE", hi: "दौरा (मिर्गी)" } },
          { value: "ALLERGIC_REACTION", label: { en: "ALLERGIC REACTION", hi: "एलर्जी की प्रतिक्रिया" } },
          { value: "OTHER_MEDICAL", label: { en: "OTHER MEDICAL ISSUE", hi: "अन्य चिकित्सा समस्या" } },
        ],
      },
      {
        id: "conscious",
        kind: "single",
        prompt: { en: "IS THE PERSON CONSCIOUS?", hi: "क्या व्यक्ति होश में है?" },
        options: YES_NO_UNSURE,
        showIf: (r) => r["subType"] !== "UNRESPONSIVE",
      },
      {
        id: "breathingNormally",
        kind: "single",
        prompt: { en: "IS THE PERSON BREATHING NORMALLY?", hi: "क्या व्यक्ति सामान्य रूप से साँस ले रहा है?" },
        options: YES_NO_UNSURE,
        showIf: (r) => r["subType"] === "UNRESPONSIVE",
      },
    ],
    peoplePrompt: PEOPLE_DEFAULT,
    flags: ["ELDERLY", "CHILD", "PREGNANT", "ACCESSIBILITY"],
    suggestShelter: false,
  },

  TRAPPED: {
    type: "TRAPPED",
    questions: [
      {
        id: "subType",
        kind: "single",
        prompt: { en: "WHERE ARE YOU TRAPPED?", hi: "आप कहाँ फँसे हैं?" },
        options: [
          { value: "BUILDING_DEBRIS", label: { en: "BUILDING / DEBRIS", hi: "इमारत / मलबा" } },
          { value: "VEHICLE", label: { en: "VEHICLE", hi: "वाहन" } },
          { value: "FLOODED_AREA", label: { en: "FLOODED AREA", hi: "पानी भरा क्षेत्र" } },
          { value: "LIFT_ENCLOSED", label: { en: "LIFT / ENCLOSED SPACE", hi: "लिफ़्ट / बंद जगह" } },
          { value: "OTHER", label: { en: "OTHER", hi: "अन्य" } },
        ],
      },
      {
        id: "canMove",
        kind: "single",
        prompt: { en: "CAN YOU MOVE?", hi: "क्या आप हिल-डुल सकते हैं?" },
        options: [
          { value: "YES", label: { en: "YES", hi: "हाँ" } },
          { value: "LIMITED", label: { en: "LIMITED", hi: "थोड़ा-बहुत" } },
          { value: "NO", label: { en: "NO", hi: "नहीं" } },
        ],
      },
      {
        id: "hazard",
        kind: "single",
        prompt: { en: "IS THERE AN IMMEDIATE HAZARD?", hi: "क्या कोई तत्काल खतरा है?" },
        options: [
          { value: "FIRE_SMOKE", label: { en: "FIRE / SMOKE", hi: "आग / धुआँ" } },
          { value: "RISING_WATER", label: { en: "RISING WATER", hi: "बढ़ता पानी" } },
          { value: "UNSTABLE_STRUCTURE", label: { en: "UNSTABLE STRUCTURE", hi: "अस्थिर ढाँचा" } },
          { value: "NONE_VISIBLE", label: { en: "NONE VISIBLE", hi: "कोई दिखाई नहीं देता" } },
          { value: "OTHER", label: { en: "OTHER", hi: "अन्य" } },
        ],
      },
    ],
    peoplePrompt: { en: "HOW MANY PEOPLE ARE TRAPPED?", hi: "कितने लोग फँसे हैं?" },
    flags: ["CHILD", "ELDERLY", "ACCESSIBILITY"],
    suggestShelter: false,
  },

  FLOOD: {
    type: "FLOOD",
    questions: [
      {
        id: "subType",
        kind: "single",
        prompt: { en: "WHAT IS YOUR SITUATION?", hi: "आपकी स्थिति क्या है?" },
        options: [
          { value: "WATER_ENTERING_BUILDING", label: { en: "WATER ENTERING BUILDING", hi: "इमारत में पानी घुस रहा है" } },
          { value: "STRANDED_OUTSIDE", label: { en: "STRANDED OUTSIDE", hi: "बाहर फँसे हैं" } },
          { value: "VEHICLE_STRANDED", label: { en: "VEHICLE STRANDED", hi: "वाहन फँसा है" } },
          { value: "ROUTE_CUT_OFF", label: { en: "ROUTE CUT OFF BY WATER", hi: "रास्ता पानी से कटा है" } },
          { value: "NEED_EVACUATION", label: { en: "NEED EVACUATION", hi: "निकासी चाहिए" } },
          { value: "OTHER", label: { en: "OTHER", hi: "अन्य" } },
        ],
      },
      {
        id: "waterRising",
        kind: "single",
        prompt: { en: "IS WATER STILL RISING?", hi: "क्या पानी अभी भी बढ़ रहा है?" },
        options: YES_NO_UNSURE,
      },
      {
        id: "higherGroundReachable",
        kind: "single",
        prompt: { en: "CAN YOU REACH HIGHER GROUND SAFELY?", hi: "क्या आप सुरक्षित रूप से ऊँचे स्थान पर पहुँच सकते हैं?" },
        options: YES_NO_UNSURE,
      },
    ],
    peoplePrompt: PEOPLE_DEFAULT,
    flags: ["CHILD", "ELDERLY", "ACCESSIBILITY"],
    suggestShelter: true,
  },

  FIRE: {
    type: "FIRE",
    questions: [
      {
        id: "subType",
        kind: "single",
        prompt: { en: "WHERE IS THE FIRE?", hi: "आग कहाँ लगी है?" },
        options: [
          { value: "INSIDE_BUILDING", label: { en: "INSIDE BUILDING", hi: "इमारत के अंदर" } },
          { value: "NEARBY_BUILDING", label: { en: "NEARBY BUILDING", hi: "पास की इमारत में" } },
          { value: "OUTDOOR_WILDFIRE", label: { en: "OUTDOOR / WILDFIRE", hi: "बाहर / जंगल की आग" } },
          { value: "VEHICLE", label: { en: "VEHICLE", hi: "वाहन" } },
          { value: "OTHER", label: { en: "OTHER", hi: "अन्य" } },
        ],
      },
      {
        id: "insideAffectedArea",
        kind: "single",
        prompt: { en: "ARE YOU CURRENTLY INSIDE THE AFFECTED AREA?", hi: "क्या आप अभी प्रभावित क्षेत्र के अंदर हैं?" },
        options: YES_NO,
      },
      {
        id: "safeExit",
        kind: "single",
        prompt: { en: "IS A SAFE EXIT AVAILABLE?", hi: "क्या सुरक्षित निकास उपलब्ध है?" },
        options: YES_NO_UNSURE,
      },
      {
        id: "heavySmoke",
        kind: "single",
        prompt: { en: "IS HEAVY SMOKE PRESENT?", hi: "क्या बहुत धुआँ है?" },
        options: YES_NO_UNSURE,
      },
    ],
    peoplePrompt: PEOPLE_DEFAULT,
    flags: ["CHILD", "ELDERLY", "ACCESSIBILITY"],
    suggestShelter: true,
  },

  INJURY: {
    type: "INJURY",
    questions: [
      {
        id: "subType",
        kind: "single",
        prompt: { en: "TYPE OF INJURY", hi: "चोट का प्रकार" },
        options: [
          { value: "FALL_IMPACT", label: { en: "FALL / IMPACT", hi: "गिरना / टक्कर" } },
          { value: "BURN", label: { en: "BURN", hi: "जलना" } },
          { value: "POSSIBLE_FRACTURE", label: { en: "POSSIBLE FRACTURE", hi: "हड्डी टूटने की आशंका" } },
          { value: "CUT_WOUND", label: { en: "CUT / WOUND", hi: "कटना / घाव" } },
          { value: "HEAD_INJURY", label: { en: "HEAD INJURY", hi: "सिर की चोट" } },
          { value: "OTHER", label: { en: "OTHER", hi: "अन्य" } },
        ],
      },
      {
        id: "canWalk",
        kind: "single",
        prompt: { en: "CAN THE PERSON WALK?", hi: "क्या व्यक्ति चल सकता है?" },
        options: [
          { value: "YES", label: { en: "YES", hi: "हाँ" } },
          { value: "WITH_DIFFICULTY", label: { en: "WITH DIFFICULTY", hi: "कठिनाई से" } },
          { value: "NO", label: { en: "NO", hi: "नहीं" } },
          { value: "UNSURE", label: { en: "UNSURE", hi: "पता नहीं" } },
        ],
      },
      {
        id: "heavyBleeding",
        kind: "single",
        prompt: { en: "IS THERE HEAVY BLEEDING?", hi: "क्या बहुत खून बह रहा है?" },
        options: YES_NO_UNSURE,
        showIf: (r) => r["subType"] === "CUT_WOUND",
      },
    ],
    peoplePrompt: PEOPLE_DEFAULT,
    flags: ["CHILD", "ELDERLY"],
    suggestShelter: false,
  },

  MISSING_PERSON: {
    type: "MISSING_PERSON",
    questions: [
      {
        id: "subType",
        kind: "single",
        prompt: { en: "WHO IS MISSING?", hi: "कौन लापता है?" },
        options: [
          { value: "CHILD", label: { en: "CHILD", hi: "बच्चा लापता है" } },
          { value: "ELDERLY", label: { en: "ELDERLY PERSON", hi: "बुज़ुर्ग व्यक्ति" } },
          { value: "ADULT", label: { en: "ADULT", hi: "वयस्क" } },
          { value: "PERSON_WITH_DISABILITY", label: { en: "PERSON WITH DISABILITY", hi: "दिव्यांग व्यक्ति" } },
          { value: "MULTIPLE", label: { en: "MULTIPLE PEOPLE", hi: "कई लोग" } },
        ],
      },
      {
        id: "lastSeen",
        kind: "single",
        prompt: { en: "WHEN WERE THEY LAST SEEN?", hi: "उन्हें आख़िरी बार कब देखा गया?" },
        options: [
          { value: "LT_15_MIN", label: { en: "LESS THAN 15 MIN AGO", hi: "15 मिनट से कम पहले" } },
          { value: "15_60_MIN", label: { en: "15–60 MIN AGO", hi: "15–60 मिनट पहले" } },
          { value: "1_3_HOURS", label: { en: "1–3 HOURS AGO", hi: "1–3 घंटे पहले" } },
          { value: "GT_3_HOURS", label: { en: "MORE THAN 3 HOURS AGO", hi: "3 घंटे से अधिक पहले" } },
          { value: "UNSURE", label: { en: "UNSURE", hi: "पता नहीं" } },
        ],
      },
      {
        id: "lastKnownLocation",
        kind: "text",
        prompt: { en: "LAST KNOWN LOCATION", hi: "अंतिम ज्ञात स्थान" },
        placeholder: { en: "Near Community Hall", hi: "सामुदायिक भवन के पास" },
        maxLength: 80,
      },
      {
        id: "lastDirection",
        kind: "single",
        prompt: { en: "LAST KNOWN DIRECTION", hi: "अंतिम ज्ञात दिशा" },
        options: [
          { value: "NORTH", label: { en: "NORTH", hi: "उत्तर" } },
          { value: "SOUTH", label: { en: "SOUTH", hi: "दक्षिण" } },
          { value: "EAST", label: { en: "EAST", hi: "पूर्व" } },
          { value: "WEST", label: { en: "WEST", hi: "पश्चिम" } },
          { value: "UNKNOWN", label: { en: "UNKNOWN", hi: "पता नहीं" } },
        ],
      },
      {
        id: "identifyingDetails",
        kind: "text",
        prompt: { en: "ADD IDENTIFYING DETAILS", hi: "पहचान का विवरण जोड़ें" },
        placeholder: { en: "Blue shirt, black backpack", hi: "नीली शर्ट, काला बैग" },
        maxLength: 120,
      },
    ],
    peoplePrompt: { en: "HOW MANY PEOPLE ARE MISSING?", hi: "कितने लोग लापता हैं?" },
    peopleIf: (r) => r["subType"] === "MULTIPLE",
    flags: ["MOBILITY_LIMITATION", "MEDICAL_DEPENDENCY"],
    suggestShelter: false,
  },

  OTHER: {
    type: "OTHER",
    questions: [
      {
        id: "subType",
        kind: "single",
        prompt: { en: "WHAT DO YOU NEED?", hi: "आपको क्या चाहिए?" },
        options: [
          { value: "EVACUATION", label: { en: "EVACUATION", hi: "निकासी" } },
          { value: "HAZARD_REPORT", label: { en: "HAZARD REPORT", hi: "खतरे की सूचना" } },
          { value: "PERSON_IN_DANGER", label: { en: "PERSON IN DANGER", hi: "व्यक्ति खतरे में" } },
          { value: "PROPERTY_DANGER", label: { en: "PROPERTY / STRUCTURE DANGER", hi: "संपत्ति / ढाँचे को खतरा" } },
          { value: "OTHER", label: { en: "OTHER", hi: "अन्य" } },
        ],
      },
      {
        id: "shortDescription",
        kind: "text",
        prompt: { en: "SHORT DESCRIPTION", hi: "संक्षिप्त विवरण" },
        placeholder: { en: "Example: gas leak near the market", hi: "उदाहरण: बाज़ार के पास गैस रिसाव" },
        maxLength: 160,
      },
    ],
    peoplePrompt: PEOPLE_DEFAULT,
    flags: ["CHILD", "ELDERLY", "ACCESSIBILITY"],
    suggestShelter: true,
  },
};

/** Questions that apply given the answers so far (in order). */
export function visibleQuestions(flow: EmergencyFlow, responses: SOSResponses): FlowQuestion[] {
  return flow.questions.filter((q) => !q.showIf || q.showIf(responses));
}

export function asksPeople(flow: EmergencyFlow, responses: SOSResponses): boolean {
  if (!flow.peoplePrompt) return false;
  return flow.peopleIf ? flow.peopleIf(responses) : true;
}

/** Human-readable label for a stored answer (falls back to the raw value for free text / unknown enums). */
export function answerLabel(type: EmergencyType, questionId: string, value: string, lang: "en" | "hi"): string {
  const q = FLOWS[type].questions.find((x) => x.id === questionId);
  const opt = q?.options?.find((o) => o.value === value);
  return opt ? opt.label[lang] : value;
}

export function questionLabel(type: EmergencyType, questionId: string, lang: "en" | "hi"): string {
  const q = FLOWS[type].questions.find((x) => x.id === questionId);
  return q ? q.prompt[lang] : questionId;
}

export function subTypeLabel(type: EmergencyType, subType: string | undefined, lang: "en" | "hi"): string | null {
  if (!subType) return null;
  return answerLabel(type, "subType", subType, lang);
}
