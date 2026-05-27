import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://nsrmuttpqcrhtyhjqmqc.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zcm11dHRwcWNyaHR5aGpxbXFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3OTQ2MTIsImV4cCI6MjA5NTM3MDYxMn0.ZzXq0M_QgfLFl0fy8d7rxHhxwXPYs1lGd4fR7-Mqsj8'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
