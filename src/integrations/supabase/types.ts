export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      afiliados_comissoes: {
        Row: {
          afiliado_rede_id: string | null
          comissao_percentual: number
          comissao_tipo: string
          comissao_valor: number
          created_at: string
          fatura_id: string | null
          id: string
          nivel: number
          user_id: string
          valor_fatura: number
        }
        Insert: {
          afiliado_rede_id?: string | null
          comissao_percentual?: number
          comissao_tipo?: string
          comissao_valor?: number
          created_at?: string
          fatura_id?: string | null
          id?: string
          nivel?: number
          user_id: string
          valor_fatura?: number
        }
        Update: {
          afiliado_rede_id?: string | null
          comissao_percentual?: number
          comissao_tipo?: string
          comissao_valor?: number
          created_at?: string
          fatura_id?: string | null
          id?: string
          nivel?: number
          user_id?: string
          valor_fatura?: number
        }
        Relationships: [
          {
            foreignKeyName: "afiliados_comissoes_afiliado_rede_id_fkey"
            columns: ["afiliado_rede_id"]
            isOneToOne: false
            referencedRelation: "afiliados_rede"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afiliados_comissoes_fatura_id_fkey"
            columns: ["fatura_id"]
            isOneToOne: false
            referencedRelation: "faturas"
            referencedColumns: ["id"]
          },
        ]
      }
      afiliados_niveis_config: {
        Row: {
          ativo: boolean
          id: number
          n1_tipo: string
          n1_valor: number
          n2_tipo: string
          n2_valor: number
          n3_tipo: string
          n3_valor: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          id?: number
          n1_tipo?: string
          n1_valor?: number
          n2_tipo?: string
          n2_valor?: number
          n3_tipo?: string
          n3_valor?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          id?: number
          n1_tipo?: string
          n1_valor?: number
          n2_tipo?: string
          n2_valor?: number
          n3_tipo?: string
          n3_valor?: number
          updated_at?: string
        }
        Relationships: []
      }
      afiliados_rede: {
        Row: {
          afiliado_email: string | null
          afiliado_nome: string | null
          afiliado_user_id: string | null
          ativo: boolean
          cliente_id: string | null
          codigo_convite: string
          comissao_recorrente: boolean
          comissao_tipo: string
          comissao_valor: number
          created_at: string
          id: string
          nivel: number
          pai_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          afiliado_email?: string | null
          afiliado_nome?: string | null
          afiliado_user_id?: string | null
          ativo?: boolean
          cliente_id?: string | null
          codigo_convite: string
          comissao_recorrente?: boolean
          comissao_tipo?: string
          comissao_valor?: number
          created_at?: string
          id?: string
          nivel?: number
          pai_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          afiliado_email?: string | null
          afiliado_nome?: string | null
          afiliado_user_id?: string | null
          ativo?: boolean
          cliente_id?: string | null
          codigo_convite?: string
          comissao_recorrente?: boolean
          comissao_tipo?: string
          comissao_valor?: number
          created_at?: string
          id?: string
          nivel?: number
          pai_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "afiliados_rede_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afiliados_rede_pai_id_fkey"
            columns: ["pai_id"]
            isOneToOne: false
            referencedRelation: "afiliados_rede"
            referencedColumns: ["id"]
          },
        ]
      }
      afiliados_usuarios_config: {
        Row: {
          afiliados_liberado: boolean
          codigo_convite: string | null
          comissao_tipo: string
          comissao_valor: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          afiliados_liberado?: boolean
          codigo_convite?: string | null
          comissao_tipo?: string
          comissao_valor?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          afiliados_liberado?: boolean
          codigo_convite?: string | null
          comissao_tipo?: string
          comissao_valor?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      aplicativos: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string
          id: string
          nome: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao: string
          id?: string
          nome: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string
          id?: string
          nome?: string
          user_id?: string | null
        }
        Relationships: []
      }
      asaas_config: {
        Row: {
          api_key_hash: string
          created_at: string
          id: string
          is_configured: boolean
          updated_at: string
          user_id: string
          webhook_url: string | null
        }
        Insert: {
          api_key_hash: string
          created_at?: string
          id?: string
          is_configured?: boolean
          updated_at?: string
          user_id: string
          webhook_url?: string | null
        }
        Update: {
          api_key_hash?: string
          created_at?: string
          id?: string
          is_configured?: boolean
          updated_at?: string
          user_id?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      cached_panel_sessions: {
        Row: {
          access_token: string
          cookies: string | null
          created_at: string
          expires_at: string
          extra_data: Json | null
          id: string
          painel_id: string
          provedor: string
          token_type: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          cookies?: string | null
          created_at?: string
          expires_at?: string
          extra_data?: Json | null
          id?: string
          painel_id: string
          provedor: string
          token_type?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          cookies?: string | null
          created_at?: string
          expires_at?: string
          extra_data?: Json | null
          id?: string
          painel_id?: string
          provedor?: string
          token_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      checkout_config: {
        Row: {
          created_at: string
          credit_card_enabled: boolean
          gateway_ativo: string
          id: string
          pix_enabled: boolean
          pix_manual_enabled: boolean
          pix_manual_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credit_card_enabled?: boolean
          gateway_ativo?: string
          id?: string
          pix_enabled?: boolean
          pix_manual_enabled?: boolean
          pix_manual_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credit_card_enabled?: boolean
          gateway_ativo?: string
          id?: string
          pix_enabled?: boolean
          pix_manual_enabled?: boolean
          pix_manual_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ciabra_config: {
        Row: {
          api_key_hash: string
          created_at: string
          id: string
          is_configured: boolean | null
          public_key_hash: string | null
          updated_at: string
          user_id: string
          webhook_url: string | null
        }
        Insert: {
          api_key_hash: string
          created_at?: string
          id?: string
          is_configured?: boolean | null
          public_key_hash?: string | null
          updated_at?: string
          user_id: string
          webhook_url?: string | null
        }
        Update: {
          api_key_hash?: string
          created_at?: string
          id?: string
          is_configured?: boolean | null
          public_key_hash?: string | null
          updated_at?: string
          user_id?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      clientes: {
        Row: {
          acessos_adicionais: Json | null
          aniversario: string | null
          aplicativos_adicionais: Json | null
          app: string | null
          ativo: boolean | null
          created_at: string | null
          data_venc_app: string | null
          data_vencimento: string | null
          desconto: string | null
          desconto_recorrente: boolean | null
          dispositivo: string | null
          email: string | null
          fatura: string | null
          fixo: boolean | null
          id: string
          indicador: string | null
          key: string | null
          lembretes: boolean | null
          mac: string | null
          mensagem: string | null
          nome: string
          observacao: string | null
          plano: string | null
          produto: string | null
          renovacao_pendente: boolean | null
          renovacao_pendente_dados: Json | null
          senha: string | null
          telas: number | null
          tipo_painel: string | null
          user_id: string | null
          usuario: string | null
          whatsapp: string
        }
        Insert: {
          acessos_adicionais?: Json | null
          aniversario?: string | null
          aplicativos_adicionais?: Json | null
          app?: string | null
          ativo?: boolean | null
          created_at?: string | null
          data_venc_app?: string | null
          data_vencimento?: string | null
          desconto?: string | null
          desconto_recorrente?: boolean | null
          dispositivo?: string | null
          email?: string | null
          fatura?: string | null
          fixo?: boolean | null
          id?: string
          indicador?: string | null
          key?: string | null
          lembretes?: boolean | null
          mac?: string | null
          mensagem?: string | null
          nome: string
          observacao?: string | null
          plano?: string | null
          produto?: string | null
          renovacao_pendente?: boolean | null
          renovacao_pendente_dados?: Json | null
          senha?: string | null
          telas?: number | null
          tipo_painel?: string | null
          user_id?: string | null
          usuario?: string | null
          whatsapp: string
        }
        Update: {
          acessos_adicionais?: Json | null
          aniversario?: string | null
          aplicativos_adicionais?: Json | null
          app?: string | null
          ativo?: boolean | null
          created_at?: string | null
          data_venc_app?: string | null
          data_vencimento?: string | null
          desconto?: string | null
          desconto_recorrente?: boolean | null
          dispositivo?: string | null
          email?: string | null
          fatura?: string | null
          fixo?: boolean | null
          id?: string
          indicador?: string | null
          key?: string | null
          lembretes?: boolean | null
          mac?: string | null
          mensagem?: string | null
          nome?: string
          observacao?: string | null
          plano?: string | null
          produto?: string | null
          renovacao_pendente?: boolean | null
          renovacao_pendente_dados?: Json | null
          senha?: string | null
          telas?: number | null
          tipo_painel?: string | null
          user_id?: string | null
          usuario?: string | null
          whatsapp?: string
        }
        Relationships: []
      }
      cobrancas: {
        Row: {
          cliente_nome: string | null
          cliente_whatsapp: string
          created_at: string
          gateway: string
          gateway_charge_id: string
          id: string
          renovado: boolean
          status: string
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          cliente_nome?: string | null
          cliente_whatsapp: string
          created_at?: string
          gateway: string
          gateway_charge_id: string
          id?: string
          renovado?: boolean
          status?: string
          updated_at?: string
          user_id: string
          valor: number
        }
        Update: {
          cliente_nome?: string | null
          cliente_whatsapp?: string
          created_at?: string
          gateway?: string
          gateway_charge_id?: string
          id?: string
          renovado?: boolean
          status?: string
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      cupons: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          desconto: number
          id: string
          limite_uso: number | null
          tipo_desconto: string
          updated_at: string
          user_id: string
          usos_atuais: number
          validade: string | null
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          desconto?: number
          id?: string
          limite_uso?: number | null
          tipo_desconto?: string
          updated_at?: string
          user_id: string
          usos_atuais?: number
          validade?: string | null
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          desconto?: number
          id?: string
          limite_uso?: number | null
          tipo_desconto?: string
          updated_at?: string
          user_id?: string
          usos_atuais?: number
          validade?: string | null
        }
        Relationships: []
      }
      envio_config: {
        Row: {
          configuracoes_ativas: boolean
          created_at: string
          id: string
          limite_diario: number | null
          limite_lote: number
          pausa_prolongada: number
          tempo_maximo: number
          tempo_minimo: number
          updated_at: string
          user_id: string
          variar_intervalo: boolean
        }
        Insert: {
          configuracoes_ativas?: boolean
          created_at?: string
          id?: string
          limite_diario?: number | null
          limite_lote?: number
          pausa_prolongada?: number
          tempo_maximo?: number
          tempo_minimo?: number
          updated_at?: string
          user_id: string
          variar_intervalo?: boolean
        }
        Update: {
          configuracoes_ativas?: boolean
          created_at?: string
          id?: string
          limite_diario?: number | null
          limite_lote?: number
          pausa_prolongada?: number
          tempo_maximo?: number
          tempo_minimo?: number
          updated_at?: string
          user_id?: string
          variar_intervalo?: boolean
        }
        Relationships: []
      }
      faturas: {
        Row: {
          cliente_id: string | null
          cliente_nome: string
          cliente_whatsapp: string
          created_at: string
          cupom_codigo: string | null
          expires_at: string | null
          gateway: string | null
          gateway_charge_id: string | null
          id: string
          paid_at: string | null
          pix_copia_cola: string | null
          pix_manual_key: string | null
          pix_qr_code: string | null
          plano_nome: string | null
          status: string
          updated_at: string
          user_id: string
          valor: number
          valor_original: number | null
        }
        Insert: {
          cliente_id?: string | null
          cliente_nome: string
          cliente_whatsapp: string
          created_at?: string
          cupom_codigo?: string | null
          expires_at?: string | null
          gateway?: string | null
          gateway_charge_id?: string | null
          id?: string
          paid_at?: string | null
          pix_copia_cola?: string | null
          pix_manual_key?: string | null
          pix_qr_code?: string | null
          plano_nome?: string | null
          status?: string
          updated_at?: string
          user_id: string
          valor: number
          valor_original?: number | null
        }
        Update: {
          cliente_id?: string | null
          cliente_nome?: string
          cliente_whatsapp?: string
          created_at?: string
          cupom_codigo?: string | null
          expires_at?: string | null
          gateway?: string | null
          gateway_charge_id?: string | null
          id?: string
          paid_at?: string | null
          pix_copia_cola?: string | null
          pix_manual_key?: string | null
          pix_qr_code?: string | null
          plano_nome?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          valor?: number
          valor_original?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "faturas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      gateway_rotation_config: {
        Row: {
          ativo: boolean
          contador_atual: number
          created_at: string
          gateway_a: string
          gateway_atual: string
          gateway_b: string
          id: string
          intervalo: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          contador_atual?: number
          created_at?: string
          gateway_a?: string
          gateway_atual?: string
          gateway_b?: string
          id?: string
          intervalo?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          contador_atual?: number
          created_at?: string
          gateway_a?: string
          gateway_atual?: string
          gateway_b?: string
          id?: string
          intervalo?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      indicacoes: {
        Row: {
          bonus: number
          cliente_indicado_id: string | null
          codigo_indicacao: string
          created_at: string
          id: string
          indicado_email: string | null
          indicado_nome: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bonus?: number
          cliente_indicado_id?: string | null
          codigo_indicacao: string
          created_at?: string
          id?: string
          indicado_email?: string | null
          indicado_nome?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bonus?: number
          cliente_indicado_id?: string | null
          codigo_indicacao?: string
          created_at?: string
          id?: string
          indicado_email?: string | null
          indicado_nome?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicacoes_cliente_indicado_id_fkey"
            columns: ["cliente_indicado_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      indicacoes_auto_renovacao: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          id: string
          min_indicacoes: number | null
          periodo: string | null
          tipo_desconto: string | null
          updated_at: string | null
          user_id: string
          valor_desconto: number | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          min_indicacoes?: number | null
          periodo?: string | null
          tipo_desconto?: string | null
          updated_at?: string | null
          user_id: string
          valor_desconto?: number | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          min_indicacoes?: number | null
          periodo?: string | null
          tipo_desconto?: string | null
          updated_at?: string | null
          user_id?: string
          valor_desconto?: number | null
        }
        Relationships: []
      }
      indicacoes_descontos_log: {
        Row: {
          ciclo: number
          created_at: string
          fatura_id: string | null
          id: string
          indicador_id: string
          indicador_nome: string
          tipo_desconto: string
          user_id: string
          valor_desconto: number
          valor_final: number
          valor_original: number
        }
        Insert: {
          ciclo?: number
          created_at?: string
          fatura_id?: string | null
          id?: string
          indicador_id: string
          indicador_nome: string
          tipo_desconto?: string
          user_id: string
          valor_desconto: number
          valor_final: number
          valor_original: number
        }
        Update: {
          ciclo?: number
          created_at?: string
          fatura_id?: string | null
          id?: string
          indicador_id?: string
          indicador_nome?: string
          tipo_desconto?: string
          user_id?: string
          valor_desconto?: number
          valor_final?: number
          valor_original?: number
        }
        Relationships: [
          {
            foreignKeyName: "indicacoes_descontos_log_fatura_id_fkey"
            columns: ["fatura_id"]
            isOneToOne: false
            referencedRelation: "faturas"
            referencedColumns: ["id"]
          },
        ]
      }
      logs_painel: {
        Row: {
          acao: string
          created_at: string
          id: string
          tipo: string
          user_id: string
        }
        Insert: {
          acao: string
          created_at?: string
          id?: string
          tipo?: string
          user_id: string
        }
        Update: {
          acao?: string
          created_at?: string
          id?: string
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      logs_sistema: {
        Row: {
          componente: string
          created_at: string
          evento: string
          id: string
          nivel: string
          user_id: string
        }
        Insert: {
          componente: string
          created_at?: string
          evento: string
          id?: string
          nivel?: string
          user_id: string
        }
        Update: {
          componente?: string
          created_at?: string
          evento?: string
          id?: string
          nivel?: string
          user_id?: string
        }
        Relationships: []
      }
      mensagens_padroes: {
        Row: {
          aniversario_cliente: string | null
          bem_vindo: string | null
          confirmacao_cliente: string | null
          confirmacao_pagamento: string | null
          dados_cliente: string | null
          enviar_bem_vindo: boolean
          expiracao_app: string | null
          fatura_criada: string | null
          id: number
          indicacao_convite: string | null
          indicacao_meta: string | null
          proximo_vencer: string | null
          updated_at: string | null
          user_id: string | null
          uuid_id: string | null
          vence_hoje: string | null
          vencido: string | null
        }
        Insert: {
          aniversario_cliente?: string | null
          bem_vindo?: string | null
          confirmacao_cliente?: string | null
          confirmacao_pagamento?: string | null
          dados_cliente?: string | null
          enviar_bem_vindo?: boolean
          expiracao_app?: string | null
          fatura_criada?: string | null
          id?: number
          indicacao_convite?: string | null
          indicacao_meta?: string | null
          proximo_vencer?: string | null
          updated_at?: string | null
          user_id?: string | null
          uuid_id?: string | null
          vence_hoje?: string | null
          vencido?: string | null
        }
        Update: {
          aniversario_cliente?: string | null
          bem_vindo?: string | null
          confirmacao_cliente?: string | null
          confirmacao_pagamento?: string | null
          dados_cliente?: string | null
          enviar_bem_vindo?: boolean
          expiracao_app?: string | null
          fatura_criada?: string | null
          id?: number
          indicacao_convite?: string | null
          indicacao_meta?: string | null
          proximo_vencer?: string | null
          updated_at?: string | null
          user_id?: string | null
          uuid_id?: string | null
          vence_hoje?: string | null
          vencido?: string | null
        }
        Relationships: []
      }
      mercadopago_config: {
        Row: {
          access_token_hash: string
          created_at: string
          id: string
          is_configured: boolean | null
          public_key_hash: string | null
          updated_at: string
          user_id: string
          webhook_url: string | null
        }
        Insert: {
          access_token_hash: string
          created_at?: string
          id?: string
          is_configured?: boolean | null
          public_key_hash?: string | null
          updated_at?: string
          user_id: string
          webhook_url?: string | null
        }
        Update: {
          access_token_hash?: string
          created_at?: string
          id?: string
          is_configured?: boolean | null
          public_key_hash?: string | null
          updated_at?: string
          user_id?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          link: string | null
          mensagem: string
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem: string
          tipo?: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      notificacoes_config: {
        Row: {
          api_chatbot: string | null
          created_at: string
          descontar_saldo_fatura: boolean
          dias_apos_vencimento: number
          dias_gerar_fatura: number
          dias_proximo_vencer: number
          hora_notificacoes: string
          id: string
          notif_aniversario: boolean
          notif_bem_vindo: boolean
          notif_confirmacao_pagamento: boolean
          notif_fatura_criada: boolean
          notif_indicacao: boolean
          notif_vencendo_hoje: boolean
          quantidade_mensagens: number
          updated_at: string
          user_id: string
          valor_taxa_pagamento: number
          whatsapp_pagamentos: string | null
        }
        Insert: {
          api_chatbot?: string | null
          created_at?: string
          descontar_saldo_fatura?: boolean
          dias_apos_vencimento?: number
          dias_gerar_fatura?: number
          dias_proximo_vencer?: number
          hora_notificacoes?: string
          id?: string
          notif_aniversario?: boolean
          notif_bem_vindo?: boolean
          notif_confirmacao_pagamento?: boolean
          notif_fatura_criada?: boolean
          notif_indicacao?: boolean
          notif_vencendo_hoje?: boolean
          quantidade_mensagens?: number
          updated_at?: string
          user_id: string
          valor_taxa_pagamento?: number
          whatsapp_pagamentos?: string | null
        }
        Update: {
          api_chatbot?: string | null
          created_at?: string
          descontar_saldo_fatura?: boolean
          dias_apos_vencimento?: number
          dias_gerar_fatura?: number
          dias_proximo_vencer?: number
          hora_notificacoes?: string
          id?: string
          notif_aniversario?: boolean
          notif_bem_vindo?: boolean
          notif_confirmacao_pagamento?: boolean
          notif_fatura_criada?: boolean
          notif_indicacao?: boolean
          notif_vencendo_hoje?: boolean
          quantidade_mensagens?: number
          updated_at?: string
          user_id?: string
          valor_taxa_pagamento?: number
          whatsapp_pagamentos?: string | null
        }
        Relationships: []
      }
      paineis_integracao: {
        Row: {
          auto_renovacao: boolean
          created_at: string
          dispositivo: string | null
          dispositivo_id: string | null
          id: string
          nome: string
          provedor: string
          proxy_session_id: string | null
          senha: string
          status: string
          updated_at: string
          url: string
          user_id: string
          usuario: string
          verificacao_status: string
        }
        Insert: {
          auto_renovacao?: boolean
          created_at?: string
          dispositivo?: string | null
          dispositivo_id?: string | null
          id?: string
          nome: string
          provedor?: string
          proxy_session_id?: string | null
          senha: string
          status?: string
          updated_at?: string
          url: string
          user_id: string
          usuario: string
          verificacao_status?: string
        }
        Update: {
          auto_renovacao?: boolean
          created_at?: string
          dispositivo?: string | null
          dispositivo_id?: string | null
          id?: string
          nome?: string
          provedor?: string
          proxy_session_id?: string | null
          senha?: string
          status?: string
          updated_at?: string
          url?: string
          user_id?: string
          usuario?: string
          verificacao_status?: string
        }
        Relationships: []
      }
      planos: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          quantidade: string | null
          tipo: string | null
          user_id: string | null
          valor: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          quantidade?: string | null
          tipo?: string | null
          user_id?: string | null
          valor: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          quantidade?: string | null
          tipo?: string | null
          user_id?: string | null
          valor?: string
        }
        Relationships: []
      }
      produtos: {
        Row: {
          ativo: boolean | null
          configuracoes_iptv: boolean | null
          created_at: string | null
          creditos: string | null
          descricao: string | null
          gateway: string | null
          id: string
          nome: string
          painel_id: string | null
          provedor_iptv: string | null
          renovacao_automatica: boolean | null
          tipo_servico: string
          user_id: string | null
          valor: string
        }
        Insert: {
          ativo?: boolean | null
          configuracoes_iptv?: boolean | null
          created_at?: string | null
          creditos?: string | null
          descricao?: string | null
          gateway?: string | null
          id?: string
          nome: string
          painel_id?: string | null
          provedor_iptv?: string | null
          renovacao_automatica?: boolean | null
          tipo_servico?: string
          user_id?: string | null
          valor: string
        }
        Update: {
          ativo?: boolean | null
          configuracoes_iptv?: boolean | null
          created_at?: string | null
          creditos?: string | null
          descricao?: string | null
          gateway?: string | null
          id?: string
          nome?: string
          painel_id?: string | null
          provedor_iptv?: string | null
          renovacao_automatica?: boolean | null
          tipo_servico?: string
          user_id?: string | null
          valor?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_painel_id_fkey"
            columns: ["painel_id"]
            isOneToOne: false
            referencedRelation: "paineis_integracao"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          chave_pix_indicacao: string | null
          created_at: string
          id: string
          nome_completo: string | null
          nome_empresa: string | null
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          chave_pix_indicacao?: string | null
          created_at?: string
          id?: string
          nome_completo?: string | null
          nome_empresa?: string | null
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          chave_pix_indicacao?: string | null
          created_at?: string
          id?: string
          nome_completo?: string | null
          nome_empresa?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      registration_ips: {
        Row: {
          created_at: string
          id: string
          ip_address: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string
          user_id?: string
        }
        Relationships: []
      }
      saques_indicacao: {
        Row: {
          chave_pix: string
          created_at: string
          id: string
          motivo_rejeicao: string | null
          status: string
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          chave_pix: string
          created_at?: string
          id?: string
          motivo_rejeicao?: string | null
          status?: string
          updated_at?: string
          user_id: string
          valor: number
        }
        Update: {
          chave_pix?: string
          created_at?: string
          id?: string
          motivo_rejeicao?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      system_config: {
        Row: {
          cor_primaria: string | null
          id: number
          logo_url: string | null
          manutencao: boolean | null
          mensagem_manutencao: string | null
          nome_sistema: string | null
          registro_aberto: boolean | null
          suporte_email: string | null
          suporte_whatsapp: string | null
          termos_url: string | null
          trial_dias: number | null
          updated_at: string
        }
        Insert: {
          cor_primaria?: string | null
          id?: number
          logo_url?: string | null
          manutencao?: boolean | null
          mensagem_manutencao?: string | null
          nome_sistema?: string | null
          registro_aberto?: boolean | null
          suporte_email?: string | null
          suporte_whatsapp?: string | null
          termos_url?: string | null
          trial_dias?: number | null
          updated_at?: string
        }
        Update: {
          cor_primaria?: string | null
          id?: number
          logo_url?: string | null
          manutencao?: boolean | null
          mensagem_manutencao?: string | null
          nome_sistema?: string | null
          registro_aberto?: boolean | null
          suporte_email?: string | null
          suporte_whatsapp?: string | null
          termos_url?: string | null
          trial_dias?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      system_gateways: {
        Row: {
          ambiente: string
          api_key_hash: string | null
          ativo: boolean
          configuracoes: Json | null
          created_at: string
          id: string
          nome: string
          provedor: string
          public_key_hash: string | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          ambiente?: string
          api_key_hash?: string | null
          ativo?: boolean
          configuracoes?: Json | null
          created_at?: string
          id?: string
          nome: string
          provedor: string
          public_key_hash?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          ambiente?: string
          api_key_hash?: string | null
          ativo?: boolean
          configuracoes?: Json | null
          created_at?: string
          id?: string
          nome?: string
          provedor?: string
          public_key_hash?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      system_indicacoes_config: {
        Row: {
          ativo: boolean
          descricao: string | null
          id: number
          tipo_bonus: string
          updated_at: string
          valor_bonus: number
        }
        Insert: {
          ativo?: boolean
          descricao?: string | null
          id?: number
          tipo_bonus?: string
          updated_at?: string
          valor_bonus?: number
        }
        Update: {
          ativo?: boolean
          descricao?: string | null
          id?: number
          tipo_bonus?: string
          updated_at?: string
          valor_bonus?: number
        }
        Relationships: []
      }
      system_plans: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          destaque: boolean
          id: string
          intervalo: string
          limite_clientes: number | null
          limite_mensagens: number | null
          limite_paineis: number | null
          limite_whatsapp_sessions: number | null
          nome: string
          ordem: number
          recursos: Json | null
          updated_at: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          destaque?: boolean
          id?: string
          intervalo?: string
          limite_clientes?: number | null
          limite_mensagens?: number | null
          limite_paineis?: number | null
          limite_whatsapp_sessions?: number | null
          nome: string
          ordem?: number
          recursos?: Json | null
          updated_at?: string
          valor?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          destaque?: boolean
          id?: string
          intervalo?: string
          limite_clientes?: number | null
          limite_mensagens?: number | null
          limite_paineis?: number | null
          limite_whatsapp_sessions?: number | null
          nome?: string
          ordem?: number
          recursos?: Json | null
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      system_servidores: {
        Row: {
          descricao: string | null
          id: string
          nome: string
          status: string
          updated_at: string
        }
        Insert: {
          descricao?: string | null
          id: string
          nome: string
          status?: string
          updated_at?: string
        }
        Update: {
          descricao?: string | null
          id?: string
          nome?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_templates: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          mensagem: string
          nome: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          mensagem: string
          nome: string
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          mensagem?: string
          nome?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      templates_cobranca: {
        Row: {
          chave_pix: string | null
          created_at: string | null
          id: string
          incluir_cartao: boolean | null
          incluir_chave_pix: boolean | null
          mensagem: string
          midia_path: string | null
          nome: string
          user_id: string | null
        }
        Insert: {
          chave_pix?: string | null
          created_at?: string | null
          id?: string
          incluir_cartao?: boolean | null
          incluir_chave_pix?: boolean | null
          mensagem: string
          midia_path?: string | null
          nome: string
          user_id?: string | null
        }
        Update: {
          chave_pix?: string | null
          created_at?: string | null
          id?: string
          incluir_cartao?: boolean | null
          incluir_chave_pix?: boolean | null
          mensagem?: string
          midia_path?: string | null
          nome?: string
          user_id?: string | null
        }
        Relationships: []
      }
      templates_mensagens: {
        Row: {
          created_at: string | null
          id: string
          mensagem: string
          midia: boolean | null
          nome: string
          padrao: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          mensagem: string
          midia?: boolean | null
          nome: string
          padrao?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          mensagem?: string
          midia?: boolean | null
          nome?: string
          padrao?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      transacoes: {
        Row: {
          created_at: string | null
          data_transacao: string | null
          descricao: string
          id: string
          tipo: string
          updated_at: string | null
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string | null
          data_transacao?: string | null
          descricao: string
          id?: string
          tipo: string
          updated_at?: string | null
          user_id: string
          valor: number
        }
        Update: {
          created_at?: string | null
          data_transacao?: string | null
          descricao?: string
          id?: string
          tipo?: string
          updated_at?: string | null
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string
          expira_em: string | null
          gateway_subscription_id: string | null
          id: string
          inicio: string
          plan_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expira_em?: string | null
          gateway_subscription_id?: string | null
          id?: string
          inicio?: string
          plan_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expira_em?: string | null
          gateway_subscription_id?: string | null
          id?: string
          inicio?: string
          plan_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "system_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      v3pay_config: {
        Row: {
          api_token_hash: string
          created_at: string
          id: string
          is_configured: boolean | null
          updated_at: string
          user_id: string
          webhook_url: string | null
        }
        Insert: {
          api_token_hash: string
          created_at?: string
          id?: string
          is_configured?: boolean | null
          updated_at?: string
          user_id: string
          webhook_url?: string | null
        }
        Update: {
          api_token_hash?: string
          created_at?: string
          id?: string
          is_configured?: boolean | null
          updated_at?: string
          user_id?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      v3pay_pj_config: {
        Row: {
          api_token_hash: string
          created_at: string
          id: string
          is_configured: boolean | null
          updated_at: string
          user_id: string
          webhook_url: string | null
        }
        Insert: {
          api_token_hash: string
          created_at?: string
          id?: string
          is_configured?: boolean | null
          updated_at?: string
          user_id: string
          webhook_url?: string | null
        }
        Update: {
          api_token_hash?: string
          created_at?: string
          id?: string
          is_configured?: boolean | null
          updated_at?: string
          user_id?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          created_at: string
          delivered_at: string | null
          error_message: string | null
          id: string
          media_url: string | null
          message: string
          message_id: string | null
          phone: string
          read_at: string | null
          scheduled_for: string | null
          sent_at: string
          session_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          media_url?: string | null
          message: string
          message_id?: string | null
          phone: string
          read_at?: string | null
          scheduled_for?: string | null
          sent_at?: string
          session_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          media_url?: string | null
          message?: string
          message_id?: string | null
          phone?: string
          read_at?: string | null
          scheduled_for?: string | null
          sent_at?: string
          session_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_sessions: {
        Row: {
          created_at: string | null
          device_name: string | null
          id: string
          last_activity: string | null
          phone_number: string | null
          qr_code: string | null
          session_data: Json | null
          session_id: string
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          device_name?: string | null
          id?: string
          last_activity?: string | null
          phone_number?: string | null
          qr_code?: string | null
          session_data?: Json | null
          session_id: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          device_name?: string | null
          id?: string
          last_activity?: string | null
          phone_number?: string | null
          qr_code?: string | null
          session_data?: Json | null
          session_id?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      woovi_config: {
        Row: {
          app_id_hash: string
          created_at: string
          id: string
          is_configured: boolean | null
          updated_at: string
          user_id: string
          webhook_url: string | null
        }
        Insert: {
          app_id_hash?: string
          created_at?: string
          id?: string
          is_configured?: boolean | null
          updated_at?: string
          user_id: string
          webhook_url?: string | null
        }
        Update: {
          app_id_hash?: string
          created_at?: string
          id?: string
          is_configured?: boolean | null
          updated_at?: string
          user_id?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_get_gateway_secret: {
        Args: { p_gateway: string; p_secret_name: string; p_user_id: string }
        Returns: string
      }
      admin_store_gateway_secret: {
        Args: {
          p_gateway: string
          p_secret_name: string
          p_secret_value: string
          p_user_id: string
        }
        Returns: string
      }
      create_default_templates: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      delete_gateway_secret: {
        Args: { p_gateway: string; p_secret_name: string; p_user_id: string }
        Returns: undefined
      }
      get_gateway_secret: {
        Args: { p_gateway: string; p_secret_name: string; p_user_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      store_gateway_secret: {
        Args: {
          p_gateway: string
          p_secret_name: string
          p_secret_value: string
          p_user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
