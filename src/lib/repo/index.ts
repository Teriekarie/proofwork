import { demoAuth, demoData } from './demo'
import { supabaseAuth, supabaseData } from './supabase'

export const isDemo = !(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)

export const auth = isDemo ? demoAuth : supabaseAuth
export const data = isDemo ? demoData : supabaseData

export * from './types'
