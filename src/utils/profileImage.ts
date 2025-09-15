import { supabase } from '@/integrations/supabase/client';

const ASSET_PREFIX_REGEX = /^\.?\/?((?:public\/)?assets\/)/i;

const normalizeLocalAssetPath = (value: string): string | undefined => {
  const match = value.match(ASSET_PREFIX_REGEX);
  if (!match) {
    return undefined;
  }

  const remainder = value.slice(match[0].length).replace(/^\/+/, '');

  let assetPrefix = match[1];
  if (/^public\//i.test(assetPrefix)) {
    assetPrefix = assetPrefix.slice(assetPrefix.indexOf('/') + 1);
  }

  assetPrefix = assetPrefix.replace(/\/+$/, '');

  const normalizedPath = remainder ? `${assetPrefix}/${remainder}` : assetPrefix;
  return `/${normalizedPath}`.replace(/\/+/g, '/');
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
