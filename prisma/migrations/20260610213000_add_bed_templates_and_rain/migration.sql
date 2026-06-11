-- Bed templates (curated + user-saved) and the last-rain tracker for the
-- watering heuristic.

-- CreateTable
CREATE TABLE "BedTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "gridCols" INTEGER NOT NULL,
    "gridRows" INTEGER NOT NULL,
    "cellSizeIn" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BedTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TemplateAssignment" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "row" INTEGER NOT NULL,
    "col" INTEGER NOT NULL,
    "plantId" TEXT NOT NULL,

    CONSTRAINT "TemplateAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BedTemplate_userId_idx" ON "BedTemplate"("userId");
CREATE INDEX "TemplateAssignment_templateId_idx" ON "TemplateAssignment"("templateId");

-- AddForeignKey
ALTER TABLE "BedTemplate" ADD CONSTRAINT "BedTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TemplateAssignment" ADD CONSTRAINT "TemplateAssignment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "BedTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TemplateAssignment" ADD CONSTRAINT "TemplateAssignment_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "PlantLibrary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: watering heuristic tracker
ALTER TABLE "WeatherCache" ADD COLUMN "lastRainAt" TIMESTAMP(3);

-- ── Curated starter templates ────────────────────────────────────────────────
-- userId NULL = built-in. Plant ids resolved by seed-library name at apply
-- time of this migration; a missing name simply contributes no assignment.

INSERT INTO "BedTemplate" ("id", "userId", "name", "description", "gridCols", "gridRows", "cellSizeIn") VALUES
  ('tpl_salsa',   NULL, 'Salsa Garden',  'Tomatoes, peppers, onions and cilantro — everything but the lime.', 4, 4, 12),
  ('tpl_sisters', NULL, 'Three Sisters', 'Corn, beans and squash, the classic companion trio.',               4, 4, 12),
  ('tpl_herbs',   NULL, 'Kitchen Herbs', 'The everyday snipping bed: basil, parsley, cilantro and friends.',  4, 2, 12),
  ('tpl_salad',   NULL, 'Salad Bed',     'Quick greens and crunchy roots for repeat sowing.',                 4, 2, 12),
  ('tpl_pizza',   NULL, 'Pizza Garden',  'Tomato, pepper, onion, basil and oregano — sauce on the hoof.',     4, 4, 12);

INSERT INTO "TemplateAssignment" ("id", "templateId", "row", "col", "plantId")
SELECT 'ta_' || v.tpl || '_' || v.row || '_' || v.col, 'tpl_' || v.tpl, v.row, v.col, p.id
FROM (VALUES
  -- Salsa Garden 4x4
  ('salsa', 0, 0, 'Tomato'), ('salsa', 0, 1, 'Tomato'), ('salsa', 0, 2, 'Bell Pepper'), ('salsa', 0, 3, 'Bell Pepper'),
  ('salsa', 1, 0, 'Onion'), ('salsa', 1, 1, 'Onion'), ('salsa', 1, 2, 'Onion'), ('salsa', 1, 3, 'Onion'),
  ('salsa', 2, 0, 'Cilantro'), ('salsa', 2, 1, 'Cilantro'), ('salsa', 2, 2, 'Basil'), ('salsa', 2, 3, 'Basil'),
  ('salsa', 3, 0, 'Marigold'), ('salsa', 3, 1, 'Tomato'), ('salsa', 3, 2, 'Tomato'), ('salsa', 3, 3, 'Marigold'),
  -- Three Sisters 4x4 (zucchini anchors claim 2x2 blocks on the bottom half)
  ('sisters', 0, 0, 'Corn'), ('sisters', 0, 1, 'Corn'), ('sisters', 0, 2, 'Corn'), ('sisters', 0, 3, 'Corn'),
  ('sisters', 1, 0, 'Bean'), ('sisters', 1, 1, 'Bean'), ('sisters', 1, 2, 'Bean'), ('sisters', 1, 3, 'Bean'),
  ('sisters', 2, 1, 'Zucchini'), ('sisters', 2, 3, 'Zucchini'),
  -- Kitchen Herbs 4x2
  ('herbs', 0, 0, 'Basil'), ('herbs', 0, 1, 'Parsley'), ('herbs', 0, 2, 'Cilantro'), ('herbs', 0, 3, 'Oregano'),
  ('herbs', 1, 0, 'Thyme'), ('herbs', 1, 1, 'Basil'), ('herbs', 1, 2, 'Cilantro'), ('herbs', 1, 3, 'Parsley'),
  -- Salad Bed 4x2
  ('salad', 0, 0, 'Lettuce'), ('salad', 0, 1, 'Lettuce'), ('salad', 0, 2, 'Lettuce'), ('salad', 0, 3, 'Spinach'),
  ('salad', 1, 0, 'Arugula'), ('salad', 1, 1, 'Carrot'), ('salad', 1, 2, 'Carrot'), ('salad', 1, 3, 'Radish'),
  -- Pizza Garden 4x4
  ('pizza', 0, 0, 'Tomato'), ('pizza', 0, 1, 'Tomato'), ('pizza', 0, 2, 'Bell Pepper'), ('pizza', 0, 3, 'Bell Pepper'),
  ('pizza', 1, 0, 'Onion'), ('pizza', 1, 1, 'Onion'), ('pizza', 1, 2, 'Basil'), ('pizza', 1, 3, 'Basil'),
  ('pizza', 2, 0, 'Oregano'), ('pizza', 2, 1, 'Oregano'), ('pizza', 2, 2, 'Parsley'), ('pizza', 2, 3, 'Parsley'),
  ('pizza', 3, 0, 'Marigold'), ('pizza', 3, 1, 'Tomato'), ('pizza', 3, 2, 'Tomato'), ('pizza', 3, 3, 'Marigold')
) AS v(tpl, row, col, name)
CROSS JOIN LATERAL (
  SELECT id FROM "PlantLibrary"
  WHERE name = v.name AND source = 'seed' AND "customForUserId" IS NULL
  LIMIT 1
) p;
