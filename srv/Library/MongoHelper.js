/**
 * Main function to build a comprehensive MongoDB query object from a CAP request's SELECT clause.
 * @param {object} req The CAP request object.
 * @returns {{filter: object, select: object, sort: object, skip: number, limit: number, count: boolean}}
 */

function buildMongoQuery(req) {
  const where = req.query.SELECT?.where || [];
  const columns = req.query.SELECT?.columns || [];
  const orderBy = req.query.SELECT?.orderBy || [];
  const limit = Number(req.query.SELECT?.limit?.rows?.val) || 100;
  const skip = Number(req.query.SELECT?.limit?.offset?.val) || 0;
  const count = req._queryOptions?.$count === true;

  return {
    filter: buildFilter(where),
    select: buildSelect(columns),
    sort: buildSort(orderBy),
    skip,
    limit,
    count,
  };
}

/**
 * Flattens nested xpr arrays recursively.
 */
function flattenXpr(expr) {
  return expr.reduce((acc, tok) => {
    if (tok.xpr) {
      acc.push(...flattenXpr(tok.xpr));
    } else {
      acc.push(tok);
    }
    return acc;
  }, []);
}

/**
 * Converts a CAP where clause array into a MongoDB filter object.
 * Supports =, <>, <, >, <=, >=, contains, startswith, etc.
 */
function buildFilter(whereClause) {
  const filter = {};
  const orConditions = [];

  for (let i = 0; i < whereClause.length; i++) {
    const clause = whereClause[i];

    if (clause.xpr) {
      const parts = flattenXpr(clause.xpr);
      for (let j = 0; j < parts.length; j += 4) {
        const left = parts[j];
        const op = parts[j + 1];
        const right = parts[j + 2];
        if (!left?.ref || right?.val == null) continue;

        const field = left.ref[0];
        const value = right.val;
        switch (op) {
          case "=":
            orConditions.push({ [field]: value });
            break;
          case "<>":
            orConditions.push({ [field]: { $ne: value } });
            break;
          case "<":
            orConditions.push({ [field]: { $lt: value } });
            break;
          case "<=":
            orConditions.push({ [field]: { $lte: value } });
            break;
          case ">":
            orConditions.push({ [field]: { $gt: value } });
            break;
          case ">=":
            orConditions.push({ [field]: { $gte: value } });
            break;
        }
      }
    } else if (clause.ref) {
      const field = clause.ref[0];
      const operator = whereClause[i + 1];
      const right = whereClause[i + 2];
      const value = right?.val;

      if (!field || operator == null || value == null) continue;

      switch (operator.toLowerCase()) {
        case "=":
          filter[field] = value;
          break;
        case "<>":
        case "!=":
          filter[field] = { $ne: value };
          break;
        case "<":
          filter[field] = { $lt: value };
          break;
        case "<=":
          filter[field] = { $lte: value };
          break;
        case ">":
          filter[field] = { $gt: value };
          break;
        case ">=":
          filter[field] = { $gte: value };
          break;
        case "contains":
          filter[field] = { $regex: value, $options: "i" };
          break;
        case "doesnotcontain":
          filter[field] = { $not: { $regex: value, $options: "i" } };
          break;
        case "startswith":
          filter[field] = { $regex: `^${value}`, $options: "i" };
          break;
        case "doesnotstartwith":
          filter[field] = { $not: { $regex: `^${value}`, $options: "i" } };
          break;
        case "endswith":
          filter[field] = { $regex: `${value}$`, $options: "i" };
          break;
        case "doesnotendwith":
          filter[field] = { $not: { $regex: `${value}$`, $options: "i" } };
          break;
        case "empty":
          filter[field] = { $in: [null, ""] };
          break;
        case "notempty":
          filter[field] = { $nin: [null, ""] };
          break;
        case "between":
          if (Array.isArray(value) && value.length === 2) {
            filter[field] = { $gte: value[0], $lte: value[1] };
          }
          break;
        case "notbetween":
          if (Array.isArray(value) && value.length === 2) {
            filter[field] = { $not: { $gte: value[0], $lte: value[1] } };
          }
          break;
        case "exclude":
          if (Array.isArray(value)) {
            filter[field] = { $nin: value };
          }
          break;
      }

      i += 2; // Skip operator and value
    }
  }

  if (orConditions.length) {
    filter.$or = orConditions;
  }

  return filter;
}

/**
 * Builds the MongoDB projection fields from a CAP columns array.
 */
function buildSelect(columns) {
  const projection = {};
  for (const col of columns) {
    const field = col?.ref?.[0];
    if (field) {
      projection[field] = 1;
    }
  }
  return Object.keys(projection).length ? projection : null;
}

/**
 * Builds the MongoDB sort object from a CAP orderBy array.
 */
function buildSort(orderBy) {
  const sort = {};
  for (const order of orderBy) {
    const field = order?.ref?.[0];
    if (field) {
      sort[field] = order.sort?.toLowerCase() === "desc" ? -1 : 1;
    }
  }
  return Object.keys(sort).length ? sort : null;
}

module.exports = { buildMongoQuery };
