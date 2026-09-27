import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Loader2, Paperclip, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useNexus } from "@/context/NexusContext";
import { api, isAuthenticated } from "@/services/api";
import type { FileItem } from "@/types/nexus";

/**
 * Attachments for one project or one task.
 *
 * The backend requires the NEX key for a task (resolveTaskId accepts either
 * form, but a serialized task only ever hands out the key), and a project id.
 * Exactly one target is sent, because attaching to both is a 400.
 */
export function Attachments({
  target,
  label,
}: {
  target: { projectId: string } | { taskId: string };
  label: string;
}) {
  const nexus = useNexus();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const live = nexus.isDemo === false && isAuthenticated();
  /*
    `target` is a fresh object on every parent render, so the callbacks depend
    on the ids themselves rather than the union, which would re-run on each
    render and refetch in a loop.
  */
  const projectId = "projectId" in target ? target.projectId : null;
  const taskId = "taskId" in target ? target.taskId : null;
  const key = projectId ?? taskId ?? "";

  const load = useCallback(async () => {
    if (!live) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (projectId) {
        setFiles(await api.files.forProject(projectId));
      } else if (taskId) {
        setFiles(await api.files.forTask(taskId));
      } else {
        setFiles([]);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Could not load ${label.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }, [label, live, projectId, taskId]);

  useEffect(() => {
    setFiles([]);
    void load();
  }, [load]);

  const upload = useCallback(
    async (file: File) => {
      setBusy(true);
      setError(null);

      try {
        const created = await api.files.attach(file, target);

        setFiles((items) => [created, ...items]);
        nexus.pushToast(`Attached to ${label}`, "success");
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Upload failed";

        setError(message);
        nexus.pushToast(message, "error");
      } finally {
        setBusy(false);
      }
    },
    [label, nexus, target],
  );

  const remove = useCallback(
    async (id: string) => {
      try {
        await api.files.remove(id);
        setFiles((items) => items.filter((item) => item.id !== id));
      } catch (caught) {
        nexus.pushToast(
          caught instanceof Error ? caught.message : "Could not remove the file",
          "error",
        );
      }
    },
    [nexus],
  );

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">
          Attachments
          {files.length > 0 ? (
            <span className="ml-2 text-muted-foreground">{files.length}</span>
          ) : null}
        </h4>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];

            if (file) {
              void upload(file);
            }

            event.target.value = "";
          }}
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={!live || busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="animate-spin" /> : <Upload />}
          Upload
        </Button>
      </div>

      {!live ? (
        <p className="text-xs text-muted-foreground">Sign in to manage attachments.</p>
      ) : loading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : files.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing attached yet.</p>
      ) : (
        <ul className="space-y-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-3 rounded-md border border-border bg-secondary/40 p-2"
            >
              <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">{file.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {file.type} · {file.size} · {file.owner || "unknown owner"}
                </span>
              </span>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Download ${file.name}`}
                onClick={() => void api.files.download(file.id, file.name)}
              >
                <Download />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Remove ${file.name}`}
                onClick={() => void remove(file.id)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Attachments;
