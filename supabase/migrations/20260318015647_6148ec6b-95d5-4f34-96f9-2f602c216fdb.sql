INSERT INTO system_servidores (id, nome, descricao, status) VALUES
  ('koffice-api', 'KOffice API', 'Integração com painel KOffice via API', 'ativo'),
  ('koffice-v2', 'KOffice V2', 'Integração com painel KOffice V2', 'ativo'),
  ('mundogf', 'MundoGF', 'Integração com painel MundoGF', 'ativo'),
  ('uniplay', 'Uniplay', 'Integração com painel Uniplay', 'ativo'),
  ('playfast', 'Playfast', 'Integração com painel Playfast', 'ativo'),
  ('unitv', 'UniTV', 'Integração com painel UniTV', 'ativo'),
  ('sigma', 'Sigma', 'Integração com painel Sigma', 'ativo')
ON CONFLICT (id) DO NOTHING;