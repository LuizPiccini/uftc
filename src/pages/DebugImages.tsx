import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { resolveProfileImageUrl } from '@/utils/profileImage';

interface DebugPlayer {
  id: string;
  name: string;
  rawUrl: string | null;
  publicUrl?: string;
}

const DebugImages = () => {
  const [players, setPlayers] = useState<DebugPlayer[]>([]);

  useEffect(() => {
    const timestamp = new Date().toISOString();
    const locationDetails =
      typeof window !== 'undefined'
        ? {
            href: window.location.href,
            origin: window.location.origin,
          }
        : undefined;
    const documentDetails =
      typeof document !== 'undefined'
        ? {
            baseURI: document.baseURI,
          }
        : undefined;
    console.log('[DebugImages] mount', { timestamp, locationDetails, documentDetails });

    const load = async () => {
      console.log('[DebugImages] requesting players from supabase', {
        timestamp: new Date().toISOString(),
      });
      const { data, error } = await supabase
        .from('players')
        .select('id, name, profile_image_url')
        .limit(5);
      if (error) {
        console.error('[DebugImages] error fetching players', error);
        return;
      }
      console.log('[DebugImages] received players payload', {
        count: data?.length ?? 0,
        ids: (data || []).map((player) => player.id),
        sample: (data || []).slice(0, 3),
      });
      const mapped = (data || []).map((p) => {
        const rawUrl = p.profile_image_url?.trim() || null;
        console.log('[DebugImages] resolving profile image url', {
          id: p.id,
          name: p.name,
          originalUrl: p.profile_image_url,
          trimmedUrl: rawUrl,
        });
        const publicUrl = resolveProfileImageUrl(rawUrl);
        const resolutionType = !publicUrl
          ? 'missing'
          : /^https?:\/\//i.test(publicUrl)
          ? 'remote'
          : publicUrl.startsWith('/')
          ? 'local'
          : 'other';
        console.log('[DebugImages] resolved profile image url', {
          id: p.id,
          name: p.name,
          rawUrl,
          publicUrl,
          resolutionType,
        });
        if (publicUrl) {
          const isLocalAsset = publicUrl.startsWith('/');
          console.log('[DebugImages] initiating fetch for image', {
            id: p.id,
            name: p.name,
            publicUrl,
            isLocalAsset,
            timestamp: new Date().toISOString(),
          });
          fetch(publicUrl)
            .then((res) => {
              console.log('[DebugImages] fetch response', {
                id: p.id,
                name: p.name,
                publicUrl,
                status: res.status,
                ok: res.ok,
                redirected: res.redirected,
                type: res.type,
                url: res.url,
                contentType: res.headers.get('content-type'),
                contentLength: res.headers.get('content-length'),
              });
            })
            .catch((err) => {
              console.error('[DebugImages] fetch error', {
                id: p.id,
                name: p.name,
                publicUrl,
                message: err?.message,
                stack: err?.stack,
                error: err,
              });
            });
          const img = new Image();
          img.onload = () =>
            console.log('[DebugImages] image load event (pre-render)', {
              id: p.id,
              name: p.name,
              publicUrl,
              naturalWidth: img.naturalWidth,
              naturalHeight: img.naturalHeight,
              complete: img.complete,
            });
          img.onerror = (event) => {
            const eventObject =
              typeof event === 'object' && event !== null ? (event as Event) : undefined;
            const target = eventObject?.currentTarget as HTMLImageElement | null;
            const message =
              typeof event === 'string'
                ? event
                : eventObject instanceof ErrorEvent
                ? eventObject.message
                : undefined;
            const errorDetails =
              eventObject instanceof ErrorEvent ? eventObject.error : undefined;
            console.error('[DebugImages] image error event (pre-render)', {
              id: p.id,
              name: p.name,
              publicUrl,
              message,
              errorDetails,
              complete: target?.complete,
              currentSrc: target?.currentSrc,
              naturalWidth: target?.naturalWidth,
              naturalHeight: target?.naturalHeight,
            });
          };
          img.crossOrigin = 'anonymous';

          img.src = publicUrl;
          console.log('[DebugImages] assigned image source (pre-render)', {
            id: p.id,
            name: p.name,
            publicUrl,
            crossOrigin: img.crossOrigin,
          });
        }
        return { id: p.id, name: p.name, rawUrl, publicUrl };
      });
      console.log('[DebugImages] setting players state', {
        count: mapped.length,
        players: mapped,
      });
      setPlayers(mapped);
    };
    load().catch((err) => {
      console.error('[DebugImages] unexpected error while loading players', err);
    });
  }, []);

  return (
    <div style={{ padding: '1rem' }}>
      <h1>Debug Images</h1>
      {players.map((p) => (
        <div key={p.id} style={{ marginBottom: '1rem' }}>
          <strong>{p.name}</strong>
          <div>Raw: {p.rawUrl || 'null'}</div>
          <div>Public: {p.publicUrl || 'undefined'}</div>
          {p.publicUrl && (
            <img
              src={p.publicUrl}
              alt={p.name}
              crossOrigin="anonymous"
              onLoad={(event) => {
                const target = event.currentTarget;
                console.log('[DebugImages] image load event (render)', {
                  id: p.id,
                  name: p.name,
                  publicUrl: p.publicUrl,
                  naturalWidth: target.naturalWidth,
                  naturalHeight: target.naturalHeight,
                  currentSrc: target.currentSrc,
                  complete: target.complete,
                });
              }}
              onError={(event) => {
                const target = event.currentTarget;
                const message = event.nativeEvent instanceof ErrorEvent ? event.nativeEvent.message : undefined;
                const errorDetails = event.nativeEvent instanceof ErrorEvent ? event.nativeEvent.error : undefined;
                console.error('[DebugImages] image error event (render)', {
                  id: p.id,
                  name: p.name,
                  publicUrl: p.publicUrl,
                  message,
                  errorDetails,
                  naturalWidth: target.naturalWidth,
                  naturalHeight: target.naturalHeight,
                  currentSrc: target.currentSrc,
                  complete: target.complete,
                });
              }}
              style={{ maxWidth: '150px', maxHeight: '150px' }}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export default DebugImages;
