
INSERT INTO public.system_servidores (id, nome, descricao, status) VALUES
  ('now', 'NOW', 'Painel NOW IPTV', 'inativo'),
  ('thebest', 'THEBEST', 'Painel TheBest IPTV', 'inativo'),
  ('wplay', 'WPLAY', 'Painel WPlay IPTV', 'inativo'),
  ('natv', 'NATV', 'Painel NATV', 'inativo'),
  ('tvs', 'TVS E FRANQUIAS', 'Painel TVS e Franquias', 'inativo'),
  ('painelfoda', 'PAINELFODA', 'Painel Foda IPTV', 'inativo'),
  ('centralp2braz', 'CENTRALP2BRAZ', 'Painel CentralP2Braz', 'inativo'),
  ('clubtv', 'CLUBTV', 'Painel ClubTV', 'inativo'),
  ('easyplay', 'EASYPLAY', 'Painel EasyPlay', 'inativo'),
  ('blade', 'BLADE', 'Painel Blade IPTV', 'inativo'),
  ('live21', 'LIVE21', 'Painel Live21', 'inativo'),
  ('elite-office', 'ELITE OFFICE', 'Painel Elite Office', 'inativo'),
  ('unitv', 'UNITV', 'Painel UniTV', 'inativo')
ON CONFLICT (id) DO NOTHING;
