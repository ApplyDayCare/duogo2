import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { MoreVertical, Flag, Ban } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MatchActionsProps {
  matchId: string;
  otherUserId: string;
  otherName?: string;
  onBlocked?: () => void;
}

const MatchActions = ({ matchId, otherUserId, otherName, onBlocked }: MatchActionsProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [blocking, setBlocking] = useState(false);

  const handleBlock = async () => {
    if (!user) return;
    setBlocking(true);
    try {
      const { error } = await supabase.rpc("block_match_user", {
        _other_user_id: otherUserId,
        _match_id: matchId || "00000000-0000-0000-0000-000000000000",
      });

      if (error) throw error;

      toast({
        title: "User blocked",
        description: "You won't see them again.",
      });
      setShowBlockDialog(false);
      onBlocked?.();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setBlocking(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <MoreVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => navigate(`/report/${matchId}`)}>
            <Flag className="h-4 w-4 mr-2" /> Report this match
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setShowBlockDialog(true)}
          >
            <Ban className="h-4 w-4 mr-2" /> Block this user
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block {otherName || "this user"}?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Blocking means:</p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>You won't see them in matches</li>
                <li>They won't see you in matches</li>
                <li>Your existing match will be removed</li>
                <li>This action is permanent</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBlock}
              disabled={blocking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Block Them
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MatchActions;
