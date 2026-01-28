-- Candidate retrieval for Shift Backfilling (hard filters + proximity)

CREATE OR REPLACE FUNCTION rpc_fetch_candidates(
  p_shift_id UUID,
  p_radius_miles INT DEFAULT 10
)
RETURNS TABLE (
  caregiver_id UUID,
  caregiver_name TEXT,
  phone_number TEXT,
  distance_miles DOUBLE PRECISION,
  skills_overlap TEXT[],
  has_mandatory_skills BOOLEAN,
  reliability_score DOUBLE PRECISION,
  last_minute_accept_rate DOUBLE PRECISION,
  language_match BOOLEAN
)
LANGUAGE sql
STABLE
AS $$
  WITH target AS (
    SELECT
      s.id AS shift_id,
      s.start_time,
      s.end_time,
      s.required_skills,
      c.id AS client_id,
      c.primary_language AS client_language,
      c.location AS client_location
    FROM shifts s
    JOIN clients c ON c.id = s.client_id
    WHERE s.id = p_shift_id
    LIMIT 1
  ),
  eligible AS (
    SELECT
      cg.id AS caregiver_id,
      cg.full_name AS caregiver_name,
      cg.phone_number,
      cg.skills,
      cg.primary_language AS caregiver_language,
      cg.location AS caregiver_location,
      COALESCE(cs.reliability_score, 0.5) AS reliability_score,
      COALESCE(cs.last_minute_accept_rate, 0.5) AS last_minute_accept_rate
    FROM caregivers cg
    LEFT JOIN caregiver_stats cs ON cs.caregiver_id = cg.id
    WHERE
      cg.status = 'active'
  )
  SELECT
    e.caregiver_id,
    e.caregiver_name,
    e.phone_number,
    (ST_Distance(e.caregiver_location, t.client_location) / 1609.344) AS distance_miles,
    (
      SELECT array_agg(x)
      FROM (
        SELECT unnest(e.skills) AS x
        INTERSECT
        SELECT unnest(t.required_skills) AS x
      ) overlap
    ) AS skills_overlap,
    (
      CASE
        WHEN t.required_skills IS NULL OR cardinality(t.required_skills) = 0 THEN TRUE
        ELSE (t.required_skills <@ e.skills)
      END
    ) AS has_mandatory_skills,
    e.reliability_score::DOUBLE PRECISION,
    e.last_minute_accept_rate::DOUBLE PRECISION,
    (e.caregiver_language = t.client_language) AS language_match
  FROM eligible e
  CROSS JOIN target t
  WHERE
    t.client_location IS NOT NULL
    AND e.caregiver_location IS NOT NULL
    AND ST_DWithin(
      e.caregiver_location,
      t.client_location,
      (p_radius_miles::DOUBLE PRECISION * 1609.344)
    )
    -- availability: not already booked for overlapping shifts
    AND NOT EXISTS (
      SELECT 1
      FROM shifts s2
      WHERE
        s2.caregiver_id = e.caregiver_id
        AND s2.status IN ('assigned', 'open', 'filled')
        AND NOT (s2.end_time <= t.start_time OR s2.start_time >= t.end_time)
    )
  ORDER BY distance_miles ASC;
$$;

