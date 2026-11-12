import { classifyAyurvedicDepartment } from './ayurvedic-departments';

export interface ProductLike {
  name: string;
  category?: { name?: string; slug?: string } | string;
  imageUrl?: string;
  departmentId?: string;
}

export const DEFAULT_STUDIO_PHOTO =
  'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&auto=format&fit=crop&q=80';

/**
 * Authentic, high-definition studio photography mapped dynamically by
 * Ayurvedic category and product name (all tested & verified HTTP 200).
 */
export const CATEGORY_STUDIO_PHOTOS: Record<string, string> = {
  // Arishta & Asawa: Amber medicine bottles
  arishta: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&auto=format&fit=crop&q=80',
  // Taila: Amber oil dropper bottle
  taila: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=300&auto=format&fit=crop&q=80',
  // Churna: Authentic herbal powder bowl with wooden spoon (never broccoli!)
  churna: 'https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=300&auto=format&fit=crop&q=80',
  // Guli, Vati & Tablets: Herbal capsules and pills
  guli: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=300&auto=format&fit=crop&q=80',
  // Rasayana & Kalka: Amber jar with golden herbal paste/honey
  rasayana: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=300&auto=format&fit=crop&q=80',
  // Kasaya & Decoctions: Warm botanical herbal brew
  kasaya: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=300&auto=format&fit=crop&q=80',
  // Raw & Dry Herbs: Cinnamon bark, roots and dried spices
  raw_herbs: 'https://images.unsplash.com/photo-1509358271058-acd22cc93898?w=300&auto=format&fit=crop&q=80',
  // Balms & Ointments: Clean balm tub
  balms: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=300&auto=format&fit=crop&q=80',
  // Herbal Skincare: Natural cosmetic lotion pump bottle
  skincare: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=300&auto=format&fit=crop&q=80',
  // Hair Care & Dyes: Cosmetic shampoo / hair bottle
  hair_care: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=300&auto=format&fit=crop&q=80',
  // Beverages: Herbal teas & wellness drinks
  beverages: 'https://images.unsplash.com/photo-1556881286-fc6915169721?w=300&auto=format&fit=crop&q=80',
  // General Pharmacy: Clean apothecary bottle
  general: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&auto=format&fit=crop&q=80',
  // FMCG: Healthcare packaging
  fmcg: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=300&auto=format&fit=crop&q=80',
};

/**
 * Returns a high-definition realistic studio photograph for any product,
 * mapped dynamically by its custom image or its authentic Ayurvedic category.
 */
export function getProductPhoto(product: ProductLike): string {
  if (product.imageUrl && product.imageUrl.trim() !== '') {
    return product.imageUrl;
  }

  const name = (product.name || '').toLowerCase();
  const categoryStr = (
    typeof product.category === 'object'
      ? (product.category?.name || '') + ' ' + (product.category?.slug || '')
      : product.category || ''
  ).toLowerCase();

  // 1. Hair Care / Hair Colour / Henna / Dye / Shampoo / Conditioner
  // Ensures hair colour powders are mapped to cosmetics rather than food/spices!
  if (
    name.includes('hair') ||
    name.includes('colour') ||
    name.includes('color') ||
    name.includes('dye') ||
    name.includes('henna') ||
    name.includes('mehendi') ||
    name.includes('shampoo') ||
    name.includes('conditioner') ||
    categoryStr.includes('hair')
  ) {
    return CATEGORY_STUDIO_PHOTOS.hair_care ?? DEFAULT_STUDIO_PHOTO;
  }

  // 2. Drinks / Teas / Coffee / Beverage / Milk
  if (
    name.includes('tea') ||
    name.includes('coffee') ||
    name.includes('drink') ||
    name.includes('beverage') ||
    name.includes('milk') ||
    name.includes('juice') ||
    name.includes('elixir') ||
    categoryStr.includes('drink') ||
    categoryStr.includes('beverage') ||
    categoryStr.includes('tea')
  ) {
    return CATEGORY_STUDIO_PHOTOS.beverages ?? DEFAULT_STUDIO_PHOTO;
  }

  // 3. Skincare / Creams / Lotions / Soaps / Face Wash
  if (
    name.includes('soap') ||
    name.includes('cream') ||
    name.includes('lotion') ||
    name.includes('face') ||
    name.includes('wash') ||
    name.includes('scrub') ||
    name.includes('skin') ||
    categoryStr.includes('soap') ||
    categoryStr.includes('skin') ||
    categoryStr.includes('cosmetic')
  ) {
    return CATEGORY_STUDIO_PHOTOS.skincare ?? DEFAULT_STUDIO_PHOTO;
  }

  // 4. Balms & Ointments
  if (
    name.includes('balm') ||
    name.includes('ointment') ||
    name.includes('pasthara') ||
    name.includes('plaster') ||
    name.includes('liniment') ||
    categoryStr.includes('balm')
  ) {
    return CATEGORY_STUDIO_PHOTOS.balms ?? DEFAULT_STUDIO_PHOTO;
  }

  // 5. Oils (Taila)
  if (
    name.includes('taila') ||
    name.includes('thaila') ||
    name.includes('oil') ||
    name.includes('thel') ||
    categoryStr.includes('taila') ||
    categoryStr.includes('oil')
  ) {
    return CATEGORY_STUDIO_PHOTOS.taila ?? DEFAULT_STUDIO_PHOTO;
  }

  // 6. Arishta & Asawa
  if (
    name.includes('arishta') ||
    name.includes('arisht') ||
    name.includes('asawa') ||
    name.includes('asava') ||
    categoryStr.includes('arishta') ||
    categoryStr.includes('asawa')
  ) {
    return CATEGORY_STUDIO_PHOTOS.arishta ?? DEFAULT_STUDIO_PHOTO;
  }

  // 7. Tablets, Guli, Vati & Capsules
  if (
    name.includes('guli') ||
    name.includes('vati') ||
    name.includes('wati') ||
    name.includes('tablet') ||
    name.includes('capsule') ||
    name.includes('pethi') ||
    categoryStr.includes('guli') ||
    categoryStr.includes('vati')
  ) {
    return CATEGORY_STUDIO_PHOTOS.guli ?? DEFAULT_STUDIO_PHOTO;
  }

  // 8. Rasayana, Kalka & Leha
  if (
    name.includes('rasayana') ||
    name.includes('kalka') ||
    name.includes('leha') ||
    name.includes('pakaya') ||
    name.includes('avaleha') ||
    categoryStr.includes('rasayana') ||
    categoryStr.includes('kalka')
  ) {
    return CATEGORY_STUDIO_PHOTOS.rasayana ?? DEFAULT_STUDIO_PHOTO;
  }

  // 9. Kasaya & Decoctions
  if (
    name.includes('kasaya') ||
    name.includes('kwatha') ||
    name.includes('quatha') ||
    name.includes('decoction') ||
    name.includes('panguwa') ||
    name.includes('peyawa') ||
    categoryStr.includes('kasaya') ||
    categoryStr.includes('kwatha')
  ) {
    return CATEGORY_STUDIO_PHOTOS.kasaya ?? DEFAULT_STUDIO_PHOTO;
  }

  // 10. Churna & Herbal Powders
  if (
    name.includes('churna') ||
    name.includes('churnaya') ||
    name.includes('powder') ||
    name.includes('piti') ||
    categoryStr.includes('churna') ||
    categoryStr.includes('powder')
  ) {
    return CATEGORY_STUDIO_PHOTOS.churna ?? DEFAULT_STUDIO_PHOTO;
  }

  // 11. Raw Herbs & Spices
  if (
    name.includes('mul') ||
    name.includes('kole') ||
    name.includes('pothu') ||
    name.includes('atta') ||
    name.includes('ata') ||
    name.includes('seeds') ||
    name.includes('bark') ||
    name.includes('cinnamon') ||
    name.includes('clove') ||
    categoryStr.includes('dry') ||
    categoryStr.includes('amu')
  ) {
    return CATEGORY_STUDIO_PHOTOS.raw_herbs ?? DEFAULT_STUDIO_PHOTO;
  }

  // If departmentId is explicitly specified on the product
  if (product.departmentId && CATEGORY_STUDIO_PHOTOS[product.departmentId]) {
    return CATEGORY_STUDIO_PHOTOS[product.departmentId] ?? DEFAULT_STUDIO_PHOTO;
  }

  const deptId = classifyAyurvedicDepartment(
    product.name || '',
    typeof product.category === 'object' ? product.category?.name : product.category,
  );

  return CATEGORY_STUDIO_PHOTOS[deptId] ?? CATEGORY_STUDIO_PHOTOS.general ?? DEFAULT_STUDIO_PHOTO;
}
