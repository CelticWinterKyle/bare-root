-- CreateTable
CREATE TABLE "PlantingCell" (
    "plantingId" TEXT NOT NULL,
    "cellId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PlantingCell_pkey" PRIMARY KEY ("plantingId","cellId")
);

-- CreateIndex
CREATE INDEX "PlantingCell_cellId_idx" ON "PlantingCell"("cellId");

-- AddForeignKey
ALTER TABLE "PlantingCell" ADD CONSTRAINT "PlantingCell_plantingId_fkey" FOREIGN KEY ("plantingId") REFERENCES "Planting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantingCell" ADD CONSTRAINT "PlantingCell_cellId_fkey" FOREIGN KEY ("cellId") REFERENCES "Cell"("id") ON DELETE CASCADE ON UPDATE CASCADE;
