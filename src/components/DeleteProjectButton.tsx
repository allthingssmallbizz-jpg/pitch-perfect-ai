"use client";

import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { deleteProject } from "@/lib/actions/projects";

// A bare delete icon sitting directly in a list row — right next to "Open," in the same dense
// row — is one misclick away from permanently losing every generation in a project. A native
// window.confirm() used to gate this, but that's a single reflexive "OK" away from going
// through by accident (easy to click through without reading while moving fast between many
// projects). Typing the exact project name is a much higher bar, deliberately modeled on
// GitHub's "type the repo name to delete it" pattern, for a deletion that cascades every
// generation in the project and can't be undone.
export default function DeleteProjectButton({
  projectId,
  projectName,
  redirectTo,
  // Icon-only button (dashboard/agent list rows) by default; "text" renders a plain destructive
  // text link instead, for spots like the discovery form's "Delete project" disclosure where an
  // icon wouldn't read as clearly as a labeled action.
  trigger = "icon",
}: {
  projectId: string;
  projectName: string;
  redirectTo?: string;
  trigger?: "icon" | "text";
}) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const matches = confirmText.trim() === projectName;

  return (
    <>
      {trigger === "icon" ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Delete this project"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => {
            setConfirmText("");
            setOpen(true);
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : (
        <button
          type="button"
          className="text-xs text-destructive hover:underline"
          onClick={() => {
            setConfirmText("");
            setOpen(true);
          }}
        >
          Permanently delete this project and its generations
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &quot;{projectName}&quot;?</DialogTitle>
            <DialogDescription>
              This permanently deletes the project and every generation made in it. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label htmlFor="confirm-project-name" className="text-sm text-muted-foreground">
              Type <span className="font-medium text-foreground">{projectName}</span> to confirm.
            </label>
            <Input
              id="confirm-project-name"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              className="mt-1.5"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!matches}
              onClick={() => formRef.current?.requestSubmit()}
            >
              Delete project
            </Button>
          </DialogFooter>
          <form ref={formRef} action={deleteProject} className="hidden">
            <input type="hidden" name="projectId" value={projectId} />
            {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
