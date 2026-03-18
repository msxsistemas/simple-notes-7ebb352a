import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function LogoutButton() {
  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast.error('Erro ao sair');
      } else {
        // Clear sensitive data from localStorage
        localStorage.removeItem('whatsapp_session_data');
        localStorage.removeItem('whatsapp_session');
        localStorage.removeItem('whatsapp_messages');
        localStorage.removeItem('auth_token');
        sessionStorage.removeItem('auth_token');
        toast.success('Logout realizado com sucesso!');
      }
    } catch (error) {
      toast.error('Erro ao sair');
    }
  };

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={handleLogout}
      className="gap-2"
    >
      <LogOut className="h-4 w-4" />
      Sair
    </Button>
  );
}