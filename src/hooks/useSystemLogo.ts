import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import logoPlay from '@/assets/logo-play.png';

export function useSystemLogo() {
  const [logoUrl, setLogoUrl] = useState<string>(logoPlay);

  useEffect(() => {
    const fetchLogo = async () => {
      const { data } = await supabase
        .from('system_config')
        .select('logo_url')
        .eq('id', 1)
        .single();

      if (data?.logo_url) {
        setLogoUrl(data.logo_url);
      }
    };

    fetchLogo();

    // Listen for realtime changes
    const channel = supabase
      .channel('system_config_logo')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'system_config',
      }, (payload) => {
        if (payload.new?.logo_url) {
          setLogoUrl(payload.new.logo_url);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return logoUrl;
}
