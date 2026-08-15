// Row shapes, matching the migrations. Hand written rather than generated so the app
// builds without a live database connection.

export interface Vehicle {
  id: string
  owner_id: string
  vin: string | null
  year: number
  make: string
  model: string
  trim: string | null
  engine_note: string | null
  drivetrain: string | null
  fuel_note: string | null
  in_service_date: string | null
  purchase_date: string
  purchase_odometer: number
  plan_end_odometer: number | null
  nickname: string | null
  created_at: string
}

export interface OdometerReading {
  id: string
  vehicle_id: string
  reading_date: string
  miles: number
  source: 'manual' | 'derived_from_service' | string
  created_at: string
}

export interface MaintenanceItem {
  id: string
  vehicle_id: string
  template_id: string | null
  name: string
  category: string
  interval_miles: number | null
  interval_months: number | null
  plain_language: string
  why_it_matters: string
  note: string | null
  typical_cost_low_cents: number | null
  typical_cost_high_cents: number | null
  prevents_label: string | null
  prevents_cost_low_cents: number | null
  prevents_cost_high_cents: number | null
  anchor_odometer: number
  anchor_date: string
  active: boolean
  sort_order: number
}

export interface ServiceLog {
  id: string
  vehicle_id: string
  maintenance_item_id: string | null
  performed_on: string
  odometer: number
  description: string
  shop_name: string | null
  cost_cents: number | null
  is_warranty_claim: boolean
  claim_status: 'filed' | 'approved' | 'denied' | null
  deductible_paid_cents: number | null
  receipt_path: string | null
  notes: string | null
  created_at: string
}

export type CoverageGuess = 'likely_covered' | 'not_covered' | 'gray'

export interface WatchItem {
  id: string
  vehicle_id: string
  watch_template_id: string | null
  name: string
  window_start_miles: number
  window_end_miles: number
  est_cost_low_cents: number | null
  est_cost_high_cents: number | null
  coverage_guess: CoverageGuess
  coverage_note: string | null
  symptoms: string
  first_check: string
  plain_language: string
  severity: string
  status: 'watching' | 'observed' | 'resolved' | 'dismissed'
  resolved_service_log_id: string | null
}

export interface Warranty {
  id: string
  vehicle_id: string
  name: string
  ends_at_miles: number | null
  ends_at_date: string | null
  cap_is_total_odometer: boolean | null
  starts_from_odometer: number | null
  deductible_cents: number | null
  reduced_deductible_cents: number | null
  reduced_deductible_condition: string | null
  coverage_type: string | null
  notes: string | null
}

export interface Task {
  id: string
  vehicle_id: string
  title: string
  detail: string
  why_urgent: string | null
  group_label: string | null
  due_date: string | null
  due_miles: number | null
  severity: 'normal' | 'high' | 'critical'
  external_url: string | null
  completed_at: string | null
  sort_order: number
}

export interface SymptomRef {
  id: string
  template_set: string
  symptom: string
  aliases: string[] | null
  first_check: string
  likely_cause: string
  watch_template_id: string | null
  urgency: 'normal' | 'soon' | 'stop_driving'
}

export interface AppState {
  user_id: string
  onboarding_completed_at: string | null
  onboarding_last_card: number
  has_seen_intro_animation: boolean
}
