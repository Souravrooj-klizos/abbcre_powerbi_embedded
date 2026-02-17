/**
 * Filter-field mapping between Power BI report columns and ArcGIS layer attributes.
 *
 * HOW TO CONFIGURE:
 *  1. Ask your Power BI engineer which table/column names the report uses
 *     (e.g. table="Properties", column="Region").
 *  2. Ask which ArcGIS layer title + attribute field holds the same data
 *     (e.g. layerTitle="Properties", field="Region" or "REGION").
 *  3. Add one FieldMapping entry per paired field below.
 *
 * If layerTitle is omitted the filter is applied to ALL FeatureLayers in the Web Map.
 */

export type FieldMapping = {
  /** Power BI dataset table name (case-sensitive, must match the report's data model). */
  powerbiTable: string;
  /** Power BI column name inside that table. */
  powerbiColumn: string;
  /** ArcGIS layer title (as shown in the Web Map's layer list). Leave empty to target all layers. */
  arcgisLayerTitle?: string;
  /** ArcGIS FeatureLayer attribute field name. */
  arcgisField: string;
};

/**
 * Default mapping — update these to match your actual data model.
 *
 * Example: if your Power BI table "Properties" has a column "Region",
 * and the ArcGIS FeatureLayer titled "Properties" has a field "Region":
 *
 *   { powerbiTable: "Properties", powerbiColumn: "Region", arcgisLayerTitle: "Properties", arcgisField: "Region" }
 */
export const FIELD_MAPPINGS: FieldMapping[] = [
  // ── Uncomment and edit to match your data ──
  // { powerbiTable: "Properties", powerbiColumn: "Region",   arcgisField: "Region" },
  // { powerbiTable: "Properties", powerbiColumn: "City",     arcgisField: "City" },
  // { powerbiTable: "Properties", powerbiColumn: "Status",   arcgisField: "Status" },
];
