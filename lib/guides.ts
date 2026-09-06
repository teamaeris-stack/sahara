import {
  Activity,
  AlertTriangle,
  ArrowUp,
  Ban,
  BatteryMedium,
  Bandage,
  Building2,
  CheckCircle2,
  CircleAlert,
  DoorOpen,
  Droplets,
  Eye,
  Flame,
  Footprints,
  Hand,
  HeartPulse,
  Home,
  MapPin,
  Mountain,
  Package,
  Radio,
  Route,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Thermometer,
  Tornado,
  UserRound,
  Waves,
  Wind,
  type LucideIcon,
} from "lucide-react";
import type { L, Lang } from "./i18n";

/** Optional in-step action that reuses existing Sahara features. */
export type GuideAction = "SEND_SOS" | "IM_SAFE" | "FIND_SHELTER";

export interface GuidanceStep {
  title: L;
  description: L;
  icon: LucideIcon;
  action?: GuideAction;
  /**
   * Optional bundled audio per language (Level 1). Files live under /public/audio/<lang>/…
   * A missing file is not an error: playback falls back to speech synthesis (Level 2).
   */
  audioSrc?: Partial<Record<Lang, string>>;
}

export interface EmergencyGuide {
  id: string;
  title: L;
  description: L;
  icon: LucideIcon;
  steps: GuidanceStep[];
  /** Sub-guides (used by FIRST AID). When present, `steps` may be empty. */
  subGuides?: EmergencyGuide[];
  note?: L;
}

/** Natural-disaster guides first. Tsunami is kept but de-emphasised for the inland demo region. */
export const LOW_PROMINENCE_GUIDES = new Set(["tsunami"]);

export const LAST_GUIDE_KEY = "resq_last_guide_category";

export const FIRST_AID_NOTE: L = {
  en: "Sahara provides basic emergency guidance only. Seek trained medical help when available.",
  hi: "Sahara केवल बुनियादी आपातकालीन मार्गदर्शन देता है। उपलब्ध होते ही प्रशिक्षित चिकित्सा सहायता लें।",
};

const FIRST_AID_SUBGUIDES: EmergencyGuide[] = [
  {
    id: "bleeding",
    title: { en: "BLEEDING", hi: "खून बहना" },
    description: { en: "Heavy or ongoing bleeding.", hi: "तेज़ या लगातार खून बहना।" },
    icon: Droplets,
    steps: [
      {
        title: { en: "PRESS FIRMLY ON THE WOUND", hi: "घाव पर ज़ोर से दबाएँ" },
        description: { en: "Use a clean cloth and keep steady pressure on the bleeding area.", hi: "साफ़ कपड़े से घाव पर लगातार दबाव बनाए रखें।" },
        icon: Hand,
      },
      {
        title: { en: "KEEP PRESSING", hi: "दबाव बनाए रखें" },
        description: { en: "Do not lift the cloth to check. Add more cloth on top if needed.", hi: "जाँचने के लिए कपड़ा न हटाएँ। ज़रूरत हो तो ऊपर और कपड़ा रखें।" },
        icon: Bandage,
      },
      {
        title: { en: "KEEP THE PERSON STILL AND CALM", hi: "व्यक्ति को स्थिर और शांत रखें" },
        description: { en: "Help them sit or lie down while you keep pressure.", hi: "दबाव बनाए रखते हुए उन्हें बैठने या लेटने में मदद करें।" },
        icon: UserRound,
      },
      {
        title: { en: "GET TRAINED HELP", hi: "प्रशिक्षित मदद लें" },
        description: { en: "Use Sahara SOS if help is required and no one nearby can assist.", hi: "यदि मदद चाहिए और पास में कोई सहायता न कर सके, तो Sahara SOS भेजें।" },
        icon: Siren,
        action: "SEND_SOS",
      },
    ],
  },
  {
    id: "burns",
    title: { en: "BURNS", hi: "जलना" },
    description: { en: "Heat, fire or hot liquid burns.", hi: "गर्मी, आग या गर्म तरल से जलना।" },
    icon: Thermometer,
    steps: [
      {
        title: { en: "MOVE AWAY FROM THE HEAT SOURCE", hi: "गर्मी के स्रोत से दूर हटें" },
        description: { en: "Make sure the person and you are no longer in danger.", hi: "सुनिश्चित करें कि आप और वह व्यक्ति अब खतरे में नहीं हैं।" },
        icon: Flame,
      },
      {
        title: { en: "COOL WITH CLEAN WATER", hi: "साफ़ पानी से ठंडा करें" },
        description: { en: "Run cool, not ice-cold, water over the burn if clean water is available.", hi: "साफ़ पानी हो तो जले हिस्से पर ठंडा (बर्फ़ जैसा नहीं) पानी डालें।" },
        icon: Droplets,
      },
      {
        title: { en: "COVER LOOSELY", hi: "ढीला ढकें" },
        description: { en: "Use a clean, dry cloth. Do not apply creams, oil or ice.", hi: "साफ़, सूखा कपड़ा उपयोग करें। क्रीम, तेल या बर्फ़ न लगाएँ।" },
        icon: Bandage,
      },
      {
        title: { en: "SEEK TRAINED HELP FOR LARGE BURNS", hi: "बड़े जलने पर प्रशिक्षित मदद लें" },
        description: { en: "Use Sahara SOS if the burn is large or the person is in severe pain.", hi: "यदि जलन बड़ी है या तेज़ दर्द है, तो Sahara SOS भेजें।" },
        icon: Siren,
        action: "SEND_SOS",
      },
    ],
  },
  {
    id: "unresponsive",
    title: { en: "FAINTING / UNRESPONSIVE", hi: "बेहोशी / कोई प्रतिक्रिया नहीं" },
    description: { en: "Person has fainted or does not respond.", hi: "व्यक्ति बेहोश है या जवाब नहीं दे रहा।" },
    icon: HeartPulse,
    steps: [
      {
        title: { en: "CHECK FOR A RESPONSE", hi: "प्रतिक्रिया जाँचें" },
        description: { en: "Speak loudly and gently tap the shoulders.", hi: "ज़ोर से बोलें और कंधों को हल्के से थपथपाएँ।" },
        icon: Eye,
      },
      {
        title: { en: "CHECK BREATHING", hi: "साँस जाँचें" },
        description: { en: "Look for chest movement. Keep the person on their side if they are breathing.", hi: "छाती की हलचल देखें। साँस चल रही हो तो व्यक्ति को करवट पर रखें।" },
        icon: Activity,
      },
      {
        title: { en: "DO NOT GIVE FOOD OR DRINK", hi: "खाना या पानी न दें" },
        description: { en: "Keep the person still and stay with them.", hi: "व्यक्ति को स्थिर रखें और उनके साथ रहें।" },
        icon: Ban,
      },
      {
        title: { en: "REQUEST HELP NOW", hi: "अभी मदद माँगें" },
        description: { en: "Use Sahara SOS immediately if the person does not wake or is not breathing normally.", hi: "यदि व्यक्ति होश में न आए या सामान्य साँस न ले, तो तुरंत Sahara SOS भेजें।" },
        icon: Siren,
        action: "SEND_SOS",
      },
    ],
  },
  {
    id: "minor-injury",
    title: { en: "MINOR INJURY", hi: "छोटी चोट" },
    description: { en: "Small cuts, scrapes or bruises.", hi: "छोटे कट, खरोंच या नील।" },
    icon: Bandage,
    steps: [
      {
        title: { en: "CLEAN THE AREA", hi: "जगह साफ़ करें" },
        description: { en: "Rinse with clean water if available.", hi: "साफ़ पानी उपलब्ध हो तो धो लें।" },
        icon: Droplets,
      },
      {
        title: { en: "COVER THE WOUND", hi: "घाव ढकें" },
        description: { en: "Use a clean cloth or bandage.", hi: "साफ़ कपड़ा या पट्टी उपयोग करें।" },
        icon: Bandage,
      },
      {
        title: { en: "REST AND WATCH FOR CHANGES", hi: "आराम करें और बदलाव पर नज़र रखें" },
        description: { en: "Seek trained help if pain, swelling or bleeding gets worse.", hi: "दर्द, सूजन या खून बढ़े तो प्रशिक्षित मदद लें।" },
        icon: Eye,
      },
    ],
  },
];

export const GUIDES: EmergencyGuide[] = [
  {
    id: "earthquake",
    title: { en: "EARTHQUAKE", hi: "भूकंप" },
    description: { en: "Ground shaking or aftershocks.", hi: "ज़मीन का हिलना या झटके।" },
    icon: Mountain,
    steps: [
      {
        title: { en: "DROP, COVER AND HOLD", hi: "झुकें, ढकें और पकड़ें" },
        description: { en: "Protect your head and stay away from windows and objects that may fall.", hi: "सिर की रक्षा करें और खिड़कियों व गिरने वाली चीज़ों से दूर रहें।" },
        icon: ShieldAlert,
        audioSrc: { hi: "/audio/hi/earthquake-1.mp3" },
      },
      {
        title: { en: "WAIT FOR STRONG SHAKING TO STOP", hi: "तेज़ झटके रुकने तक रुकें" },
        description: { en: "Do not rush through damaged exits during strong shaking.", hi: "तेज़ झटकों के दौरान क्षतिग्रस्त निकास से न भागें।" },
        icon: Hand,
        audioSrc: { hi: "/audio/hi/earthquake-2.mp3" },
      },
      {
        title: { en: "MOVE TO A SAFER OPEN AREA WHEN POSSIBLE", hi: "संभव हो तो खुले सुरक्षित स्थान पर जाएँ" },
        description: { en: "Stay clear of visibly damaged structures and falling hazards.", hi: "क्षतिग्रस्त इमारतों और गिरने वाली चीज़ों से दूर रहें।" },
        icon: Footprints,
      },
      {
        title: { en: "CHECK FOR INJURIES AND HAZARDS", hi: "चोट और खतरों की जाँच करें" },
        description: { en: "Use Sahara SOS if help is required.", hi: "मदद चाहिए तो Sahara SOS भेजें।" },
        icon: CircleAlert,
        action: "SEND_SOS",
      },
    ],
  },
  {
    id: "flood",
    title: { en: "FLOOD", hi: "बाढ़" },
    description: { en: "Rising or moving water.", hi: "बढ़ता या बहता पानी।" },
    icon: Waves,
    steps: [
      {
        title: { en: "MOVE TO HIGHER GROUND", hi: "ऊँचे स्थान पर जाएँ" },
        description: { en: "Move away from low-lying areas if it is safe to do so.", hi: "यदि सुरक्षित हो, तो निचले और पानी भरने वाले क्षेत्रों से दूर होकर ऊँचे स्थान पर जाएँ।" },
        icon: ArrowUp,
        audioSrc: { hi: "/audio/hi/flood-1.mp3" },
      },
      {
        title: { en: "AVOID FLOOD WATER", hi: "बाढ़ के पानी में न जाएँ" },
        description: { en: "Do not walk or drive through moving flood water.", hi: "तेज़ बहते या गहरे पानी में पैदल या वाहन से प्रवेश न करें।" },
        icon: Ban,
        audioSrc: { hi: "/audio/hi/flood-2.mp3" },
      },
      {
        title: { en: "USE VERIFIED SAFE ROUTES", hi: "सुरक्षित मार्ग का उपयोग करें" },
        description: { en: "Avoid roads marked flooded, blocked or unsafe.", hi: "बंद, डूबे हुए या असुरक्षित रास्तों से बचें।" },
        icon: Route,
        action: "FIND_SHELTER",
      },
      {
        title: { en: "WAIT FOR VERIFIED INSTRUCTIONS", hi: "विश्वसनीय निर्देशों का पालन करें" },
        description: { en: "Use Sahara cached information or official instructions when they become available.", hi: "Sahara में उपलब्ध ऑफ़लाइन जानकारी और सत्यापित निर्देशों का उपयोग करें।" },
        icon: Radio,
      },
    ],
  },
  {
    id: "cyclone",
    title: { en: "CYCLONE / SEVERE STORM", hi: "चक्रवात / तेज़ तूफ़ान" },
    description: { en: "High winds and heavy rain.", hi: "तेज़ हवाएँ और भारी बारिश।" },
    icon: Tornado,
    steps: [
      {
        title: { en: "MOVE TO A SECURE SHELTER", hi: "मज़बूत आश्रय में जाएँ" },
        description: { en: "Prefer a strong indoor shelter away from exposed areas.", hi: "खुले क्षेत्रों से दूर, मज़बूत इनडोर आश्रय चुनें।" },
        icon: Home,
        audioSrc: { hi: "/audio/hi/cyclone-1.mp3" },
        action: "FIND_SHELTER",
      },
      {
        title: { en: "STAY AWAY FROM WINDOWS", hi: "खिड़कियों से दूर रहें" },
        description: { en: "Keep distance from glass and unsecured objects.", hi: "काँच और ढीली चीज़ों से दूरी रखें।" },
        icon: ShieldAlert,
      },
      {
        title: { en: "AVOID FLOODED OR EXPOSED ROUTES", hi: "पानी भरे या खुले रास्तों से बचें" },
        description: { en: "Do not travel through dangerous water or debris.", hi: "खतरनाक पानी या मलबे से होकर न जाएँ।" },
        icon: Wind,
      },
      {
        title: { en: "FOLLOW LOCAL SAFETY INFORMATION", hi: "स्थानीय सुरक्षा जानकारी का पालन करें" },
        description: { en: "Use cached Sahara shelter information when available.", hi: "उपलब्ध होने पर Sahara की सहेजी गई आश्रय जानकारी का उपयोग करें।" },
        icon: Radio,
      },
    ],
  },
  {
    id: "landslide",
    title: { en: "LANDSLIDE", hi: "भूस्खलन" },
    description: { en: "Moving soil, rocks or debris.", hi: "खिसकती मिट्टी, पत्थर या मलबा।" },
    icon: Mountain,
    steps: [
      {
        title: { en: "MOVE AWAY FROM THE SLOPE", hi: "ढलान से दूर हटें" },
        description: { en: "Get out of the path of moving soil or debris. Move sideways, not downhill.", hi: "खिसकती मिट्टी या मलबे के रास्ते से हटें। नीचे नहीं, बगल की ओर जाएँ।" },
        icon: Footprints,
      },
      {
        title: { en: "WATCH FOR WARNING SIGNS", hi: "चेतावनी संकेतों पर ध्यान दें" },
        description: { en: "Cracking sounds, tilting trees or sudden water flow mean more movement may follow.", hi: "चटकने की आवाज़, झुकते पेड़ या अचानक पानी बहना — और खिसकाव हो सकता है।" },
        icon: Eye,
      },
      {
        title: { en: "AVOID BLOCKED ROADS", hi: "बंद सड़कों से बचें" },
        description: { en: "Do not cross debris on roads. Use a cached safe route to a shelter.", hi: "सड़क पर मलबे को पार न करें। आश्रय तक सहेजे गए सुरक्षित मार्ग का उपयोग करें।" },
        icon: Route,
        action: "FIND_SHELTER",
      },
      {
        title: { en: "REPORT PEOPLE TRAPPED", hi: "फँसे लोगों की सूचना दें" },
        description: { en: "Do not dig alone. Send an SOS so responders can locate the site.", hi: "अकेले खुदाई न करें। SOS भेजें ताकि बचावकर्मी जगह ढूँढ सकें।" },
        icon: Siren,
        action: "SEND_SOS",
      },
    ],
  },
  {
    id: "tsunami",
    title: { en: "TSUNAMI / COASTAL FLOOD", hi: "सुनामी / तटीय बाढ़" },
    description: { en: "Coastal areas only.", hi: "केवल तटीय क्षेत्रों के लिए।" },
    icon: Waves,
    steps: [
      {
        title: { en: "MOVE INLAND AND UPHILL NOW", hi: "तुरंत अंदर और ऊँचाई की ओर जाएँ" },
        description: { en: "Do not wait for an official warning if the ground shook or the sea pulls back.", hi: "यदि ज़मीन हिली या समुद्र पीछे हटा, तो आधिकारिक चेतावनी का इंतज़ार न करें।" },
        icon: ArrowUp,
      },
      {
        title: { en: "GO ON FOOT IF ROADS ARE JAMMED", hi: "सड़कें जाम हों तो पैदल जाएँ" },
        description: { en: "Head for high ground or a strong upper floor.", hi: "ऊँचे स्थान या मज़बूत ऊपरी मंज़िल की ओर बढ़ें।" },
        icon: Footprints,
        action: "FIND_SHELTER",
      },
      {
        title: { en: "STAY AWAY UNTIL CLEARED", hi: "अनुमति मिलने तक दूर रहें" },
        description: { en: "Several waves can arrive over hours. Do not return to the coast early.", hi: "कई घंटों तक कई लहरें आ सकती हैं। जल्दी तट पर न लौटें।" },
        icon: Ban,
      },
      {
        title: { en: "UPDATE YOUR STATUS", hi: "अपनी स्थिति अपडेट करें" },
        description: { en: "Tell Sahara you are safe once you reach high ground.", hi: "ऊँचे स्थान पर पहुँचते ही Sahara को बताएँ कि आप सुरक्षित हैं।" },
        icon: CheckCircle2,
        action: "IM_SAFE",
      },
    ],
  },
  {
    id: "fire",
    title: { en: "FIRE", hi: "आग" },
    description: { en: "Smoke or flames nearby.", hi: "पास में धुआँ या लपटें।" },
    icon: Flame,
    steps: [
      {
        title: { en: "MOVE AWAY FROM SMOKE AND FLAMES", hi: "धुएँ और लपटों से दूर हटें" },
        description: { en: "Use the nearest safe exit if one is available.", hi: "उपलब्ध हो तो निकटतम सुरक्षित निकास का उपयोग करें।" },
        icon: DoorOpen,
      },
      {
        title: { en: "DO NOT USE AN UNSAFE ROUTE", hi: "असुरक्षित रास्ता न लें" },
        description: { en: "If an exit is blocked by fire or heavy smoke, choose another safe route.", hi: "यदि निकास आग या घने धुएँ से बंद है, तो दूसरा सुरक्षित रास्ता चुनें।" },
        icon: Ban,
      },
      {
        title: { en: "MOVE TO A SAFE ASSEMBLY AREA", hi: "सुरक्षित एकत्रीकरण स्थल पर जाएँ" },
        description: { en: "Stay clear of the affected structure.", hi: "प्रभावित इमारत से दूर रहें।" },
        icon: Building2,
        action: "FIND_SHELTER",
      },
      {
        title: { en: "REQUEST HELP IF NEEDED", hi: "ज़रूरत हो तो मदद माँगें" },
        description: { en: "Use Sahara SOS if you cannot evacuate safely.", hi: "यदि आप सुरक्षित बाहर नहीं निकल सकते, तो Sahara SOS भेजें।" },
        icon: Siren,
        action: "SEND_SOS",
      },
    ],
  },
  {
    id: "first-aid",
    title: { en: "FIRST AID", hi: "प्राथमिक उपचार" },
    description: { en: "Basic help for injuries.", hi: "चोटों के लिए बुनियादी मदद।" },
    icon: HeartPulse,
    steps: [],
    subGuides: FIRST_AID_SUBGUIDES,
    note: FIRST_AID_NOTE,
  },
  {
    id: "trapped",
    title: { en: "TRAPPED / CANNOT EVACUATE", hi: "फँसे हुए / निकल नहीं सकते" },
    description: { en: "You cannot leave safely.", hi: "आप सुरक्षित बाहर नहीं निकल सकते।" },
    icon: DoorOpen,
    steps: [
      {
        title: { en: "MOVE AWAY FROM IMMEDIATE HAZARDS IF POSSIBLE", hi: "संभव हो तो तत्काल खतरों से दूर हटें" },
        description: { en: "Stay clear of fire, water, gas smells or unstable debris.", hi: "आग, पानी, गैस की गंध या अस्थिर मलबे से दूर रहें।" },
        icon: AlertTriangle,
      },
      {
        title: { en: "SAVE YOUR LOCATION", hi: "अपना स्थान सहेजें" },
        description: { en: "Sahara can attach your last known location to an SOS.", hi: "Sahara आपका अंतिम ज्ञात स्थान SOS के साथ जोड़ सकता है।" },
        icon: MapPin,
      },
      {
        title: { en: "SEND AN SOS", hi: "SOS भेजें" },
        description: { en: "Tell Sahara what is happening so responders can find you.", hi: "Sahara को बताएँ क्या हो रहा है ताकि बचावकर्मी आपको ढूँढ सकें।" },
        icon: Siren,
        action: "SEND_SOS",
      },
      {
        title: { en: "CONSERVE PHONE BATTERY", hi: "फ़ोन की बैटरी बचाएँ" },
        description: { en: "Keep Sahara available for status updates and emergency communication.", hi: "स्थिति अपडेट और आपातकालीन संपर्क के लिए Sahara को चालू रखें।" },
        icon: BatteryMedium,
      },
    ],
  },
  {
    id: "evacuation",
    title: { en: "EVACUATION", hi: "निकासी" },
    description: { en: "Leaving the danger area.", hi: "खतरे वाले क्षेत्र से निकलना।" },
    icon: AlertTriangle,
    steps: [
      {
        title: { en: "TAKE ESSENTIAL ITEMS ONLY", hi: "केवल ज़रूरी सामान लें" },
        description: { en: "Prioritize people, emergency medication and critical documents if immediately available.", hi: "लोगों, ज़रूरी दवाओं और महत्वपूर्ण दस्तावेज़ों को प्राथमिकता दें।" },
        icon: Package,
      },
      {
        title: { en: "CHECK YOUR ROUTE", hi: "अपना रास्ता जाँचें" },
        description: { en: "Avoid visibly unsafe roads and hazards.", hi: "स्पष्ट रूप से असुरक्षित सड़कों और खतरों से बचें।" },
        icon: Route,
      },
      {
        title: { en: "MOVE TOWARD A VERIFIED SAFE PLACE", hi: "सत्यापित सुरक्षित स्थान की ओर बढ़ें" },
        description: { en: "Stay with your group and keep moving away from the hazard.", hi: "अपने समूह के साथ रहें और खतरे से दूर बढ़ते रहें।" },
        icon: ShieldCheck,
        action: "FIND_SHELTER",
      },
      {
        title: { en: "UPDATE YOUR STATUS", hi: "अपनी स्थिति अपडेट करें" },
        description: { en: "Let Sahara know you are safe once you reach a safe place.", hi: "सुरक्षित स्थान पर पहुँचते ही Sahara को बताएँ कि आप सुरक्षित हैं।" },
        icon: CheckCircle2,
        action: "IM_SAFE",
      },
    ],
  },
];

export function findGuide(id: string | null): EmergencyGuide | null {
  if (!id) return null;
  for (const g of GUIDES) {
    if (g.id === id) return g;
    const sub = g.subGuides?.find((s) => s.id === id);
    if (sub) return sub;
  }
  return null;
}
