/**
 * Appends Supabase Storage image transformation parameters to resize avatar images.
 * This dramatically reduces download size for large user-uploaded images.
 */
export function getOptimizedAvatarUrl(url: string | null | undefined, size: number = 96): string | undefined {
  if (!url) return undefined;
  
  // Only transform Supabase storage URLs
  if (url.includes('supabase.co/storage/v1/object/public/')) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}width=${size}&height=${size}&resize=cover&quality=75`;
  }
  
  return url;
}
