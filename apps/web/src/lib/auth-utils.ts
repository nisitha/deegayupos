import { supabase } from './supabase';

/**
 * Bulletproof application logout function.
 * Clears all Terminal PIN session keys, cashier overrides, Supabase tokens,
 * cached branch settings, and redirects cleanly to /login.
 */
export async function performAppLogout(router?: { replace?: (url: string) => void; push?: (url: string) => void }) {
  try {
    if (typeof window !== 'undefined') {
      const keysToRemove = [
        'pixelcraft_access_token',
        'pixelcraft_refresh_token',
        'pixelcraft_user',
        'pixelcraft_tenant',
        'pixelcraft_tenant_id',
        'pixelcraft_permissions',
        'pixelcraft_pos_session',
        'pixelcraft_selected_branch',
        'pixelcraft_active_branch_id',
        'pixelcraft_active_branch_name',
        'pixelcraft_active_cashier',
        'pixelcraft_cashier_id',
        'pixelcraft_cashier_name',
        'pixelcraft_pin_session',
        'pixelcraft_active_shift',
        'pixelcraft_approved_cross_branch_id',
      ];
      keysToRemove.forEach((key) => {
        try {
          localStorage.removeItem(key);
        } catch {}
      });

      try {
        sessionStorage.clear();
      } catch {}

      if (typeof document !== 'undefined') {
        document.cookie = 'pixelcraft_pos_session=; path=/; max-age=0; SameSite=Lax';
        document.cookie = 'pixelcraft_access_token=; path=/; max-age=0; SameSite=Lax';
        document.cookie = 'pixelcraft_refresh_token=; path=/; max-age=0; SameSite=Lax';
      }
    }
  } catch (err) {
    console.warn('[Logout] Error clearing local session storage:', err);
  }

  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('[Logout] Supabase signOut error (proceeding to redirect):', err);
  } finally {
    if (router && typeof router.replace === 'function') {
      try {
        router.replace('/login');
        return;
      } catch {}
    }
    if (typeof window !== 'undefined') {
      window.location.assign('/login');
    }
  }
}
