import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Car, Send, Trash2 } from "lucide-react";

import { useCarpool } from "@/hooks/use-carpool";
import { CarpoolApiError } from "@/services/carpool-api";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/carpool/$token")({
  component: CarpoolPage,
});

function CarpoolPage() {
  const { token } = Route.useParams();
  const { board, isLoading, error, postMessage, deleteMessage } =
    useCarpool(token);
  const { toast } = useToast();
  const [draft, setDraft] = useState("");

  const handlePost = async () => {
    const body = draft.trim();
    if (!body) return;
    try {
      await postMessage.mutateAsync(body);
      setDraft("");
    } catch (err) {
      toast({
        title: "Couldn't post message",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (messageId: string) => {
    try {
      await deleteMessage.mutateAsync(messageId);
    } catch (err) {
      toast({
        title: "Couldn't delete message",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  // A background refetch can fail transiently (throttling, a blip) while we
  // still hold a good board -- keep showing it. Only replace the board when we
  // have nothing to show, or the link is definitively gone (invalid / closed).
  const isTerminalError =
    error instanceof CarpoolApiError &&
    (error.status === 404 || error.status === 410);

  if (!board || isTerminalError) {
    const description =
      error instanceof CarpoolApiError
        ? error.message
        : "This carpool link isn't available.";
    return (
      <div className="flex h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Carpool board unavailable</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-background p-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Car className="h-5 w-5" />
            {board.restaurant_name}
          </CardTitle>
          <CardDescription>
            Coordinate a ride with your table. Posting as{" "}
            <span className="font-medium text-foreground">
              {board.participant_name}
            </span>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {board.messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No messages yet -- be the first to say how you're getting there.
              </p>
            ) : (
              board.messages.map((message) => (
                <div
                  key={message.id}
                  className="rounded-md border bg-card p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-medium">{message.sender_name}</span>{" "}
                      <span className="text-xs text-muted-foreground">
                        {new Date(message.created_at).toLocaleString()}
                      </span>
                    </div>
                    {message.is_mine && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(message.id)}
                        disabled={deleteMessage.isPending}
                        aria-label="Delete message"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2 border-t pt-4">
            <Textarea
              placeholder="Say something..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={500}
              disabled={postMessage.isPending}
            />
            <Button
              type="button"
              className="w-full"
              onClick={handlePost}
              disabled={!draft.trim() || postMessage.isPending}
            >
              {postMessage.isPending ? (
                <Spinner className="mr-2 h-4 w-4" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Post
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
