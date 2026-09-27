import { Link } from "@tanstack/react-router";
import { Ban, ServerCrash } from "lucide-react";
import { BrandMark, Card } from "@/components/nexus/primitives";
import { Button } from "@/components/ui/button";

export function ErrorPage({ code }: { code: "403" | "500" }) {
  const forbidden = code === "403";
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-lg p-8 text-center">
        <div className="mx-auto flex justify-center">
          <BrandMark />
        </div>
        <div className="mx-auto mt-8 grid h-14 w-14 place-items-center rounded-md bg-destructive/10 text-destructive">
          {forbidden ? <Ban className="h-6 w-6" /> : <ServerCrash className="h-6 w-6" />}
        </div>
        <p className="mt-5 font-display text-5xl font-semibold text-foreground">{code}</p>
        <h1 className="mt-3 font-display text-xl font-semibold text-foreground">
          {forbidden ? "Access Denied" : "Server Error"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {forbidden
            ? "You don't have permission to view this workspace area."
            : "Something went wrong while loading this workspace area."}
        </p>
        <Button className="mt-6" asChild>
          <Link to="/app">Return to workspace</Link>
        </Button>
      </Card>
    </main>
  );
}
