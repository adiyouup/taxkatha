-- A member's comments are personal data. Whatever path removes a user
-- (self-service deletion, an admin removing an account, a manual delete),
-- their comments are erased first. The row stays as a "deleted" slot so other
-- members' replies keep their context; comments.user_id then becomes NULL.
CREATE OR REPLACE FUNCTION erase_comments_of_deleted_user() RETURNS trigger AS $$
BEGIN
  UPDATE comments SET status = 'deleted', body = '' WHERE user_id = OLD.id AND status <> 'deleted';
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER user_erase_comments
  BEFORE DELETE ON "user"
  FOR EACH ROW EXECUTE FUNCTION erase_comments_of_deleted_user();
