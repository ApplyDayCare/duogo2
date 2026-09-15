import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { MoreVertical, Flag, Ban, CheckCircle2, ShieldOff, ShieldAlert } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { checkIsUserBlocked, toggleBlockUser } from "@/lib/blockService";

interface MatchActionsProps {
  matchId?: string | null;
  otherUserId: string;
  otherName?: string;
  onBlocked?: () => void;
  onUnblocked?: () => void;
  onToggle?: (isBlocked: boolean) => void;
  children?: React.ReactNode;
  className?: string;
  directDialog?: boolean;
}

const MatchActions = ({
  matchId,
  otherUserId,
  otherName,
  onBlocked,
  onUnblocked,
  onToggle,
  children,
  className = "",
  directDialog = false,
}: MatchActionsProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showUnblockDialog, setShowUnblockDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check if currently blocked
  const { data: isBlocked = false, refetch: refetchBlockStatus } = useQuery({
    queryKey: ["block-status", user?.id, otherUserId],
    queryFn: async () => {
      if (!user?.id || !otherUserId) return false;
      return await checkIsUserBlocked(user.id, otherUserId);
    },
    enabled: !!user?.id && !!otherUserId,
  });

  const handleToggleBlock = async (shouldBlock: boolean) => {
    if (!user?.id || !otherUserId) return;
    setLoading(true);

    try {
      const result = await toggleBlockUser({
        currentUserId: user.id,
        targetUserId: otherUserId,
        matchId: matchId || null,
        shouldBlock,
        queryClient,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to update block state");
      }

      await refetchBlockStatus();

      if (shouldBlock) {
        toast({
          title: "User blocked",
          description: `${otherName || "This user"} is now blocked and hidden from your feed, chats, and discovery.`,
        });
        setShowBlockDialog(false);
        onBlocked?.();
      } else {
        toast({
          title: "User unblocked",
          description: `${otherName || "This user"} has been unblocked.`,
        });
        setShowUnblockDialog(false);
        onUnblocked?.();
      }

      onToggle?.(shouldBlock);
    } catch (err: any) {
      toast({
        title: "Action failed",
        description: err.message || "Could not update user block status.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {directDialog && children ? (
        <div
          onClick={() => {
            if (isBlocked) {
              setShowUnblockDialog(true);
            } else {
              setShowBlockDialog(true);
            }
          }}
          className="cursor-pointer"
        >
          {children}
        </div>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {children || (
              <button
                id={`btn-match-actions-${otherUserId}`}
                className={`rounded-full p-1.5 text-muted-foreground hover:bg-[#FAF7F2] hover:text-[#181513] transition-colors ${className}`}
                title="More options"
                aria-label="Options"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 rounded-2xl p-1.5 shadow-lg border-[#EFE8DD]">
            {matchId && (
              <DropdownMenuItem
                onClick={() => navigate(`/report/${matchId}`)}
                className="rounded-xl cursor-pointer text-xs font-medium py-2"
              >
                <Flag className="h-4 w-4 mr-2 text-muted-foreground" /> Report this match
              </DropdownMenuItem>
            )}

            {isBlocked ? (
              <DropdownMenuItem
                className="rounded-xl cursor-pointer text-xs font-semibold py-2 text-emerald-600 focus:text-emerald-700"
                onClick={() => setShowUnblockDialog(true)}
              >
                <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" /> Unblock {otherName || "user"}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                className="rounded-xl cursor-pointer text-xs font-semibold py-2 text-destructive focus:text-destructive"
                onClick={() => setShowBlockDialog(true)}
              >
                <Ban className="h-4 w-4 mr-2 text-destructive" /> Block {otherName || "this user"}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Block Confirmation Dialog */}
      <AlertDialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <AlertDialogContent className="rounded-3xl max-w-md border-[#EFE8DD] shadow-xl">
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive border border-destructive/20">
              <Ban className="h-7 w-7" />
            </div>
            <AlertDialogTitle className="text-center font-serif text-xl font-bold text-[#181513]">
              Block {otherName || "this profile"}?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-left pt-2 text-[#666059]">
              <p className="text-sm">
                Are you sure you want to block <strong>{otherName || "this user"}</strong>? To prevent accidental actions, please confirm the following:
              </p>
              <div className="rounded-2xl bg-[#FAF7F2] border border-[#EBE3D5] p-3.5 space-y-2 text-xs">
                <div className="flex items-start gap-2">
                  <span className="text-destructive font-bold">•</span>
                  <span>They will be immediately removed from your conversations and match lists.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-destructive font-bold">•</span>
                  <span>Neither of you will appear in each other's Discovery queue or recommendations.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-destructive font-bold">•</span>
                  <span>They will be unable to message you or send future connection requests.</span>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2 mt-4">
            <AlertDialogCancel className="rounded-full font-semibold border-[#EBE3D5] hover:bg-[#FAF7F2]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleToggleBlock(true)}
              disabled={loading}
              className="rounded-full font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm"
            >
              {loading ? "Blocking..." : "Yes, Block Profile"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unblock Confirmation Dialog */}
      <AlertDialog open={showUnblockDialog} onOpenChange={setShowUnblockDialog}>
        <AlertDialogContent className="rounded-3xl max-w-md border-[#EFE8DD] shadow-xl">
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <AlertDialogTitle className="text-center font-serif text-xl font-bold text-[#181513]">
              Unblock {otherName || "this profile"}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left pt-2 text-xs text-[#666059] leading-relaxed">
              Unblocking will remove the block restriction so you may encounter each other again in future social discovery feeds.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2 mt-4">
            <AlertDialogCancel className="rounded-full font-semibold border-[#EBE3D5]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleToggleBlock(false)}
              disabled={loading}
              className="rounded-full font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
            >
              {loading ? "Unblocking..." : "Yes, Unblock Profile"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MatchActions;

