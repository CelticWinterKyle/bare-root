"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Leaf, Grid2x2, Sprout, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { searchEverything, type SearchResults } from "@/app/actions/search";

const EMPTY: SearchResults = { plants: [], beds: [], plantings: [] };

/**
 * Global search: ⌘K / Ctrl-K anywhere, or the search trigger in the
 * sidebar/header. Three grouped result sets — plants, beds, plantings —
 * each row deep-linking. Deliberately tiny: type, pick, go.
 */
export function GlobalSearch({ trigger }: { trigger: "sidebar" | "icon" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [isSearching, startSearch] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function handleChange(q: string) {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults(EMPTY);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startSearch(async () => {
        try {
          setResults(await searchEverything(q));
        } catch {
          setResults(EMPTY);
        }
      });
    }, 250);
  }

  function go(href: string) {
    setOpen(false);
    setQuery("");
    setResults(EMPTY);
    router.push(href);
  }

  const hasAny = results.plants.length + results.beds.length + results.plantings.length > 0;

  return (
    <>
      {trigger === "sidebar" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors hover:bg-[#F4F4EC]"
          style={{ color: "#6B6B5A", border: "1px solid #E4E4DC", background: "#FDFDF8" }}
        >
          <Search className="w-3.5 h-3.5" />
          <span className="flex-1 text-left text-xs">Search…</span>
          <kbd
            style={{
              fontFamily: "var(--font-mono)", fontSize: 9, padding: "2px 5px",
              borderRadius: 4, background: "#F4F4EC", border: "1px solid #E4E4DC", color: "#ADADAA",
            }}
          >
            ⌘K
          </kbd>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Search"
          className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-[#F4F4EC]"
          style={{ color: "#6B6B5A" }}
        >
          <Search className="w-4.5 h-4.5 w-[18px] h-[18px]" />
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md p-0 gap-0" style={{ background: "#FDFDF8" }}>
          <DialogTitle className="sr-only">Search</DialogTitle>
          <div className="relative" style={{ borderBottom: "1px solid #E4E4DC" }}>
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ADADAA]" />
            <input
              autoFocus
              value={query}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="Search plants, beds, plantings…"
              className="w-full pl-11 pr-4 py-3.5 text-sm bg-transparent focus:outline-none"
              style={{ color: "#111109" }}
            />
            {isSearching && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#ADADAA]" />
            )}
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {!hasAny ? (
              <p className="text-sm text-center py-8" style={{ color: "#ADADAA" }}>
                {query.trim().length >= 2 && !isSearching
                  ? "Nothing found"
                  : "Type to search your garden"}
              </p>
            ) : (
              <>
                {results.plantings.length > 0 && (
                  <Group label="In your garden">
                    {results.plantings.map((p) => (
                      <Row
                        key={p.id}
                        icon={<Sprout className="w-3.5 h-3.5" style={{ color: "#3A6B20" }} />}
                        title={`${p.plantName}${p.variety ? ` · ${p.variety}` : ""}`}
                        sub={`Bed ${p.bedName}`}
                        onClick={() => go(`/garden/${p.gardenId}/beds/${p.bedId}`)}
                      />
                    ))}
                  </Group>
                )}
                {results.beds.length > 0 && (
                  <Group label="Beds">
                    {results.beds.map((b) => (
                      <Row
                        key={b.id}
                        icon={<Grid2x2 className="w-3.5 h-3.5" style={{ color: "#A07640" }} />}
                        title={b.name}
                        sub={b.gardenName}
                        onClick={() => go(`/garden/${b.gardenId}/beds/${b.id}`)}
                      />
                    ))}
                  </Group>
                )}
                {results.plants.length > 0 && (
                  <Group label="Plant library">
                    {results.plants.map((p) => (
                      <Row
                        key={p.id}
                        icon={<Leaf className="w-3.5 h-3.5" style={{ color: "#7DA84E" }} />}
                        title={p.name}
                        sub={p.category.toLowerCase()}
                        onClick={() => go(`/plants/${p.id}`)}
                      />
                    ))}
                  </Group>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <p
        className="px-2 py-1"
        style={{
          fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em",
          textTransform: "uppercase", color: "#ADADAA",
        }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

function Row({
  icon,
  title,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left transition-colors hover:bg-[#F4F4EC]"
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium truncate" style={{ color: "#111109" }}>
          {title}
        </span>
        <span className="block text-xs truncate" style={{ color: "#6B6B5A" }}>
          {sub}
        </span>
      </span>
    </button>
  );
}
