export interface AyurvedicDepartment {
  id: string;
  en: string;
  si: string;
  icon3d: string;
  gradient: string;
  bgTint: string;
  textColor: string;
  borderTint: string;
}

export const AYURVEDIC_MASTER_DEPARTMENTS: Record<string, AyurvedicDepartment> = {
  arishta: {
    id: 'arishta',
    en: 'Arishta & Asawa',
    si: 'අරිෂ්ට සහ ආසව',
    icon3d: 'bottle-elixir',
    gradient: 'from-amber-500 to-amber-700',
    bgTint: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderTint: 'border-amber-200',
  },
  taila: {
    id: 'taila',
    en: 'Medicinal Oils (Taila)',
    si: 'තෛල වර්ග',
    icon3d: 'oil-droplet',
    gradient: 'from-orange-500 to-amber-600',
    bgTint: 'bg-orange-50',
    textColor: 'text-orange-700',
    borderTint: 'border-orange-200',
  },
  churna: {
    id: 'churna',
    en: 'Churna & Powders',
    si: 'චූර්ණ සහ කුඩු',
    icon3d: 'mortar-pestle',
    gradient: 'from-emerald-500 to-teal-700',
    bgTint: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderTint: 'border-emerald-200',
  },
  guli: {
    id: 'guli',
    en: 'Guli, Vati & Tablets',
    si: 'ගුලි සහ වටි',
    icon3d: 'pills-capsule',
    gradient: 'from-indigo-500 to-blue-700',
    bgTint: 'bg-indigo-50',
    textColor: 'text-indigo-700',
    borderTint: 'border-indigo-200',
  },
  rasayana: {
    id: 'rasayana',
    en: 'Rasayana, Kalka & Leha',
    si: 'රසායන සහ ලේහ',
    icon3d: 'honey-jar',
    gradient: 'from-rose-500 to-purple-700',
    bgTint: 'bg-purple-50',
    textColor: 'text-purple-700',
    borderTint: 'border-purple-200',
  },
  kasaya: {
    id: 'kasaya',
    en: 'Kwatha & Decoctions',
    si: 'කසාය සහ ක්වාථ',
    icon3d: 'cauldron-leaf',
    gradient: 'from-amber-600 to-yellow-700',
    bgTint: 'bg-yellow-50',
    textColor: 'text-yellow-700',
    borderTint: 'border-yellow-200',
  },
  raw_herbs: {
    id: 'raw_herbs',
    en: 'Raw & Dry Herbs',
    si: 'අමු සහ වියළි ඖෂධ',
    icon3d: 'botanical-leaf',
    gradient: 'from-green-500 to-emerald-700',
    bgTint: 'bg-green-50',
    textColor: 'text-green-700',
    borderTint: 'border-green-200',
  },
  balms: {
    id: 'balms',
    en: 'Balms & Ointments',
    si: 'ආලේපන සහ පැලැස්තර',
    icon3d: 'balm-tub',
    gradient: 'from-pink-500 to-rose-600',
    bgTint: 'bg-rose-50',
    textColor: 'text-rose-700',
    borderTint: 'border-rose-200',
  },
  skincare: {
    id: 'skincare',
    en: 'Herbal Skincare & Soaps',
    si: 'ස්වාභාවික රූපලාවණ්ය',
    icon3d: 'soap-sparkles',
    gradient: 'from-cyan-500 to-blue-600',
    bgTint: 'bg-cyan-50',
    textColor: 'text-cyan-700',
    borderTint: 'border-cyan-200',
  },
  fmcg: {
    id: 'fmcg',
    en: 'General Healthcare & FMCG',
    si: 'සාමාන්ය ෆාමසි භාණ්ඩ',
    icon3d: 'cross-box',
    gradient: 'from-violet-500 to-slate-700',
    bgTint: 'bg-slate-50',
    textColor: 'text-slate-700',
    borderTint: 'border-slate-200',
  },
};

export const AYURVEDIC_DEPARTMENT_LIST = Object.values(AYURVEDIC_MASTER_DEPARTMENTS);

export function classifyAyurvedicDepartment(
  productName: string,
  categoryName?: string,
  categorySlug?: string,
): string {
  const p = (productName || '').toLowerCase();
  const c = ((categoryName || '') + ' ' + (categorySlug || '')).toLowerCase();

  // 1. Arishta & Asawa
  if (
    p.includes('arishta') ||
    p.includes('arisht') ||
    p.includes('asawa') ||
    p.includes('asava') ||
    p.includes('spirit') ||
    c.includes('arishta') ||
    c.includes('asawa')
  ) {
    return 'arishta';
  }

  // 2. Medicinal Oils (Taila)
  if (
    p.includes('taila') ||
    p.includes('thaila') ||
    p.includes('oil') ||
    p.includes('thel') ||
    p.includes('beheth thel') ||
    c.includes('taila') ||
    c.includes('oil')
  ) {
    return 'taila';
  }

  // 3. Churna & Powders
  if (
    p.includes('churna') ||
    p.includes('churnaya') ||
    p.includes('powder') ||
    p.includes('piti') ||
    c.includes('churna') ||
    c.includes('powder')
  ) {
    return 'churna';
  }

  // 4. Guli, Vati & Tablets
  if (
    p.includes('guli') ||
    p.includes('wati') ||
    p.includes('vati') ||
    p.includes('tablet') ||
    p.includes('capsule') ||
    p.includes('pethi') ||
    c.includes('guli') ||
    c.includes('wati') ||
    c.includes('vati')
  ) {
    return 'guli';
  }

  // 5. Rasayana, Kalka & Leha
  if (
    p.includes('rasayana') ||
    p.includes('kalka') ||
    p.includes('leha') ||
    p.includes('pakaya') ||
    p.includes('avaleha') ||
    c.includes('rasayana') ||
    c.includes('kalka') ||
    c.includes('leha')
  ) {
    return 'rasayana';
  }

  // 6. Kwatha & Decoctions (Kasaya)
  if (
    p.includes('kasaya') ||
    p.includes('kwatha') ||
    p.includes('quatha') ||
    p.includes('decoction') ||
    c.includes('kasaya') ||
    c.includes('kwatha')
  ) {
    return 'kasaya';
  }

  // 7. Balms & Ointments
  if (
    p.includes('balm') ||
    p.includes('ointment') ||
    p.includes('pasthara') ||
    p.includes('plaster') ||
    c.includes('balm')
  ) {
    return 'balms';
  }

  // 8. Herbal Skincare & Soaps
  if (
    p.includes('soap') ||
    p.includes('face') ||
    p.includes('wash') ||
    p.includes('shampoo') ||
    p.includes('skin') ||
    p.includes('lotion') ||
    p.includes('scrub') ||
    p.includes('cream') ||
    c.includes('soap') ||
    c.includes('cream') ||
    c.includes('skin')
  ) {
    return 'skincare';
  }

  // 9. Raw & Dry Herbs
  if (
    p.includes('mul') ||
    p.includes('kole') ||
    p.includes('pothu') ||
    p.includes('atta') ||
    p.includes('ata') ||
    p.includes('seeds') ||
    p.includes('bark') ||
    p.includes('dry') ||
    p.includes('herbal') ||
    c.includes('dry') ||
    c.includes('amu') ||
    c.includes('ala') ||
    c.includes('aba')
  ) {
    return 'raw_herbs';
  }

  // 10. General Healthcare & FMCG (Default)
  return 'fmcg';
}

