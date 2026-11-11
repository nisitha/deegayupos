import { classifyAyurvedicDepartment } from './ayurvedic-departments';

export interface ProductLike {
  name: string;
  category?: { name?: string; slug?: string } | string;
  imageUrl?: string;
  departmentId?: string;
}

export const CATEGORY_STUDIO_PHOTOS: Record<string, string> = {
  arishta: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&auto=format&fit=crop&q=80',
  taila: 'https://images.unsplash.com/photo-1608248597359-005085449767?w=300&auto=format&fit=crop&q=80',
  churna: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=300&auto=format&fit=crop&q=80',
  guli: 'https://images.unsplash.com/photo-1585435557343-3b092031a831?w=300&auto=format&fit=crop&q=80',
  rasayana: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=300&auto=format&fit=crop&q=80',
  kasaya: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=300&auto=format&fit=crop&q=80',
  raw_herbs: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=300&auto=format&fit=crop&q=80',
  balms: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=300&auto=format&fit=crop&q=80',
  skincare: 'https://images.unsplash.com/photo-1607006314646-b695123d9b15?w=300&auto=format&fit=crop&q=80',
  general: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=300&auto=format&fit=crop&q=80',
  fmcg: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=300&auto=format&fit=crop&q=80',
};

/**
 * Returns a high-definition realistic studio photograph for any product,
 * mapped dynamically by its custom image or its authentic Ayurvedic category.
 */
export function getProductPhoto(product: ProductLike): string {
  if (product.imageUrl && product.imageUrl.trim() !== '') {
    return product.imageUrl;
  }

  const deptId =
    product.departmentId ||
    classifyAyurvedicDepartment(
      product.name || '',
      typeof product.category === 'object' ? product.category?.name : product.category,
    );

  return CATEGORY_STUDIO_PHOTOS[deptId] || CATEGORY_STUDIO_PHOTOS.general || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&auto=format&fit=crop&q=80';
}

