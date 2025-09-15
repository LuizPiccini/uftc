import { supabase } from '@/integrations/supabase/client';

const ASSET_PREFIX_REGEX = /^\.?\/?((?:public\/)?assets\/)/i;

const withBaseUrlIfNeeded = (path: string): string => {
  if (!path.startsWith('/') || path.startsWith('//')) {
    return path;
  }

  const baseUrl = import.meta.env.BASE_URL || '/';
  if (!baseUrl || baseUrl === '/' || baseUrl === './') {
    return path;
  }

  const normalizedPath = path.replace(/^\/+/, '');
  if (!/^assets\//i.test(normalizedPath)) {
    return path;
  }

  let base: URL | undefined;
  let basePath = '';

  try {
    base = new URL(baseUrl, 'http://local.base');
    basePath = base.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  } catch {
    basePath = baseUrl.replace(/^\/+/, '').replace(/\/+$/, '');
  }

  if (!basePath) {
    return path;
  }

  if (normalizedPath.toLowerCase().startsWith(basePath.toLowerCase())) {
    return path;
  }

  if (base) {
    const joined = new URL(normalizedPath, base);
    return joined.pathname;
  }

  return `/${basePath}/${normalizedPath}`.replace(/\/{2,}/g, '/');
};

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
  const assetPath = `/${normalizedPath}`.replace(/\/+/g, '/');
  return withBaseUrlIfNeeded(assetPath);
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
    if (trimmed.startsWith('//')) {
      return trimmed;
    }
    const normalized = `/${trimmed.replace(/^\/+/, '')}`;
    return withBaseUrlIfNeeded(normalized);
  }

  const storagePath = trimmed.replace(/^players\//i, '');
  const { data } = supabase.storage.from('players').getPublicUrl(storagePath);
  return data?.publicUrl || undefined;
};
