import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export type LayoutAssignment = {
  row: number;
  col: number;
  plantId: string;
  plantName: string;
  reasoning: string;
};

type BedContext = {
  widthFt: number;
  heightFt: number;
  gridCols: number;
  gridRows: number;
  cellSizeIn: number;
  cells: {
    row: number;
    col: number;
    sunLevel: string;
    isOccupied: boolean;
  }[];
};

type WishlistPlant = {
  id: string;
  name: string;
  spacingInches: number | null;
  sunRequirement: string | null;
  plantFamily: string | null;
};

type CompanionEntry = {
  plant1Name: string;
  plant2Name: string;
  type: "BENEFICIAL" | "HARMFUL";
  notes: string | null;
};

type GardenContext = {
  usdaZone: string | null;
  lastFrostDate: string | null;
  seasonName: string;
};

export async function generateBedLayout(
  bed: BedContext,
  wishlist: WishlistPlant[],
  companions: CompanionEntry[],
  garden: GardenContext
): Promise<LayoutAssignment[]> {
  const emptyCells = bed.cells.filter((c) => !c.isOccupied);

  const sunMap = bed.cells
    .map((c) => `(${c.row},${c.col}): ${c.sunLevel.replace(/_/g, " ").toLowerCase()}`)
    .join(", ");

  const wishlistText = wishlist
    .map(
      (p) =>
        `- ${p.name} (spacing: ${p.spacingInches ?? "unknown"}", sun: ${p.sunRequirement?.replace(/_/g, " ").toLowerCase() ?? "any"}, family: ${p.plantFamily ?? "unknown"})`
    )
    .join("\n");

  const companionText =
    companions.length > 0
      ? companions
          .map(
            (c) =>
              `- ${c.plant1Name} ↔ ${c.plant2Name}: ${c.type.toLowerCase()}${c.notes ? ` (${c.notes})` : ""}`
          )
          .join("\n")
      : "None known for these plants.";

  const prompt = `You are an expert garden layout planner. Suggest an optimal arrangement for the following plants in this raised bed.

Bed: ${bed.widthFt}ft × ${bed.heightFt}ft, ${bed.gridCols} columns × ${bed.gridRows} rows, ${bed.cellSizeIn}" cells
Empty cells available: ${emptyCells.length} of ${bed.cells.length} total

Sun mapping (row,col → level):
${sunMap}

Plants to place:
${wishlistText}

Companion relationships:
${companionText}

Garden: Zone ${garden.usdaZone ?? "unknown"}, last frost ${garden.lastFrostDate ?? "unknown"}
Season: ${garden.seasonName}

Rules:
1. Only place plants in empty cells
2. Match sun requirements — full sun plants in full sun cells, shade plants in shaded cells; partial sun/shade can flex
3. Respect spacing — cells are ${bed.cellSizeIn}" apart; if spacing > ${bed.cellSizeIn}", leave buffer cells
4. Maximize beneficial companions, separate harmful ones
5. Only place as many plants as there are suitable empty cells

Return ONLY valid JSON in this exact format, no other text:
{"assignments":[{"row":0,"col":0,"plantId":"<id>","plantName":"<name>","reasoning":"<1 sentence>"}]}

If a plant cannot be placed due to spacing or sun constraints, omit it. Row and col are 0-indexed.`;

  const message = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  // Extract JSON even if there's surrounding text
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in Claude response");

  const parsed = JSON.parse(match[0]) as { assignments: LayoutAssignment[] };

  // Validate: only accept empty cells
  const emptyCellKeys = new Set(emptyCells.map((c) => `${c.row},${c.col}`));
  return parsed.assignments.filter((a) => emptyCellKeys.has(`${a.row},${a.col}`));
}
