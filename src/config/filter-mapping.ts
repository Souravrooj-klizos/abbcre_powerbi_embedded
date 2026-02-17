/**
 * Filter-field mapping between Power BI report columns and ArcGIS layer attributes.
 *
 * From the browser console logs we know:
 *
 * Power BI tables/columns:
 *   table="NC_Permits", column="County Lebel"  → value like "📍   Forsyth"
 *
 * ArcGIS layers and fields:
 *   "NC_Permits_Cleaned"      → County, Status, Type, Category, State
 *   "NC_Dentists_All merged"  → Lebel, Type, Speciality, State
 *   "New overlay county"      → County, State, Historic_5_Year_Growth___,
 *                                Historic_Growth_Category, ...
 *   "North Carolina State and County Boundary Polygons" → County, FIPS, ...
 */

export type FieldMapping = {
  /** Power BI dataset table name (case-sensitive). */
  powerbiTable: string;
  /** Power BI column name inside that table. */
  powerbiColumn: string;
  /** ArcGIS layer title. Leave empty to target ALL FeatureLayers. */
  arcgisLayerTitle?: string;
  /** ArcGIS FeatureLayer attribute field name. */
  arcgisField: string;
  /**
   * Optional transform applied to the Power BI value before it becomes
   * part of the WHERE clause. Use this to strip emoji prefixes, trim
   * whitespace, etc.
   */
  transformValue?: (raw: string | number) => string | number;
};

/** Strip leading emoji/pin icon and extra whitespace: "📍   Forsyth" → "Forsyth" */
function stripEmojiPrefix(raw: string | number): string {
  if (typeof raw !== "string") return raw as unknown as string;
  return raw
    .replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\ufe0f]+/gu, "")
    .trim();
}

/**
 * Actual mappings based on this project's data.
 *
 * The Power BI slicer "County" sends:
 *   table = "NC_Permits"
 *   column = "County Lebel"
 *   value = "📍   Forsyth"   (emoji + spaces + county name)
 *
 * We map that to different ArcGIS fields depending on which layer:
 *   - Permits & boundary layers have a "County" field
 *   - Dentists layer has a "Lebel" field (which stores county names)
 */
export const FIELD_MAPPINGS: FieldMapping[] = [
  // County slicer → Permits layer
  {
    powerbiTable: "NC_Permits",
    powerbiColumn: "County Lebel",
    arcgisLayerTitle: "NC_Permits_Cleaned",
    arcgisField: "County",
    transformValue: stripEmojiPrefix,
  },
  // County slicer → Dentists layer (field is called "Lebel" in ArcGIS)
  {
    powerbiTable: "NC_Permits",
    powerbiColumn: "County Lebel",
    arcgisLayerTitle: "NC_Dentists_All merged",
    arcgisField: "Lebel",
    transformValue: stripEmojiPrefix,
  },
  // County slicer → Overlay county layer
  {
    powerbiTable: "NC_Permits",
    powerbiColumn: "County Lebel",
    arcgisLayerTitle: "New overlay county",
    arcgisField: "County",
    transformValue: stripEmojiPrefix,
  },
  // County slicer → State & County Boundary layer
  {
    powerbiTable: "NC_Permits",
    powerbiColumn: "County Lebel",
    arcgisLayerTitle: "North Carolina State and County Boundary Polygons",
    arcgisField: "County",
    transformValue: stripEmojiPrefix,
  },
];
