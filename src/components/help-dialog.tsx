"use client";

// Reusable "How Eksakt works" explainer. Two ways to render:
//   • <HelpDialog />              — trigger button (a small ⓘ Help link)
//   • <HelpDialog open onOpenChange={…} hideTrigger />  — controlled
//
// The body is intentionally short: three steps + a scoring breakdown.
// Eksakt's whole pitch is "predict the exact score," so we lean on it.

import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, HelpCircle, Mail, Plus, Share2, Zap, Target, Trophy } from "lucide-react";

interface HelpDialogProps {
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
  hideTrigger?: boolean;
  trigger?: ReactNode;
}

export function HelpDialog({
  open,
  onOpenChange,
  hideTrigger,
  trigger,
}: HelpDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const value = isControlled ? open : internalOpen;
  const setValue = isControlled
    ? (onOpenChange ?? (() => {}))
    : setInternalOpen;

  return (
    <Dialog open={value} onOpenChange={setValue}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
              <HelpCircle className="h-3.5 w-3.5 mr-1" />
              {"How it works"}
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{"How Eksakt works"}</DialogTitle>
          <DialogDescription>
            {"Predict the exact score. Beat your friends. Get bragging rights."}
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-3">
          <Step
            icon={<Plus className="h-4 w-4" />}
            title="Start a league"
            body={
              <>
                {"Tap "}
                <b>{"Create"}</b>
                {" to set up a league with friends, or "}
                <b>{"Join"}</b>
                {" with an invite code you were given."}
              </>
            }
          />
          <Step
            icon={<Target className="h-4 w-4" />}
            title="Predict before kickoff"
            body={
              <>
                {
                  "For each match, pick the final score. Everyone’s picks are hidden until the whistle blows — no copying."
                }
              </>
            }
          />
          <Step
            icon={<Trophy className="h-4 w-4" />}
            title="Score points, climb the table"
            body={
              <>
                {
                  "Points are awarded automatically as matches finish. Live points appear next to the live score in real time."
                }
              </>
            }
          />
        </ol>

        <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-1.5 text-xs">
          <div className="text-foreground font-semibold uppercase tracking-wider text-[10px] mb-1.5">
            {"Scoring"}
          </div>
          <Row label="Correct outcome (W / D / L)" value="1 pt" />
          <Row label="Exact score" value="+3 pts" />
          <Row label="Lone or rare outcome (<5%)" value="+3 pts" />
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1">
            <Zap className="h-3 w-3 text-primary" />
            <span>{"Boosters (×2 / ×3 / ×5) multiply the match total."}</span>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs">
          <div className="text-foreground font-semibold uppercase tracking-wider text-[10px] mb-1.5 inline-flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-primary" />
            {"90' rule"}
          </div>
          <p className="text-muted-foreground leading-relaxed">
            {
              "Predictions are scored on the score after 90 minutes. Extra time, penalty shootouts and any goals beyond regulation don't count — once the match leaves regular time, points are locked in."
            }
          </p>
        </div>

        <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
          {"Tip: tap the "}
          <Share2 className="inline h-3 w-3" />
          {" Invite icon at the top of any league to share an invite code."}
        </p>

        <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
          <Mail className="inline h-3 w-3" />
          {"Questions or feedback? "}
          <a
            href="mailto:toni.grabic@gmail.com"
            className="text-primary hover:underline"
          >
            {"toni.grabic@gmail.com"}
          </a>
        </p>
      </DialogContent>
    </Dialog>
  );
}

function Step({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <div className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground leading-relaxed">
          {body}
        </div>
      </div>
    </li>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-muted-foreground">
      <span>{label}</span>
      <span className="font-mono font-bold text-foreground">{value}</span>
    </div>
  );
}
