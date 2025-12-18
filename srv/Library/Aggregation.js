// helpers/aggregationStages.js

/**
 * MATCH stage builder
 */
function buildMatchStage(query = {}) {
  if (!query || Object.keys(query).length === 0) return null;
  return { $match: query };
}

/**
 * LOOKUP stage builders
 */
function buildLookupStage(from, localField, foreignField, as) {
  return {
    $lookup: {
      from,
      localField,
      foreignField,
      as,
    },
  };
}

function buildLookupWithPipeline(from, letVars, pipeline, as) {
  return {
    $lookup: {
      from,
      let: letVars,
      pipeline,
      as,
    },
  };
}

function buildLookupWithFilter(
  from,
  localField,
  foreignField,
  as,
  filter = {}
) {
  return buildLookupWithPipeline(
    from,
    { [localField]: `$${localField}` },
    [
      {
        $match: {
          $expr: { $eq: [`$${foreignField}`, `$$${localField}`] },
          ...filter,
        },
      },
    ],
    as
  );
}

function buildLookupWithProjection(
  from,
  localField,
  foreignField,
  as,
  projection = {}
) {
  return buildLookupWithPipeline(
    from,
    { [localField]: `$${localField}` },
    [
      { $match: { $expr: { $eq: [`$${foreignField}`, `$$${localField}`] } } },
      { $project: projection },
    ],
    as
  );
}

/**
 * ADD FIELDS stage builders
 */
function buildAddFieldsStage(fields = {}) {
  if (!fields || Object.keys(fields).length === 0) return null;
  return { $addFields: fields };
}

function buildExtractFirstField(arrayField, outputField) {
  return buildAddFieldsStage({
    [outputField]: { $arrayElemAt: [`$${arrayField}`, 0] },
  });
}

function buildCalculateTotal(
  itemsField,
  quantityField,
  priceField,
  outputField
) {
  return buildAddFieldsStage({
    [outputField]: {
      $reduce: {
        input: `$${itemsField}`,
        initialValue: 0,
        in: {
          $add: [
            "$$value",
            {
              $multiply: [
                { $toDouble: { $ifNull: [`$$this.${quantityField}`, 0] } },
                { $toDouble: { $ifNull: [`$$this.${priceField}`, 0] } },
              ],
            },
          ],
        },
      },
    },
  });
}

function buildCountField(arrayField, outputField) {
  return buildAddFieldsStage({
    [outputField]: { $size: { $ifNull: [`$${arrayField}`, []] } },
  });
}

/**
 * PROJECT stage builders
 */
function buildProjectStage(projection = {}) {
  if (!projection || Object.keys(projection).length === 0) return null;
  return { $project: projection };
}

function buildIncludeFields(fields = []) {
  const projection = {};
  fields.forEach((field) => {
    projection[field] = 1;
  });
  return buildProjectStage(projection);
}

function buildExcludeFields(fields = []) {
  const projection = {};
  fields.forEach((field) => {
    projection[field] = 0;
  });
  return buildProjectStage(projection);
}

/**
 * SORT stage builder
 */
function buildSortStage(sortOrder = {}) {
  if (!sortOrder || Object.keys(sortOrder).length === 0) return null;
  return { $sort: sortOrder };
}

/**
 * PAGINATION stage builders
 */
function buildSkipStage(skip = 0) {
  if (skip <= 0) return null;
  return { $skip: skip };
}

function buildLimitStage(limit = 0) {
  if (limit <= 0) return null;
  return { $limit: limit };
}

/**
 * GROUP stage builder
 */
function buildGroupStage(groupConfig = {}) {
  if (!groupConfig || Object.keys(groupConfig).length === 0) return null;
  return { $group: groupConfig };
}

/**
 * UNWIND stage builder
 */
function buildUnwindStage(field, preserveNullAndEmptyArrays = true) {
  return {
    $unwind: {
      path: `$${field}`,
      preserveNullAndEmptyArrays,
    },
  };
}

/**
 * FACET stage builder
 */
function buildFacetStage(facetConfig = {}) {
  if (!facetConfig || Object.keys(facetConfig).length === 0) return null;
  return { $facet: facetConfig };
}

/**
 * REPLACE ROOT stage builder
 */
function buildReplaceRootStage(newRoot) {
  if (!newRoot) return null;
  return { $replaceRoot: newRoot };
}

/**
 * UNSET stage builder
 */
function buildUnsetStage(fields) {
  return fields && fields.length > 0 ? { $unset: fields } : {};
}

/**
 * COUNT stage builder (for count pipeline)
 */
function buildCountStage(countField = "total") {
  return { $count: countField };
}

/**
 * Utility to filter out null stages
 */
function buildPipeline(stages = []) {
  return stages.filter((stage) => {
    if (stage === null || stage === undefined) return false;
    if (typeof stage === "object" && Object.keys(stage).length === 0)
      return false;
    return true;
  });
}
// helpers/odataFilterUtils.js

/**
 * Extract field value from OData $filter string
 * @param {string} filterString - The $filter string
 * @param {string} fieldName - The field name to extract
 * @returns {string|null} - The field value or null if not found
 */
function extractFieldValue(filterString, fieldName) {
  if (!filterString || !fieldName) return null;

  const filterParts = filterString.split(" ");
  const fieldIndex = filterParts.indexOf(fieldName);

  if (fieldIndex !== -1 && filterParts.length > fieldIndex + 2) {
    let fieldValue = filterParts[fieldIndex + 2];
    // Remove surrounding quotes
    fieldValue = fieldValue.replace(/^'|'$/g, "").replace(/^"|"$/g, "");
    return fieldValue;
  }

  return null;
}

/**
 * Remove a specific field condition from OData $filter string
 * @param {string} filterString - The $filter string
 * @param {string} fieldName - The field name to remove
 * @returns {string} - The filter string without the specified field condition
 */
function removeFieldFromFilter(filterString, fieldName) {
  if (!filterString || !fieldName) return filterString || "";

  const filterParts = filterString.split(" ");
  const fieldIndex = filterParts.indexOf(fieldName);

  if (fieldIndex === -1) return filterString;

  // Remove fieldName, operator, and the value
  const newParts = [...filterParts];
  newParts.splice(fieldIndex, 3);

  // Clean up resulting operators
  let cleanedFilter = newParts.join(" ").trim();

  // Remove 'and' if it's now at the beginning
  cleanedFilter = cleanedFilter.replace(/^\s*and\s+/i, "");
  // Remove 'and' if it's now at the end
  cleanedFilter = cleanedFilter.replace(/\s+and\s*$/i, "");
  // Remove standalone 'and' (if only condition was removed)
  cleanedFilter = cleanedFilter.replace(/^\s*and\s*$/i, "");

  return cleanedFilter.trim();
}

/**
 * Extract multiple field values from OData $filter
 * @param {string} filterString - The $filter string
 * @param {string[]} fieldNames - Array of field names to extract
 * @returns {Object} - Object with field names as keys and their values
 */
function extractMultipleFieldValues(filterString, fieldNames) {
  const result = {};

  if (!filterString || !fieldNames || !Array.isArray(fieldNames)) {
    return result;
  }

  fieldNames.forEach((fieldName) => {
    const value = extractFieldValue(filterString, fieldName);
    if (value !== null) {
      result[fieldName] = value;
    }
  });

  return result;
}

/**
 * Remove multiple fields from OData $filter and return remaining filters
 * @param {string} filterString - The $filter string
 * @param {string[]} fieldNames - Array of field names to remove
 * @returns {string} - The filter string without the specified fields
 */
function removeMultipleFieldsFromFilter(filterString, fieldNames) {
  if (!filterString || !fieldNames || !Array.isArray(fieldNames)) {
    return filterString || "";
  }

  let result = filterString;
  fieldNames.forEach((fieldName) => {
    result = removeFieldFromFilter(result, fieldName);
  });

  return result;
}

/**
 * Parse remaining filters after removing specific fields
 * @param {string} filterString - The remaining filter string
 * @returns {Object} - MongoDB query object
 */
async function parseRemainingFilters(filterString) {
  if (!filterString) return {};

  const mockReq = {
    _: {
      req: {
        query: {
          $filter: filterString,
        },
      },
    },
  };

  try {
    const { buildQuery } = require("./Mongoquery"); // Adjust path as needed
    const result = await buildQuery(mockReq);
    return result.query;
  } catch (error) {
    console.error("Error parsing remaining filters:", error);
    return {};
  }
}

module.exports = {
  // Core stage builders
  buildMatchStage,
  buildLookupStage,
  buildLookupWithPipeline,
  buildLookupWithFilter,
  buildLookupWithProjection,
  buildAddFieldsStage,
  buildProjectStage,
  buildSortStage,
  buildSkipStage,
  buildLimitStage,
  buildGroupStage,
  buildUnwindStage,
  buildFacetStage,
  buildReplaceRootStage,
  buildCountStage,
  buildUnsetStage,

  // Specialized builders
  buildExtractFirstField,
  buildCalculateTotal,
  buildCountField,
  buildIncludeFields,
  buildExcludeFields,

  // Pipeline utility
  buildPipeline,

  extractFieldValue,
  removeFieldFromFilter,
  extractMultipleFieldValues,
  removeMultipleFieldsFromFilter,
  parseRemainingFilters,
};
