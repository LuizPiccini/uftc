import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DebugPlayer {
  id: string;
  name: string;
  rawUrl: string | null;
  publicUrl?: string;
}

const DebugImages = () => {
  const [players, setPlayers] = useState<DebugPlayer[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('players')
        .select('id, name, profile_image_url')
        .limit(5);
      if (error) {
        console.error('Error fetching players', error);
        return;
      }
      const mapped = (data || []).map((p) => {
        const rawUrl = p.profile_image_url?.trim() || null;
        let publicUrl: string | undefined;
        if (rawUrl) {
          if (rawUrl.startsWith('http')) {
            publicUrl = rawUrl;
          } else {
            const path = rawUrl.replace(/^players\//, '');
            publicUrl = supabase.storage
              .from('players')
              .getPublicUrl(path).data.publicUrl;
          }
        }
        if (publicUrl) {
          fetch(publicUrl)
            .then((res) => {
              console.log('fetch', p.name, publicUrl, res.status, res.ok);
            })
            .catch((err) => {
              console.error('fetch error', p.name, publicUrl, err);
            });
          const img = new Image();
          img.onload = () => console.log('image load', p.name, publicUrl);
          img.onerror = (e) => console.error('image error', p.name, publicUrl, e);
          img.crossOrigin = 'anonymous';

          img.src = publicUrl;
        }
        return { id: p.id, name: p.name, rawUrl, publicUrl };
      });
      setPlayers(mapped);
    };
    load();
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
              onLoad={() => console.log('render load', p.name, p.publicUrl)}
              onError={(e) => console.error('render error', p.name, p.publicUrl, e)}
              style={{ maxWidth: '150px', maxHeight: '150px' }}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export default DebugImages;
