"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lookupLocation } from "@/app/actions/location";
import { completeOnboarding } from "@/app/actions/onboarding";
import { Loader2, MapPin, Leaf, Ruler, Sprout, Check } from "lucide-react";

type Step = 1 | 2 | 3 | 4;

type WizardData = {
  gardenName: string;
  widthFt: string;
  heightFt: string;
  zip: string;
  zone: string;
  lastFrostDate: string | null;
  firstFrostDate: string | null;
  bedName: string;
  bedWidthFt: string;
  bedHeightFt: string;
  cellSizeIn: "12" | "6";
};

const STEPS = [
  { label: "Name", icon: Leaf },
  { label: "Size", icon: Ruler },
  { label: "Location", icon: MapPin },
  { label: "First Bed", icon: Sprout },
];

export function WizardShell() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [data, setData] = useState<WizardData>({
    gardenName: "",
    widthFt: "",
    heightFt: "",
    zip: "",
    zone: "",
    lastFrostDate: null,
    firstFrostDate: null,
    bedName: "Bed 1",
    bedWidthFt: "4",
    bedHeightFt: "8",
    cellSizeIn: "12",
  });
  const [locationState, setLocationState] = useState<
    "idle" | "loading" | "found" | "not-found"
  >("idle");
  const [isPending, startTransition] = useTransition();

  function set(field: keyof WizardData, value: string) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  async function lookupZip() {
    const zip = data.zip.replace(/\D/g, "");
    if (zip.length < 5) return;
    setLocationState("loading");
    const result = await lookupLocation(zip);
    if (result) {
      setData((prev) => ({
        ...prev,
        zone: result.zone,
        lastFrostDate: result.lastFrostDate,
        firstFrostDate: result.firstFrostDate,
      }));
      setLocationState("found");
    } else {
      setLocationState("not-found");
    }
  }

  function submit(skipBed: boolean) {
    startTransition(async () => {
      const gardenId = await completeOnboarding({
        gardenName: data.gardenName.trim(),
        widthFt: parseFloat(data.widthFt),
        heightFt: parseFloat(data.heightFt),
        zip: data.zip,
        zone: data.zone,
        lastFrostDate: data.lastFrostDate,
        firstFrostDate: data.firstFrostDate,
        bed: skipBed
          ? undefined
          : {
              name: data.bedName.trim() || "Bed 1",
              widthFt: parseFloat(data.bedWidthFt),
              heightFt: parseFloat(data.bedHeightFt),
              cellSizeIn: parseInt(data.cellSizeIn) as 12 | 6,
            },
      });
      router.push(`/garden/${gardenId}`);
    });
  }

  const step1Valid = data.gardenName.trim().length > 0;
  const step2Valid =
    parseFloat(data.widthFt) > 0 && parseFloat(data.heightFt) > 0;
  const step3Valid = locationState === "found" || locationState === "not-found";
  const step4Valid =
    parseFloat(data.bedWidthFt) > 0 && parseFloat(data.bedHeightFt) > 0;

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Progress */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((s, i) => {
          const n = (i + 1) as Step;
          const done = step > n;
          const active = step === n;
          return (
            <div key={s.label} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  done
                    ? "bg-[#2D5016] text-white"
                    : active
                    ? "bg-[#6B8F47] text-white"
                    : "bg-[#E8E2D9] text-[#9E9890]"
                }`}
              >
                {done ? <Check className="w-4 h-4" /> : n}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-8 h-px ${
                    step > n ? "bg-[#2D5016]" : "bg-[#E8E2D9]"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {step > 1 && (
        <p className="text-center text-xs text-[#9E9890] mb-4">
          ✓ Your progress is saved — you can continue anytime.
        </p>
      )}

      <div className="bg-white rounded-2xl border border-[#E8E2D9] shadow-sm overflow-hidden">
        {/* Step 1 — Garden name */}
        {step === 1 && (
          <div className="p-8">
            <h2 className="font-display text-2xl font-semibold text-[#1C1C1A] mb-1">
              What's your garden called?
            </h2>
            <p className="text-[#6B6560] text-sm mb-6">
              Pick a name that helps you recognize this space.
            </p>
            <div className="space-y-2">
              <Label htmlFor="gardenName">Garden name</Label>
              <Input
                id="gardenName"
                placeholder="My Backyard Garden"
                value={data.gardenName}
                onChange={(e) => set("gardenName", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && step1Valid) setStep(2);
                }}
                autoFocus
              />
            </div>
            <div className="mt-8 flex justify-end">
              <Button
                onClick={() => setStep(2)}
                disabled={!step1Valid}
                className="bg-[#2D5016] hover:bg-[#3d6b1e] text-white"
              >
                Continue →
              </Button>
            </div>
          </div>
        )}

        {/* Step 2 — Dimensions */}
        {step === 2 && (
          <div className="p-8">
            <h2 className="font-display text-2xl font-semibold text-[#1C1C1A] mb-1">
              How big is your garden space?
            </h2>
            <p className="text-[#6B6560] text-sm mb-6">
              The total outdoor area — you'll add individual raised beds inside it.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="width">Width (feet)</Label>
                <Input
                  id="width"
                  type="number"
                  min="1"
                  max="500"
                  placeholder="20"
                  value={data.widthFt}
                  onChange={(e) => set("widthFt", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height">Length (feet)</Label>
                <Input
                  id="height"
                  type="number"
                  min="1"
                  max="500"
                  placeholder="30"
                  value={data.heightFt}
                  onChange={(e) => set("heightFt", e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-[#9E9890] mt-3">
              Don't know exactly? A rough estimate works fine — you can adjust later.
            </p>
            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                ← Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!step2Valid}
                className="bg-[#2D5016] hover:bg-[#3d6b1e] text-white"
              >
                Continue →
              </Button>
            </div>
          </div>
        )}

        {/* Step 3 — Location */}
        {step === 3 && (
          <div className="p-8">
            <h2 className="font-display text-2xl font-semibold text-[#1C1C1A] mb-1">
              Where is your garden?
            </h2>
            <p className="text-[#6B6560] text-sm mb-6">
              Your zip code tells us your growing zone and frost dates.
            </p>
            <div className="space-y-2">
              <Label htmlFor="zip">US zip code</Label>
              <div className="flex gap-2">
                <Input
                  id="zip"
                  placeholder="90210"
                  maxLength={5}
                  value={data.zip}
                  onChange={(e) => {
                    set("zip", e.target.value);
                    setLocationState("idle");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") lookupZip();
                  }}
                />
                <Button
                  onClick={lookupZip}
                  disabled={data.zip.replace(/\D/g, "").length < 5 || locationState === "loading"}
                  variant="outline"
                  className="border-[#E8E2D9] shrink-0"
                >
                  {locationState === "loading" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Look up"
                  )}
                </Button>
              </div>
            </div>

            {locationState === "found" && (
              <div className="mt-4 p-4 bg-[#F5F0E8] rounded-xl border border-[#E8E2D9]">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="w-4 h-4 text-[#4A7C2F]" />
                  <span className="text-sm font-medium text-[#2D5016]">
                    Zone {data.zone}
                  </span>
                </div>
                <div className="text-sm text-[#6B6560] space-y-1">
                  {data.lastFrostDate && (
                    <p>Last frost: {formatFrostDate(data.lastFrostDate)}</p>
                  )}
                  {data.firstFrostDate && (
                    <p>First frost: {formatFrostDate(data.firstFrostDate)}</p>
                  )}
                </div>
              </div>
            )}

            {locationState === "not-found" && (
              <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
                <p className="text-sm text-amber-800">
                  Zip code not found. You can continue and set your zone manually later.
                </p>
              </div>
            )}

            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>
                ← Back
              </Button>
              <Button
                onClick={() => setStep(4)}
                disabled={!step3Valid}
                className="bg-[#2D5016] hover:bg-[#3d6b1e] text-white"
              >
                Continue →
              </Button>
            </div>
          </div>
        )}

        {/* Step 4 — First bed */}
        {step === 4 && (
          <div className="p-8">
            <h2 className="font-display text-2xl font-semibold text-[#1C1C1A] mb-1">
              Add your first raised bed
            </h2>
            <p className="text-[#6B6560] text-sm mb-6">
              You can add more beds and adjust positions on the garden canvas.
            </p>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bedName">Bed name</Label>
                <Input
                  id="bedName"
                  placeholder="Bed 1"
                  value={data.bedName}
                  onChange={(e) => set("bedName", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bedWidth">Width (feet)</Label>
                  <Input
                    id="bedWidth"
                    type="number"
                    min="1"
                    max="50"
                    placeholder="4"
                    value={data.bedWidthFt}
                    onChange={(e) => set("bedWidthFt", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bedHeight">Length (feet)</Label>
                  <Input
                    id="bedHeight"
                    type="number"
                    min="1"
                    max="50"
                    placeholder="8"
                    value={data.bedHeightFt}
                    onChange={(e) => set("bedHeightFt", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Grid resolution</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["12", "6"] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => set("cellSizeIn", size)}
                      className={`p-3 rounded-lg border text-sm text-left transition-colors ${
                        data.cellSizeIn === size
                          ? "border-[#2D5016] bg-[#F5F0E8] text-[#2D5016]"
                          : "border-[#E8E2D9] text-[#6B6560] hover:border-[#6B8F47]"
                      }`}
                    >
                      <div className="font-medium">{size === "12" ? "1 ft squares" : "6 in squares"}</div>
                      <div className="text-xs mt-0.5 text-[#9E9890]">
                        {size === "12"
                          ? "Standard (SFG method)"
                          : "More detail, smaller cells"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-between items-center">
              <Button variant="ghost" onClick={() => setStep(3)}>
                ← Back
              </Button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => submit(true)}
                  disabled={isPending}
                  className="text-sm text-[#6B6560] hover:text-[#1C1C1A] underline-offset-2 hover:underline"
                >
                  Skip for now
                </button>
                <Button
                  onClick={() => submit(false)}
                  disabled={isPending || !step4Valid}
                  className="bg-[#2D5016] hover:bg-[#3d6b1e] text-white"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Setting up…
                    </>
                  ) : (
                    "Finish setup →"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatFrostDate(mmdd: string): string {
  const [m, d] = mmdd.split("-").map(Number);
  return new Date(2000, m - 1, d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}
