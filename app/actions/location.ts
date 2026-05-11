"use server";
import { getLocationData } from "@/lib/data/location";

export async function lookupLocation(zip: string) {
  return getLocationData(zip.trim());
}
