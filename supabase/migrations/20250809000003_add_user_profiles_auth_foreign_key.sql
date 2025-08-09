-- Migration to add foreign key constraint from user_profiles.id to auth.users(id)
-- This ensures referential integrity between Supabase Auth and application user profiles

-- ==========================================
-- ADD FOREIGN KEY CONSTRAINT
-- ==========================================

-- Add foreign key constraint linking user_profiles.id to auth.users(id)
-- This ensures that:
-- 1. user_profiles records can only exist if corresponding auth.users record exists
-- 2. When auth.users record is deleted, user_profiles record is also deleted (CASCADE)
-- 3. Maintains referential integrity between auth system and application data

ALTER TABLE public.user_profiles
  ADD CONSTRAINT fk_user_profiles_auth_users
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ==========================================
-- COMMENTS AND DOCUMENTATION
-- ==========================================

COMMENT ON CONSTRAINT fk_user_profiles_auth_users ON public.user_profiles IS 
'Foreign key constraint ensuring user_profiles.id references auth.users(id). 
When a user is deleted from auth.users, their profile is automatically deleted via CASCADE.
This maintains referential integrity between Supabase Auth and application user data.';

-- ==========================================
-- VERIFICATION QUERY (for testing)
-- ==========================================

-- Uncomment to verify the constraint was added successfully:
-- SELECT 
--     tc.constraint_name,
--     tc.table_name,
--     kcu.column_name,
--     ccu.table_name AS foreign_table_name,
--     ccu.column_name AS foreign_column_name,
--     rc.delete_rule
-- FROM information_schema.table_constraints AS tc
-- JOIN information_schema.key_column_usage AS kcu
--     ON tc.constraint_name = kcu.constraint_name
--     AND tc.table_schema = kcu.table_schema
-- JOIN information_schema.constraint_column_usage AS ccu
--     ON ccu.constraint_name = tc.constraint_name
--     AND ccu.table_schema = tc.table_schema
-- JOIN information_schema.referential_constraints AS rc
--     ON tc.constraint_name = rc.constraint_name
--     AND tc.table_schema = rc.constraint_schema
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--     AND tc.table_name = 'user_profiles'
--     AND tc.table_schema = 'public';
