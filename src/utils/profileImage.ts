import { supabase } from '@/integrations/supabase/client';

const ASSET_PREFIX_REGEX = /^\.?\/?(?:public\/)?assets\//i;

const normalizeLocalAssetPath = (value: string): string | undefined => {
  if (!ASSET_PREFIX_REGEX.test(value)) {
    return undefined;
  }

  const remainder = value.replace(ASSET_PREFIX_REGEX, '').replace(/^\/+/, '');
  return remainder ? `/Assets/${remainder}` : '/Assets';
};

export const resolveProfileImageUrl = (
  rawUrl: string | null | undefined,
): string | undefined => {
  const trimmed = rawUrl?.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const assetPath = normalizeLocalAssetPath(trimmed);
  if (assetPath) {
    return assetPath;
  }

  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  const storagePath = trimmed.replace(/^players\//i, '');
  const { data } = supabase.storage.from('players').getPublicUrl(storagePath);
  return data?.publicUrl || undefined;
};
