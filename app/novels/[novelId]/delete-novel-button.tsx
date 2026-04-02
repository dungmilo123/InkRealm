"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { readJsonOrError } from "@/lib/fetch";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

type DeleteNovelButtonProps = {
  novelId: string;
  novelTitle: string;
};

export function DeleteNovelButton({
  novelId,
  novelTitle,
}: DeleteNovelButtonProps) {
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/novels/${novelId}`, { method: "DELETE" });
      const data = await readJsonOrError<{ success: boolean }>(res);

      if (!res.ok) {
        const errorData = data as { error?: string };
        toast.error(errorData.error ?? "Failed to delete novel");
        return;
      }

      toast.success(`"${novelTitle}" has been deleted`);
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Failed to delete novel. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            disabled={deleting}
          />
        }
      >
        <Trash2 className="size-4 mr-1.5" />
        {deleting ? "Deleting..." : "Delete Novel"}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete novel</AlertDialogTitle>
          <AlertDialogDescription>
            <>
              Are you sure you want to delete{" "}
              <strong>&ldquo;{novelTitle}&rdquo;</strong>? This will permanently
              remove the novel file, all translations, glossary entries, and
              reading progress. This action cannot be undone.
            </>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete Forever"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
