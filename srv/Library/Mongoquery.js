const cds = require("@sap/cds");

// Simple query builder using raw URL query parameters
async function buildQuery(req, searchFields = []) {
  let query = {};
  let sortOrder = {};
  let selectFields = {};
  let expandFields = [];
  let skip = 0;
  let limit = 1000;

  // Get the entity definition from CAP
  const entity = req.target;
  const elements = entity.elements || [];

  console.log(
    "Entity elements:",
    elements.map((el) => el.name)
  );

  // Get raw query parameters from URL
  const urlParams = req._queryOptions;
  const queryObj = req.query.SELECT;
  console.log("URL Query Parameters:", urlParams);

  // Handle $filter
  if (urlParams?.$filter) {
    console.log("Raw URL filter:", urlParams?.$filter);
    console.log("CAP translated filter:", req.query.SELECT?.where);
    query = parseODataFilter(urlParams?.$filter, elements);
  }

  // Handle $orderby
  if (urlParams?.$orderby) {
    sortOrder = parseODataOrderBy(urlParams?.$orderby, elements);
  }

  // Handle $select
  if (urlParams?.$select) {
    selectFields = parseODataSelect(urlParams?.$select, elements);
  } else if (queryObj.columns) {
    selectFields = parseCDSSelect(queryObj.columns, elements);
  }

  // Handle $expand
  if (urlParams?.$expand) {
    expandFields = parseODataExpand(urlParams?.$expand, elements);
  }

  // Handle $top and $skip
  if (urlParams?.$top) {
    limit = parseInt(urlParams?.$top);
  }
  if (urlParams?.$skip) {
    skip = parseInt(urlParams?.$skip);
  }

  // Apply reasonable limits
  if (limit <= 0) limit = 1000;
  if (limit > 10000) limit = 10000;

  // ---------- FINAL SORT (add _id:1 for index) ----------
  const finalSort = { _id: 1, ...sortOrder };

  console.log("Final MongoDB Query:", {
    query,
    sortOrder: finalSort,
    selectFields,
    expandFields,
    skip,
    limit,
  });
  
  return { query, sortOrder, selectFields, expandFields, skip, limit };
}

// Helper function to check if field exists in elements array
function fieldExists(fieldName, elements = []) {
  return elements.some((element) => element.name === fieldName);
}

// Helper function to get element by name from array
function getElement(fieldName, elements = []) {
  return elements.find((element) => element.name === fieldName);
}

// Parse OData $filter parameter
function parseODataFilter(filterString, elements = []) {
  if (!filterString) return {};
  console.log("Parsing OData filter:", filterString);

  try {
    return parseFilterExpression(filterString.trim(), elements);
  } catch (error) {
    console.error("Error parsing filter:", error);
    return {};
  }
}

function parseFilterExpression(expr, elements = []) {
  // Handle OR operations (lowest precedence)
  const orParts = splitOutsideParentheses(expr, " or ");
  if (orParts.length > 1) {
    const conditions = orParts.map((part) =>
      parseFilterExpression(part.trim(), elements)
    );
    return { $or: conditions.filter((c) => Object.keys(c).length > 0) };
  }

  // Handle AND operations
  const andParts = splitOutsideParentheses(expr, " and ");
  if (andParts.length > 1) {
    const conditions = andParts.map((part) =>
      parseFilterExpression(part.trim(), elements)
    );
    return { $and: conditions.filter((c) => Object.keys(c).length > 0) };
  }

  // Handle parentheses
  if (expr.startsWith("(") && expr.endsWith(")")) {
    return parseFilterExpression(expr.slice(1, -1).trim(), elements);
  }

  // Handle simple conditions and functions
  return parseSimpleCondition(expr, elements);
}

function splitOutsideParentheses(expr, operator) {
  const parts = [];
  let current = "";
  let depth = 0;

  for (let i = 0; i < expr.length; i++) {
    const char = expr[i];

    if (char === "(") depth++;
    if (char === ")") depth--;

    if (depth === 0 && expr.startsWith(operator, i)) {
      parts.push(current.trim());
      current = "";
      i += operator.length - 1;
    } else {
      current += char;
    }
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseSimpleCondition(condition, elements = []) {
  // Handle function calls
  const funcMatch = condition.match(/^(\w+)\(([^)]+)\)$/);
  if (funcMatch) {
    return parseFunctionCall(funcMatch[1], funcMatch[2], elements);
  }

  // Handle comparison operators
  const operators = [
    { op: " eq ", mongo: "=" },
    { op: " ne ", mongo: "$ne" },
    { op: " gt ", mongo: "$gt" },
    { op: " ge ", mongo: "$gte" },
    { op: " lt ", mongo: "$lt" },
    { op: " le ", mongo: "$lte" },
  ];

  for (const { op, mongo } of operators) {
    if (condition.includes(op)) {
      const [left, right] = condition.split(op).map((s) => s.trim());
      const field = left;

      // Validate field exists in entity
      if (elements.length > 0 && !fieldExists(field, elements)) {
        console.warn(`Field '${field}' not found in entity elements`);
      }

      const value = parseValue(right);

      if (mongo === "=") {
        return { [field]: value };
      } else {
        return { [field]: { [mongo]: value } };
      }
    }
  }

  return {};
}

function parseFunctionCall(funcName, argsString, elements = []) {
  const args = parseFunctionArgs(argsString);
  console.log(`Parsing function ${funcName} with args:`, args);

  switch (funcName.toLowerCase()) {
    case "substringof":
      // substringof(pattern, field) - pattern first, field second
      if (args.length === 2) {
        const pattern = args[0].replace(/'|"/g, "");
        const field = args[1];
        console.log(
          `✓ substringof: Looking for '${pattern}' in field '${field}'`
        );
        return { [field]: { $regex: escapeRegex(pattern), $options: "i" } };
      }
      break;

    case "contains":
      // Handle CAP's incorrect translation: contains(pattern, field) instead of contains(field, pattern)
      if (args.length === 2) {
        let field, pattern;

        // Use elements array to identify which arg is the field
        for (let i = 0; i < args.length; i++) {
          const arg = args[i];
          const cleanArg = arg.replace(/'|"/g, "");

          // Check if this argument exists as a field in the entity
          if (fieldExists(cleanArg, elements)) {
            field = cleanArg;
            pattern = args[i === 0 ? 1 : 0].replace(/'|"/g, "");
            break;
          }
        }

        // Fallback if couldn't identify field from elements
        if (!field) {
          // Simple heuristic based on quotes
          const quotedIndex = args.findIndex(
            (arg) =>
              typeof arg === "string" &&
              (arg.includes("'") || arg.includes('"'))
          );
          const unquotedIndex = args.findIndex(
            (arg) =>
              typeof arg === "string" &&
              !arg.includes("'") &&
              !arg.includes('"')
          );

          if (quotedIndex !== -1 && unquotedIndex !== -1) {
            pattern = args[quotedIndex].replace(/'|"/g, "");
            field = args[unquotedIndex];
          } else {
            // Last resort: assume first is pattern, second is field (CAP's behavior)
            pattern = args[0].replace(/'|"/g, "");
            field = args[1];
          }
        }

        if (field && pattern) {
          console.log(
            `✓ contains: Looking for '${pattern}' in field '${field}'`
          );
          return { [field]: { $regex: escapeRegex(pattern), $options: "i" } };
        }
      }
      break;

    case "startswith":
      // startswith(field, value) - field starts with value
      if (args.length === 2) {
        const field = args[0];
        const value = args[1].replace(/'|"/g, "");
        console.log(`✓ startswith: Field '${field}' starts with '${value}'`);
        return { [field]: { $regex: `^${escapeRegex(value)}`, $options: "i" } };
      }
      break;

    case "endswith":
      // endswith(field, value) - field ends with value
      if (args.length === 2) {
        const field = args[0];
        const value = args[1].replace(/'|"/g, "");
        console.log(`✓ endswith: Field '${field}' ends with '${value}'`);
        return { [field]: { $regex: `${escapeRegex(value)}$`, $options: "i" } };
      }
      break;

    default:
      console.warn(`Unsupported function: ${funcName}`);
  }

  return {};
}

function parseFunctionArgs(argsString) {
  const args = [];
  let current = "";
  let inQuotes = false;
  let quoteChar = "";

  for (let i = 0; i < argsString.length; i++) {
    const char = argsString[i];

    if ((char === "'" || char === '"') && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false;
    } else if (char === "," && !inQuotes) {
      const value = parseFunctionArgValue(current.trim());
      if (value !== undefined) args.push(value);
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    const value = parseFunctionArgValue(current.trim());
    if (value !== undefined) args.push(value);
  }

  return args;
}

function parseFunctionArgValue(argStr) {
  argStr = argStr.trim();

  // If it's a quoted string, return the string value
  if (
    (argStr.startsWith("'") && argStr.endsWith("'")) ||
    (argStr.startsWith('"') && argStr.endsWith('"'))
  ) {
    return argStr.slice(1, -1);
  }

  // If it's a field name (no quotes), return it as is
  // Field names in OData functions are not quoted
  return argStr;
}

function parseValue(valueStr) {
  // Remove surrounding quotes
  if (
    (valueStr.startsWith("'") && valueStr.endsWith("'")) ||
    (valueStr.startsWith('"') && valueStr.endsWith('"'))
  ) {
    return valueStr.slice(1, -1);
  }

  // Handle numbers
  if (!isNaN(valueStr) && valueStr !== "") {
    return Number(valueStr);
  }

  // Handle booleans
  if (valueStr === "true") return true;
  if (valueStr === "false") return false;
  if (valueStr === "null") return null;

  // Handle dates (basic support)
  if (
    valueStr.startsWith("datetime") ||
    valueStr.startsWith("date") ||
    valueStr.startsWith("timestamp")
  ) {
    const dateStr = valueStr.replace(/^(datetime|date|timestamp)'|'$/g, "");
    return new Date(dateStr);
  }

  return valueStr;
}

// Parse OData $orderby parameter
function parseODataOrderBy(orderByString, elements = []) {
  if (!orderByString) return {};

  const sort = {};
  const clauses = orderByString.split(",");

  clauses.forEach((clause) => {
    const parts = clause.trim().split(/\s+/);
    const field = parts[0];

    // Validate field exists in entity
    if (elements.length > 0 && !fieldExists(field, elements)) {
      console.warn(`Field '${field}' not found in entity elements for sorting`);
    }

    const order = parts[1]?.toLowerCase() === "desc" ? -1 : 1;

    if (field) {
      sort[field] = order;
    }
  });

  return sort;
}

// Parse OData $select parameter
function parseODataSelect(selectString, elements = []) {
  if (!selectString) return {};

  const projection = {};
  const fields = selectString.split(",");
  let hasWildcard = false;

  fields.forEach((field) => {
    const trimmed = field.trim();
    if (trimmed === "*") {
      hasWildcard = true;
    } else if (trimmed) {
      // Validate field exists in entity
      if (elements.length > 0 && !fieldExists(trimmed, elements)) {
        console.warn(
          `Field '${trimmed}' not found in entity elements for selection`
        );
      }
      projection[trimmed] = 1;
    }
  });

  // If wildcard, return empty projection (all fields)
  if (hasWildcard) {
    return {};
  }

  return projection;
}

function parseCDSSelect(columns, elements = []) {
  if (!columns || columns.length === 0) return {};

  const projection = {};
  let hasWildcard = false;

  columns.forEach((col) => {
    if (col === "*") {
      hasWildcard = true;
    } else if (col.ref) {
      const fieldName = col.ref[col.ref.length - 1]; // Get the last part of the ref

      // Validate field exists in entity
      if (elements.length > 0 && !fieldExists(fieldName, elements)) {
        console.warn(
          `Field '${fieldName}' not found in entity elements for selection`
        );
      }

      projection[fieldName] = 1;
    }
  });

  // If wildcard or empty columns, return empty (all fields)
  if (hasWildcard || columns.length === 0) {
    return {};
  }

  return projection;
}

// Parse OData $expand parameter
function parseODataExpand(expandString, elements = []) {
  if (!expandString) return [];

  const expandFields = expandString.split(",").map((field) => field.trim());

  // Validate against entity elements if provided
  if (elements.length > 0) {
    const validExpands = expandFields.filter((field) => {
      const element = getElement(field, elements);
      // Check if this is a navigation property (association)
      const isValid =
        element && (element._isAssociation || element.isAssociation);
      if (!isValid) {
        console.warn(
          `Expand field '${field}' is not a valid navigation property`
        );
      }
      return isValid;
    });
    return validExpands;
  }

  return expandFields;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = { buildQuery };