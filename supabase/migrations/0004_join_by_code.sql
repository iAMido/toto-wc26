-- =============================================================
-- Migration 0004: join_group_by_invite_code RPC
-- =============================================================
-- The groups SELECT RLS restricts reads to members only, so a
-- non-member can't look up a group by invite code to join it.
-- This SECURITY DEFINER function bypasses RLS for the lookup,
-- validates the code, and inserts the caller as a member.
-- =============================================================

CREATE OR REPLACE FUNCTION public.join_group_by_invite_code(p_code text)
RETURNS TABLE(group_id uuid, group_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id   uuid;
  v_group_name text;
BEGIN
  -- Normalise input: uppercase + trim
  SELECT g.id, g.name
    INTO v_group_id, v_group_name
    FROM groups g
   WHERE g.invite_code = upper(trim(p_code));

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code'
      USING ERRCODE = 'P0001';
  END IF;

  -- Idempotency guard
  IF EXISTS (
    SELECT 1 FROM group_members gm
     WHERE gm.group_id = v_group_id
       AND gm.user_id  = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Already a member of this group'
      USING ERRCODE = 'P0002';
  END IF;

  -- Insert membership
  INSERT INTO group_members (group_id, user_id)
  VALUES (v_group_id, auth.uid());

  RETURN QUERY SELECT v_group_id, v_group_name;
END;
$$;
