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
      allocations: {
        Row: {
          allocated_amount: number
          created_at: string
          current_value: number
          id: string
          is_active: boolean | null
          model_id: string
          subscription_id: string
          total_pnl: number | null
          total_pnl_percent: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allocated_amount?: number
          created_at?: string
          current_value?: number
          id?: string
          is_active?: boolean | null
          model_id: string
          subscription_id: string
          total_pnl?: number | null
          total_pnl_percent?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allocated_amount?: number
          created_at?: string
          current_value?: number
          id?: string
          is_active?: boolean | null
          model_id?: string
          subscription_id?: string
          total_pnl?: number | null
          total_pnl_percent?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "allocations_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: true
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_posts"
            referencedColumns: ["author_profile_id"]
          },
          {
            foreignKeyName: "allocations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_signals: {
        Row: {
          alpaca_order_id: string | null
          automation_id: string
          confidence: number | null
          created_at: string | null
          error_message: string | null
          executed_price: number | null
          id: string
          indicator_snapshot: Json | null
          price_at_signal: number | null
          signal_type: string
          symbol: string
          trade_executed: boolean | null
          user_id: string
        }
        Insert: {
          alpaca_order_id?: string | null
          automation_id: string
          confidence?: number | null
          created_at?: string | null
          error_message?: string | null
          executed_price?: number | null
          id?: string
          indicator_snapshot?: Json | null
          price_at_signal?: number | null
          signal_type: string
          symbol: string
          trade_executed?: boolean | null
          user_id: string
        }
        Update: {
          alpaca_order_id?: string | null
          automation_id?: string
          confidence?: number | null
          created_at?: string | null
          error_message?: string | null
          executed_price?: number | null
          id?: string
          indicator_snapshot?: Json | null
          price_at_signal?: number | null
          signal_type?: string
          symbol?: string
          trade_executed?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_signals_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "stock_automations"
            referencedColumns: ["id"]
          },
        ]
      }
      backtests: {
        Row: {
          benchmark: string | null
          cagr: number | null
          completed_at: string | null
          created_at: string | null
          end_date: string
          equity_curve: Json | null
          id: string
          initial_capital: number | null
          max_drawdown: number | null
          model_id: string
          name: string | null
          profit_factor: number | null
          sharpe_ratio: number | null
          sortino_ratio: number | null
          start_date: string
          status: string | null
          total_return: number | null
          total_trades: number | null
          user_id: string
          win_rate: number | null
        }
        Insert: {
          benchmark?: string | null
          cagr?: number | null
          completed_at?: string | null
          created_at?: string | null
          end_date: string
          equity_curve?: Json | null
          id?: string
          initial_capital?: number | null
          max_drawdown?: number | null
          model_id: string
          name?: string | null
          profit_factor?: number | null
          sharpe_ratio?: number | null
          sortino_ratio?: number | null
          start_date: string
          status?: string | null
          total_return?: number | null
          total_trades?: number | null
          user_id: string
          win_rate?: number | null
        }
        Update: {
          benchmark?: string | null
          cagr?: number | null
          completed_at?: string | null
          created_at?: string | null
          end_date?: string
          equity_curve?: Json | null
          id?: string
          initial_capital?: number | null
          max_drawdown?: number | null
          model_id?: string
          name?: string | null
          profit_factor?: number | null
          sharpe_ratio?: number | null
          sortino_ratio?: number | null
          start_date?: string
          status?: string | null
          total_return?: number | null
          total_trades?: number | null
          user_id?: string
          win_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "backtests_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backtests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backtests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_posts"
            referencedColumns: ["author_profile_id"]
          },
          {
            foreignKeyName: "backtests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookmarks: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookmarks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "public_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          post_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          post_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          post_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "public_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_posts"
            referencedColumns: ["author_profile_id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deployed_models: {
        Row: {
          config: Json | null
          deployed_at: string
          error_message: string | null
          id: string
          last_signal_at: string | null
          model_id: string
          status: string
          total_signals: number | null
          total_trades: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json | null
          deployed_at?: string
          error_message?: string | null
          id?: string
          last_signal_at?: string | null
          model_id: string
          status?: string
          total_signals?: number | null
          total_trades?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json | null
          deployed_at?: string
          error_message?: string | null
          id?: string
          last_signal_at?: string | null
          model_id?: string
          status?: string
          total_signals?: number | null
          total_trades?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deployed_models_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: true
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deployed_models_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deployed_models_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_posts"
            referencedColumns: ["author_profile_id"]
          },
          {
            foreignKeyName: "deployed_models_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string | null
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "public_posts"
            referencedColumns: ["author_profile_id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "public_posts"
            referencedColumns: ["author_profile_id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      holdings: {
        Row: {
          average_cost: number
          created_at: string
          id: string
          quantity: number
          stock_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          average_cost?: number
          created_at?: string
          id?: string
          quantity?: number
          stock_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          average_cost?: number
          created_at?: string
          id?: string
          quantity?: number
          stock_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "holdings_stock_id_fkey"
            columns: ["stock_id"]
            isOneToOne: false
            referencedRelation: "stocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holdings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holdings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_posts"
            referencedColumns: ["author_profile_id"]
          },
          {
            foreignKeyName: "holdings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      market_data_cache: {
        Row: {
          created_at: string | null
          data: Json
          end_date: string
          expires_at: string | null
          id: string
          start_date: string
          ticker: string
          timespan: string
        }
        Insert: {
          created_at?: string | null
          data: Json
          end_date: string
          expires_at?: string | null
          id?: string
          start_date: string
          ticker: string
          timespan: string
        }
        Update: {
          created_at?: string | null
          data?: Json
          end_date?: string
          expires_at?: string | null
          id?: string
          start_date?: string
          ticker?: string
          timespan?: string
        }
        Relationships: []
      }
      model_signals: {
        Row: {
          confidence: number | null
          executed_at: string | null
          generated_at: string
          id: string
          metadata: Json | null
          model_id: string
          price_at_signal: number | null
          quantity: number | null
          signal_type: string
          status: string
          ticker: string
        }
        Insert: {
          confidence?: number | null
          executed_at?: string | null
          generated_at?: string
          id?: string
          metadata?: Json | null
          model_id: string
          price_at_signal?: number | null
          quantity?: number | null
          signal_type: string
          status?: string
          ticker: string
        }
        Update: {
          confidence?: number | null
          executed_at?: string | null
          generated_at?: string
          id?: string
          metadata?: Json | null
          model_id?: string
          price_at_signal?: number | null
          quantity?: number | null
          signal_type?: string
          status?: string
          ticker?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_signals_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
      model_tickers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          model_id: string
          ticker: string
          weight: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          model_id: string
          ticker: string
          weight?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          model_id?: string
          ticker?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "model_tickers_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
      models: {
        Row: {
          configuration: Json | null
          created_at: string | null
          description: string | null
          feature_columns: Json | null
          horizon: number | null
          hyperparameters: Json | null
          id: string
          indicators_config: Json | null
          is_public: boolean | null
          max_allocation: number | null
          max_drawdown: number | null
          max_exposure_percent: number | null
          max_positions: number | null
          min_allocation: number | null
          ml_model_uuid: string | null
          model_type: string | null
          name: string
          performance_fee_percent: number | null
          position_size_percent: number | null
          risk_level: string | null
          sharpe_ratio: number | null
          status: string | null
          stop_loss_percent: number | null
          strategy_overview: string | null
          take_profit_percent: number | null
          theta: number | null
          ticker: string | null
          total_return: number | null
          total_subscribers: number | null
          training_metrics: Json | null
          updated_at: string | null
          user_id: string
          win_rate: number | null
        }
        Insert: {
          configuration?: Json | null
          created_at?: string | null
          description?: string | null
          feature_columns?: Json | null
          horizon?: number | null
          hyperparameters?: Json | null
          id?: string
          indicators_config?: Json | null
          is_public?: boolean | null
          max_allocation?: number | null
          max_drawdown?: number | null
          max_exposure_percent?: number | null
          max_positions?: number | null
          min_allocation?: number | null
          ml_model_uuid?: string | null
          model_type?: string | null
          name: string
          performance_fee_percent?: number | null
          position_size_percent?: number | null
          risk_level?: string | null
          sharpe_ratio?: number | null
          status?: string | null
          stop_loss_percent?: number | null
          strategy_overview?: string | null
          take_profit_percent?: number | null
          theta?: number | null
          ticker?: string | null
          total_return?: number | null
          total_subscribers?: number | null
          training_metrics?: Json | null
          updated_at?: string | null
          user_id: string
          win_rate?: number | null
        }
        Update: {
          configuration?: Json | null
          created_at?: string | null
          description?: string | null
          feature_columns?: Json | null
          horizon?: number | null
          hyperparameters?: Json | null
          id?: string
          indicators_config?: Json | null
          is_public?: boolean | null
          max_allocation?: number | null
          max_drawdown?: number | null
          max_exposure_percent?: number | null
          max_positions?: number | null
          min_allocation?: number | null
          ml_model_uuid?: string | null
          model_type?: string | null
          name?: string
          performance_fee_percent?: number | null
          position_size_percent?: number | null
          risk_level?: string | null
          sharpe_ratio?: number | null
          status?: string | null
          stop_loss_percent?: number | null
          strategy_overview?: string | null
          take_profit_percent?: number | null
          theta?: number | null
          ticker?: string | null
          total_return?: number | null
          total_subscribers?: number | null
          training_metrics?: Json | null
          updated_at?: string | null
          user_id?: string
          win_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "models_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "models_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_posts"
            referencedColumns: ["author_profile_id"]
          },
          {
            foreignKeyName: "models_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          executed_at: string | null
          executed_price: number | null
          id: string
          limit_price: number | null
          next_execution_at: string | null
          order_side: Database["public"]["Enums"]["order_side"]
          order_type: Database["public"]["Enums"]["order_type"]
          price: number | null
          quantity: number
          recurring_interval: string | null
          status: Database["public"]["Enums"]["order_status"]
          stock_id: string
          stop_price: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          executed_at?: string | null
          executed_price?: number | null
          id?: string
          limit_price?: number | null
          next_execution_at?: string | null
          order_side: Database["public"]["Enums"]["order_side"]
          order_type?: Database["public"]["Enums"]["order_type"]
          price?: number | null
          quantity: number
          recurring_interval?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          stock_id: string
          stop_price?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          executed_at?: string | null
          executed_price?: number | null
          id?: string
          limit_price?: number | null
          next_execution_at?: string | null
          order_side?: Database["public"]["Enums"]["order_side"]
          order_type?: Database["public"]["Enums"]["order_type"]
          price?: number | null
          quantity?: number
          recurring_interval?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          stock_id?: string
          stop_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_stock_id_fkey"
            columns: ["stock_id"]
            isOneToOne: false
            referencedRelation: "stocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_posts"
            referencedColumns: ["author_profile_id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      post_likes: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "public_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_posts"
            referencedColumns: ["author_profile_id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          comments_count: number | null
          content: string
          created_at: string | null
          id: string
          likes_count: number | null
          model_id: string | null
          post_type: string | null
          reposts_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          comments_count?: number | null
          content: string
          created_at?: string | null
          id?: string
          likes_count?: number | null
          model_id?: string | null
          post_type?: string | null
          reposts_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          comments_count?: number | null
          content?: string
          created_at?: string | null
          id?: string
          likes_count?: number | null
          model_id?: string | null
          post_type?: string | null
          reposts_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_posts"
            referencedColumns: ["author_profile_id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          allocated_balance: number | null
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          email_verified: boolean | null
          experience_level: string | null
          github_handle: string | null
          id: string
          is_muted: boolean
          is_verified: boolean | null
          linkedin_url: string | null
          paper_balance: number | null
          pending_email: string | null
          show_contact_info: boolean | null
          total_earnings: number | null
          total_followers: number | null
          total_following: number | null
          trading_frozen: boolean
          trading_philosophy: string | null
          twitter_handle: string | null
          updated_at: string | null
          user_type: string | null
          username: string | null
          verification_token: string | null
          verification_token_expires_at: string | null
          website_url: string | null
        }
        Insert: {
          allocated_balance?: number | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          email_verified?: boolean | null
          experience_level?: string | null
          github_handle?: string | null
          id: string
          is_muted?: boolean
          is_verified?: boolean | null
          linkedin_url?: string | null
          paper_balance?: number | null
          pending_email?: string | null
          show_contact_info?: boolean | null
          total_earnings?: number | null
          total_followers?: number | null
          total_following?: number | null
          trading_frozen?: boolean
          trading_philosophy?: string | null
          twitter_handle?: string | null
          updated_at?: string | null
          user_type?: string | null
          username?: string | null
          verification_token?: string | null
          verification_token_expires_at?: string | null
          website_url?: string | null
        }
        Update: {
          allocated_balance?: number | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          email_verified?: boolean | null
          experience_level?: string | null
          github_handle?: string | null
          id?: string
          is_muted?: boolean
          is_verified?: boolean | null
          linkedin_url?: string | null
          paper_balance?: number | null
          pending_email?: string | null
          show_contact_info?: boolean | null
          total_earnings?: number | null
          total_followers?: number | null
          total_following?: number | null
          trading_frozen?: boolean
          trading_philosophy?: string | null
          twitter_handle?: string | null
          updated_at?: string | null
          user_type?: string | null
          username?: string | null
          verification_token?: string | null
          verification_token_expires_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      reposts: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reposts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reposts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "public_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_automations: {
        Row: {
          allow_shorting: boolean
          created_at: string | null
          current_invested_amount: number
          horizon_minutes: number | null
          id: string
          indicators: Json
          is_active: boolean | null
          last_checked_at: string | null
          last_signal_at: string | null
          max_investment_amount: number | null
          max_quantity: number | null
          position_size_percent: number | null
          rsi_overbought: number | null
          rsi_oversold: number | null
          stop_loss_percent: number | null
          symbol: string
          take_profit_percent: number | null
          theta: number | null
          total_signals: number | null
          total_trades: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          allow_shorting?: boolean
          created_at?: string | null
          current_invested_amount?: number
          horizon_minutes?: number | null
          id?: string
          indicators?: Json
          is_active?: boolean | null
          last_checked_at?: string | null
          last_signal_at?: string | null
          max_investment_amount?: number | null
          max_quantity?: number | null
          position_size_percent?: number | null
          rsi_overbought?: number | null
          rsi_oversold?: number | null
          stop_loss_percent?: number | null
          symbol: string
          take_profit_percent?: number | null
          theta?: number | null
          total_signals?: number | null
          total_trades?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          allow_shorting?: boolean
          created_at?: string | null
          current_invested_amount?: number
          horizon_minutes?: number | null
          id?: string
          indicators?: Json
          is_active?: boolean | null
          last_checked_at?: string | null
          last_signal_at?: string | null
          max_investment_amount?: number | null
          max_quantity?: number | null
          position_size_percent?: number | null
          rsi_overbought?: number | null
          rsi_oversold?: number | null
          stop_loss_percent?: number | null
          symbol?: string
          take_profit_percent?: number | null
          theta?: number | null
          total_signals?: number | null
          total_trades?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      stocks: {
        Row: {
          current_price: number
          day_high: number | null
          day_low: number | null
          id: string
          logo_url: string | null
          market_cap: number | null
          name: string
          previous_close: number | null
          sector: string | null
          symbol: string
          updated_at: string
          volume: number | null
        }
        Insert: {
          current_price?: number
          day_high?: number | null
          day_low?: number | null
          id?: string
          logo_url?: string | null
          market_cap?: number | null
          name: string
          previous_close?: number | null
          sector?: string | null
          symbol: string
          updated_at?: string
          volume?: number | null
        }
        Update: {
          current_price?: number
          day_high?: number | null
          day_low?: number | null
          id?: string
          logo_url?: string | null
          market_cap?: number | null
          name?: string
          previous_close?: number | null
          sector?: string | null
          symbol?: string
          updated_at?: string
          volume?: number | null
        }
        Relationships: []
      }
      subscriber_trades: {
        Row: {
          allocation_id: string | null
          alpaca_order_id: string | null
          created_at: string
          error_message: string | null
          executed_at: string | null
          executed_price: number | null
          id: string
          pnl: number | null
          quantity: number
          side: string
          signal_id: string
          status: string
          subscription_id: string
          ticker: string
          user_id: string
        }
        Insert: {
          allocation_id?: string | null
          alpaca_order_id?: string | null
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          executed_price?: number | null
          id?: string
          pnl?: number | null
          quantity: number
          side: string
          signal_id: string
          status?: string
          subscription_id: string
          ticker: string
          user_id: string
        }
        Update: {
          allocation_id?: string | null
          alpaca_order_id?: string | null
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          executed_price?: number | null
          id?: string
          pnl?: number | null
          quantity?: number
          side?: string
          signal_id?: string
          status?: string
          subscription_id?: string
          ticker?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriber_trades_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriber_trades_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "model_signals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriber_trades_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriber_trades_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriber_trades_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_posts"
            referencedColumns: ["author_profile_id"]
          },
          {
            foreignKeyName: "subscriber_trades_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancelled_at: string | null
          funds_warning_sent: boolean | null
          id: string
          model_id: string
          performance_fee_percent: number
          status: string | null
          subscribed_at: string | null
          subscriber_id: string
          total_fees_paid: number | null
          total_pnl: number | null
        }
        Insert: {
          cancelled_at?: string | null
          funds_warning_sent?: boolean | null
          id?: string
          model_id: string
          performance_fee_percent: number
          status?: string | null
          subscribed_at?: string | null
          subscriber_id: string
          total_fees_paid?: number | null
          total_pnl?: number | null
        }
        Update: {
          cancelled_at?: string | null
          funds_warning_sent?: boolean | null
          id?: string
          model_id?: string
          performance_fee_percent?: number
          status?: string | null
          subscribed_at?: string | null
          subscriber_id?: string
          total_fees_paid?: number | null
          total_pnl?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "public_posts"
            referencedColumns: ["author_profile_id"]
          },
          {
            foreignKeyName: "subscriptions_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          backtest_id: string
          created_at: string | null
          entry_date: string
          entry_price: number
          exit_date: string | null
          exit_price: number | null
          id: string
          pnl: number | null
          pnl_percent: number | null
          quantity: number
          side: string
          status: string | null
          ticker: string
        }
        Insert: {
          backtest_id: string
          created_at?: string | null
          entry_date: string
          entry_price: number
          exit_date?: string | null
          exit_price?: number | null
          id?: string
          pnl?: number | null
          pnl_percent?: number | null
          quantity: number
          side: string
          status?: string | null
          ticker: string
        }
        Update: {
          backtest_id?: string
          created_at?: string | null
          entry_date?: string
          entry_price?: number
          exit_date?: string | null
          exit_price?: number | null
          id?: string
          pnl?: number | null
          pnl_percent?: number | null
          quantity?: number
          side?: string
          status?: string | null
          ticker?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_backtest_id_fkey"
            columns: ["backtest_id"]
            isOneToOne: false
            referencedRelation: "backtest_trade_summary"
            referencedColumns: ["backtest_id"]
          },
          {
            foreignKeyName: "trades_backtest_id_fkey"
            columns: ["backtest_id"]
            isOneToOne: false
            referencedRelation: "backtests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_backtest_id_fkey"
            columns: ["backtest_id"]
            isOneToOne: false
            referencedRelation: "public_backtests"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_activity_logs: {
        Row: {
          action_type: string
          amount: number | null
          brokerage_account_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          order_type: string | null
          quantity: number | null
          side: string | null
          status: string | null
          symbol: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          amount?: number | null
          brokerage_account_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          order_type?: string | null
          quantity?: number | null
          side?: string | null
          status?: string | null
          symbol?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          amount?: number | null
          brokerage_account_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          order_type?: string | null
          quantity?: number | null
          side?: string | null
          status?: string | null
          symbol?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trading_activity_logs_brokerage_account_id_fkey"
            columns: ["brokerage_account_id"]
            isOneToOne: false
            referencedRelation: "user_brokerage_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trading_activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trading_activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_posts"
            referencedColumns: ["author_profile_id"]
          },
          {
            foreignKeyName: "trading_activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_runs: {
        Row: {
          best_model_metrics: Json | null
          best_model_name: string | null
          completed_at: string | null
          created_at: string | null
          end_date: string
          error_message: string | null
          hyperparameters: Json | null
          id: string
          indicators_enabled: Json | null
          model_id: string | null
          results: Json | null
          start_date: string
          status: string | null
          ticker: string
          user_id: string
        }
        Insert: {
          best_model_metrics?: Json | null
          best_model_name?: string | null
          completed_at?: string | null
          created_at?: string | null
          end_date: string
          error_message?: string | null
          hyperparameters?: Json | null
          id?: string
          indicators_enabled?: Json | null
          model_id?: string | null
          results?: Json | null
          start_date: string
          status?: string | null
          ticker: string
          user_id: string
        }
        Update: {
          best_model_metrics?: Json | null
          best_model_name?: string | null
          completed_at?: string | null
          created_at?: string | null
          end_date?: string
          error_message?: string | null
          hyperparameters?: Json | null
          id?: string
          indicators_enabled?: Json | null
          model_id?: string | null
          results?: Json | null
          start_date?: string
          status?: string | null
          ticker?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_runs_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
      user_balances: {
        Row: {
          cash_balance: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cash_balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cash_balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_balances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_balances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_posts"
            referencedColumns: ["author_profile_id"]
          },
          {
            foreignKeyName: "user_balances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_brokerage_accounts: {
        Row: {
          access_count: number | null
          account_id: string | null
          account_status: string | null
          account_type: string
          api_key_encrypted: string
          api_secret_encrypted: string
          broker_name: string
          created_at: string
          daily_trade_limit: number | null
          id: string
          is_active: boolean | null
          last_accessed_at: string | null
          last_verified_at: string | null
          per_trade_limit: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_count?: number | null
          account_id?: string | null
          account_status?: string | null
          account_type: string
          api_key_encrypted: string
          api_secret_encrypted: string
          broker_name?: string
          created_at?: string
          daily_trade_limit?: number | null
          id?: string
          is_active?: boolean | null
          last_accessed_at?: string | null
          last_verified_at?: string | null
          per_trade_limit?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_count?: number | null
          account_id?: string | null
          account_status?: string | null
          account_type?: string
          api_key_encrypted?: string
          api_secret_encrypted?: string
          broker_name?: string
          created_at?: string
          daily_trade_limit?: number | null
          id?: string
          is_active?: boolean | null
          last_accessed_at?: string | null
          last_verified_at?: string | null
          per_trade_limit?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_brokerage_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_brokerage_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_posts"
            referencedColumns: ["author_profile_id"]
          },
          {
            foreignKeyName: "user_brokerage_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sms_consents: {
        Row: {
          consent_method: string | null
          consent_timestamp: string
          created_at: string | null
          id: string
          ip_address: unknown
          marketing: boolean
          phone_number: string
          privacy_accepted: boolean
          revoked_at: string | null
          security_alerts: boolean
          service_updates: boolean
          terms_accepted: boolean
          trading_alerts: boolean
          user_agent: string | null
          user_id: string
        }
        Insert: {
          consent_method?: string | null
          consent_timestamp?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          marketing?: boolean
          phone_number: string
          privacy_accepted?: boolean
          revoked_at?: string | null
          security_alerts?: boolean
          service_updates?: boolean
          terms_accepted?: boolean
          trading_alerts?: boolean
          user_agent?: string | null
          user_id: string
        }
        Update: {
          consent_method?: string | null
          consent_timestamp?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          marketing?: boolean
          phone_number?: string
          privacy_accepted?: boolean
          revoked_at?: string | null
          security_alerts?: boolean
          service_updates?: boolean
          terms_accepted?: boolean
          trading_alerts?: boolean
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sms_consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_sms_consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_posts"
            referencedColumns: ["author_profile_id"]
          },
          {
            foreignKeyName: "user_sms_consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      validation_runs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          end_date: string
          error_message: string | null
          id: string
          metrics: Json | null
          model_id: string | null
          signal_distribution: Json | null
          start_date: string
          status: string | null
          training_run_id: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          end_date: string
          error_message?: string | null
          id?: string
          metrics?: Json | null
          model_id?: string | null
          signal_distribution?: Json | null
          start_date: string
          status?: string | null
          training_run_id?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          end_date?: string
          error_message?: string | null
          id?: string
          metrics?: Json | null
          model_id?: string | null
          signal_distribution?: Json | null
          start_date?: string
          status?: string | null
          training_run_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "validation_runs_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validation_runs_training_run_id_fkey"
            columns: ["training_run_id"]
            isOneToOne: false
            referencedRelation: "training_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlist: {
        Row: {
          created_at: string
          id: string
          stock_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          stock_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          stock_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_stock_id_fkey"
            columns: ["stock_id"]
            isOneToOne: false
            referencedRelation: "stocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_posts"
            referencedColumns: ["author_profile_id"]
          },
          {
            foreignKeyName: "watchlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      backtest_trade_summary: {
        Row: {
          avg_pnl_per_trade: number | null
          backtest_id: string | null
          buy_count: number | null
          first_trade_date: string | null
          is_public: boolean | null
          last_trade_date: string | null
          losing_trades: number | null
          model_id: string | null
          model_owner_id: string | null
          sell_count: number | null
          total_pnl: number | null
          total_trades: number | null
          win_rate_pct: number | null
          winning_trades: number | null
        }
        Relationships: [
          {
            foreignKeyName: "backtests_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "models_user_id_fkey"
            columns: ["model_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "models_user_id_fkey"
            columns: ["model_owner_id"]
            isOneToOne: false
            referencedRelation: "public_posts"
            referencedColumns: ["author_profile_id"]
          },
          {
            foreignKeyName: "models_user_id_fkey"
            columns: ["model_owner_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      public_backtests: {
        Row: {
          benchmark: string | null
          cagr: number | null
          completed_at: string | null
          created_at: string | null
          end_date: string | null
          equity_curve: Json | null
          id: string | null
          initial_capital: number | null
          max_drawdown: number | null
          model_id: string | null
          name: string | null
          profit_factor: number | null
          sharpe_ratio: number | null
          sortino_ratio: number | null
          start_date: string | null
          status: string | null
          total_return: number | null
          total_trades: number | null
          win_rate: number | null
        }
        Insert: {
          benchmark?: string | null
          cagr?: number | null
          completed_at?: string | null
          created_at?: string | null
          end_date?: string | null
          equity_curve?: Json | null
          id?: string | null
          initial_capital?: number | null
          max_drawdown?: number | null
          model_id?: string | null
          name?: string | null
          profit_factor?: number | null
          sharpe_ratio?: number | null
          sortino_ratio?: number | null
          start_date?: string | null
          status?: string | null
          total_return?: number | null
          total_trades?: number | null
          win_rate?: number | null
        }
        Update: {
          benchmark?: string | null
          cagr?: number | null
          completed_at?: string | null
          created_at?: string | null
          end_date?: string | null
          equity_curve?: Json | null
          id?: string | null
          initial_capital?: number | null
          max_drawdown?: number | null
          model_id?: string | null
          name?: string | null
          profit_factor?: number | null
          sharpe_ratio?: number | null
          sortino_ratio?: number | null
          start_date?: string | null
          status?: string | null
          total_return?: number | null
          total_trades?: number | null
          win_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "backtests_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
      public_posts: {
        Row: {
          author_profile_id: string | null
          avatar_url: string | null
          comments_count: number | null
          content: string | null
          created_at: string | null
          display_name: string | null
          id: string | null
          is_verified: boolean | null
          likes_count: number | null
          model_id: string | null
          post_type: string | null
          updated_at: string | null
          username: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          experience_level: string | null
          github_handle: string | null
          id: string | null
          is_verified: boolean | null
          linkedin_url: string | null
          total_earnings: number | null
          total_followers: number | null
          total_following: number | null
          trading_philosophy: string | null
          twitter_handle: string | null
          updated_at: string | null
          user_type: string | null
          username: string | null
          website_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          experience_level?: string | null
          github_handle?: never
          id?: string | null
          is_verified?: boolean | null
          linkedin_url?: never
          total_earnings?: number | null
          total_followers?: number | null
          total_following?: number | null
          trading_philosophy?: string | null
          twitter_handle?: never
          updated_at?: string | null
          user_type?: string | null
          username?: string | null
          website_url?: never
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          experience_level?: string | null
          github_handle?: never
          id?: string | null
          is_verified?: boolean | null
          linkedin_url?: never
          total_earnings?: number | null
          total_followers?: number | null
          total_following?: number | null
          trading_philosophy?: string | null
          twitter_handle?: never
          updated_at?: string | null
          user_type?: string | null
          username?: string | null
          website_url?: never
        }
        Relationships: []
      }
    }
    Functions: {
      get_backtest_trade_summary: {
        Args: { p_model_id?: string }
        Returns: {
          avg_pnl_per_trade: number
          backtest_id: string
          buy_count: number
          first_trade_date: string
          is_public: boolean
          last_trade_date: string
          losing_trades: number
          model_id: string
          model_owner_id: string
          sell_count: number
          total_pnl: number
          total_trades: number
          win_rate_pct: number
          winning_trades: number
        }[]
      }
      get_public_posts: {
        Args: { limit_count?: number }
        Returns: {
          author_profile_id: string
          avatar_url: string
          comments_count: number
          content: string
          created_at: string
          display_name: string
          id: string
          is_verified: boolean
          likes_count: number
          model_id: string
          post_type: string
          updated_at: string
          username: string
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_alpha_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "developer" | "retail_trader" | "alpha"
      order_side: "buy" | "sell"
      order_status: "pending" | "executed" | "cancelled" | "failed"
      order_type: "market" | "limit" | "stop_loss" | "recurring"
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
      app_role: ["admin", "developer", "retail_trader", "alpha"],
      order_side: ["buy", "sell"],
      order_status: ["pending", "executed", "cancelled", "failed"],
      order_type: ["market", "limit", "stop_loss", "recurring"],
    },
  },
} as const
