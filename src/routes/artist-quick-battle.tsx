import { createFileRoute } from "@tanstack/react-router";
import { Check, CheckCircle2, Download, FastForward, Gift, Pause, Play, RotateCcw, Send, Sparkles, Trophy, Upload, Vote } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, AudioEmbed, Panel, PlayButton, Waveform } from "@/components/arena/bits";
import { BattleCountdown, BattleParticipants, BattleRating } from "@/components/arena/battle-controls";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ARTIST_ROSTER, BALLOT_SEED, DEMO_SPEED, FORMAT_LABEL, PERFORMANCE_LIMIT, PROMPT, UPLOAD_WINDOW, ballotLabel, canRate, closeBallot, drawBeats, rankEntries, seconds, segmentBounds, shouldCloseUpload, stagesFor, submittedIds, uploadSchedule, uploadStatus, validateAudioFile, type BattleFormat } from "@/lib/artist-battle";
import { excerptWav } from "@/lib/synth";
import { byId, me } from "@/lib/data";
import { fmt, usePlayer, type Track } from "@/lib/player";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/artist-quick-battle")({
  validateSearch: (search: Record<string, unknown>): { format?: "song" } => (search.format === "song" ? { format: "song" } : {}),
  head: () => ({ meta: [
    { title: "Artist Quick Battle — The Arena" },
    { name: "description", content: "Two artist formats: a 15-minute creation battle on a shared Crate beat, or Song-for-Song with finished tracks. Phase 1 demo." },
    { property: "og:title", content: "Artist Quick Battle — The Arena" },
    { property: "og:description", content: "Creation Battle or Song-for-Song: upload, judge and see results in the Phase 1 artist battle demo." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ArtistQuickBattle,
});

