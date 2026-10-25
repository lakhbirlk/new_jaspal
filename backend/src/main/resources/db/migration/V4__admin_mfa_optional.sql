-- Administrators now sign in with a password only. MFA remains mandatory for auditors.
UPDATE app_settings
SET setting_value = 'AUDITOR'
WHERE setting_key = 'mfa.required.roles';
