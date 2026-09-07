-- Post-payment satisfaction survey. Private to the restaurant — never
-- shown to other diners, never sent anywhere public. Per participant
-- (not per table_session) since different diners at the same table can
-- have had a different experience.
alter table session_participants
  add column feedback_rating int check (feedback_rating between 1 and 5),
  add column feedback_submitted_at timestamptz;

-- Only diners who rate 4-5 stars are offered this link — never
-- conditioned on any reward, just shown selectively based on feedback
-- already given. Nothing here pays for or requires a review.
alter table restaurants add column google_review_url text;
