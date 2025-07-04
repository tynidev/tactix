-- Fix users table to add missing name column

-- Add name column if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;

-- Make name column NOT NULL with a default value for existing records
UPDATE users SET name = COALESCE(name, email) WHERE name IS NULL;
ALTER TABLE users ALTER COLUMN name SET NOT NULL;

-- Ensure the trigger function exists and works properly
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO users (id, email, name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
