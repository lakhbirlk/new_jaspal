-- Demo corporate videos now point at the default YouTube profile clip.
UPDATE businesses
SET profile_video_url = 'https://www.youtube.com/watch?v=fQ9nQNx0KEs&list=RDfQ9nQNx0KEs&start_radio=1',
    updated_at        = NOW()
WHERE profile_video_url = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
