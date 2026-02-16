# Docs
We will use this to document important things to keep track of what we are doing

## Database model 1.0 temporary name

profiles: (OK)

id (uuid, PK, igual ao auth.users.id)
name (text)
level (numeric)
created_at (timestamp)

categories: (OK)

id (uuid, PK)
name (text)
points_per_page (numeric)
created_at (timestamp)

readings: (OK)

id (uuid, PK)
user_id (uuid, FK profiles.id)
category_id (uuid, FK categories.id)
pages (int)
source_name (text)
reading_date (date)
created_at (timestamp)

goals: (OK)

id
name                
period_type         
target_points
bonus_points
active
created_at

goal_progress: (OK)

id
user_id
date             
points_earned
target_points
bonus_points
completed
debt_points

user_streaks: (OK)

user_id (PK)
current_streak
longest_streak
last_completed_date





