import { useState } from "react";
import { MessageSquare, Pencil, Trash2, Plus } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useComments } from "@/hooks/use-comments";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";

interface ParticipantCommentsModalProps {
  participantId: string;
  participantName: string;
}

const commentSchema = z.object({
  comment_text: z.string().min(1, "Comment cannot be empty"),
});

type CommentFormValues = z.infer<typeof commentSchema>;

export function ParticipantCommentsModal({
  participantId,
  participantName,
}: ParticipantCommentsModalProps) {
  const { toast } = useToast();
  const { comments, isLoading, createComment, editComment, removeComment } =
    useComments("participant", participantId);

  const [open, setOpen] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const form = useForm<CommentFormValues>({
    resolver: zodResolver(commentSchema),
    defaultValues: {
      comment_text: "",
    },
  });

  const handleSubmit = async (values: CommentFormValues) => {
    try {
      if (editingCommentId) {
        await editComment.mutateAsync({
          id: editingCommentId,
          comment_text: values.comment_text,
        });
        toast({
          title: "Comment updated",
          description: "Your comment has been updated successfully.",
        });
      } else {
        await createComment.mutateAsync({
          comment_text: values.comment_text,
        });
        toast({
          title: "Comment added",
          description: "Your comment has been added successfully.",
        });
      }
      form.reset();
      setEditingCommentId(null);
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to save comment",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (commentId: string, commentText: string) => {
    setEditingCommentId(commentId);
    form.setValue("comment_text", commentText);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    form.reset();
  };

  const handleDelete = async (commentId: string) => {
    try {
      await removeComment.mutateAsync(commentId);
      toast({
        title: "Comment deleted",
        description: "The comment has been removed.",
      });
      setDeleteConfirmId(null);
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to delete comment",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const commentCount = comments.length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" title="View comments">
          <MessageSquare className="h-4 w-4" />
          {commentCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 px-1 text-xs bg-primary text-primary-foreground"
            >
              {commentCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Comments: {participantName}</DialogTitle>
          <DialogDescription>
            Add notes and observations about this participant.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Spinner className="h-6 w-6" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No comments yet. Add one below.
            </p>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-lg border border-border p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-foreground whitespace-pre-wrap flex-1">
                      {comment.comment_text}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          handleEdit(comment.id, comment.comment_text)
                        }
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <AlertDialog
                        open={deleteConfirmId === comment.id}
                        onOpenChange={(open) =>
                          setDeleteConfirmId(open ? comment.id : null)
                        }
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteConfirmId(comment.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete comment?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleDelete(comment.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {comment.created_by_email && (
                      <>
                        <span className="font-medium text-foreground">
                          {comment.created_by_email}
                        </span>
                        <span>•</span>
                      </>
                    )}
                    <span>{formatDate(comment.created_at)}</span>
                    {comment.updated_at !== comment.created_at && (
                      <Badge variant="outline" className="text-xs">
                        edited
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border pt-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="comment_text"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {editingCommentId ? "Edit comment" : "Add comment"}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter your comment..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                {editingCommentId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelEdit}
                  >
                    Cancel Edit
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={
                    createComment.isPending ||
                    editComment.isPending ||
                    !form.formState.isDirty
                  }
                >
                  {editingCommentId ? (
                    <>
                      <Pencil className="h-4 w-4 mr-2" />
                      Update Comment
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Comment
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
