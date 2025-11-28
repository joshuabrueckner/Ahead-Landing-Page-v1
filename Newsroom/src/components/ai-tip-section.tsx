"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Lightbulb, PlusCircle } from "lucide-react";
import { Separator } from "./ui/separator";

const initialTips = [
  "Start with small, well-defined AI projects to build momentum and gain experience before tackling more complex initiatives.",
  "Ensure your training data is clean, diverse, and representative of the real-world scenarios your AI will encounter.",
  "Regularly audit your AI models for bias and fairness to ensure they are making equitable decisions.",
  "Implement a human-in-the-loop system for critical AI applications to allow for manual review and intervention.",
  "Focus on the user experience (UX) of your AI-powered features. A powerful model is useless if it's not intuitive to use.",
];

type AiTipSectionProps = {
  selectedTip: string;
  setSelectedTip: (tip: string) => void;
};

export default function AiTipSection({ selectedTip, setSelectedTip }: AiTipSectionProps) {
  const [tips, setTips] = useState<string[]>(initialTips);
  const [newTip, setNewTip] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleAddTip = () => {
    if (newTip.trim()) {
      const updatedTips = [newTip.trim(), ...tips];
      setTips(updatedTips);
      setSelectedTip(newTip.trim());
      setNewTip("");
      setIsDialogOpen(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <Lightbulb className="w-8 h-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl font-headline">Daily AI Tip</CardTitle>
              <CardDescription>Select one tip for the newsletter.</CardDescription>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Tip
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a Custom Tip</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="tip">Your AI Tip</Label>
                  <Textarea id="tip" value={newTip} onChange={(e) => setNewTip(e.target.value)} placeholder="Enter your custom tip here..." />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleAddTip}>Add Tip</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <RadioGroup value={selectedTip} onValueChange={setSelectedTip}>
          <div className="space-y-4">
            {tips.map((tip, index) => (
              <div key={index}>
                <div className="flex items-center gap-4">
                  <RadioGroupItem value={tip} id={`tip-${index}`} className="mt-1" />
                  <Label htmlFor={`tip-${index}`} className="font-normal text-foreground leading-snug cursor-pointer">
                    {tip}
                  </Label>
                </div>
                {index < tips.length - 1 && <Separator className="mt-4" />}
              </div>
            ))}
          </div>
        </RadioGroup>
      </CardContent>
      <CardFooter className="bg-secondary/50 p-4 border-t text-sm text-muted-foreground flex justify-center">
        <span>{selectedTip ? "1 of 1 tip selected." : "No tip selected."}</span>
      </CardFooter>
    </Card>
  );
}
