-- Corporate profile video: an optional media link the company publishes for research members.
ALTER TABLE businesses ADD COLUMN profile_video_url varchar(500);

INSERT INTO field_policies (id, role, resource, field, access, unlock_state) VALUES
-- The video is members-only content: hidden until the company is unlocked.
(UUID(), 'RESEARCHER', 'business', 'profile_video_url', 'HIDDEN', 'LOCKED'),
(UUID(), 'RESEARCHER', 'business', 'profile_video_url', 'READ', 'UNLOCKED'),

-- Business owners publish and maintain their own profile video.
(UUID(), 'BUSINESS', 'business', 'profile_video_url', 'WRITE', 'ANY'),

-- Auditor and admin access.
(UUID(), 'AUDITOR', 'business', 'profile_video_url', 'READ', 'ANY'),
(UUID(), 'ADMIN', 'business', 'profile_video_url', 'WRITE', 'ANY');
