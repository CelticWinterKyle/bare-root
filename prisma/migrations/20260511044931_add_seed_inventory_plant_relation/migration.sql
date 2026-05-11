-- AddForeignKey
ALTER TABLE "SeedInventory" ADD CONSTRAINT "SeedInventory_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "PlantLibrary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
