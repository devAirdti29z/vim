const { getConnection } = require("./DBConn");
const { v4: uuidv4 } = require('uuid');

const { Decimal128 } = require("mongodb");
const cds = require("@sap/cds");

//aggregation pipeline

/**
 * Generic MongoDB Aggregation function to calculate RemainingQuantity
 * @param {string} collectionName - The collection name where the aggregation will be performed.
 * @param {object} queryParams - The parameters to filter the records, e.g., PONumber, PlantCode, ItemNumber.
 * @param {string} itemField - The field used for grouping, typically "ItemNumber".
 * @param {string} orderedField - The field for ordered quantity, typically "OrderedQuantity".
 * @param {string} dispatchedField - The field for dispatched quantity, typically "CurrentDispatchQuantity".
 * @returns {Promise<Array>} - Returns the aggregation result with RemainingQuantity calculated.
 */

function mongoCollName(def, entityMapping) {
    const fullName = def["@cds.persistence.name"] || def.name;
    const parts = fullName.split(".");
    const entityName = parts[parts.length - 1];
    try {
        const mapping = entityMapping.find((mapping) => mapping[entityName]);
        return mapping ? mapping[entityName] : null;
    } catch (e) {
        return entityName;
    }
    return;
    return def["@cds.persistence.name"] || def.name.replace(/\./g, "_");
}

async function normalizeObject(obj, req) {
    const model = await cds.reflect(cds.model);
    const entityDef = model.definitions[req.target.name || req.entity];
    const elements = entityDef?.elements || {};

    function recurse(val, key) {
        if (Array.isArray(val)) {
            return val.map(v => recurse(v, key));
        } else if (val && typeof val === "object") {
            const out = {};
            for (const [k, v] of Object.entries(val)) {
                out[k] = recurse(v, k);
            }
            return out;
        } else {
            // lookup field type
            const fieldType = elements[key]?.type;
            return castToType(val, fieldType);
        }
    }

    return recurse(obj);
}


// ---------------- Type Casting ----------------
function castToType(value, fieldType) {
    if (value == null) return value;

    switch (fieldType) {
        case "cds.Decimal":
        case "cds.Double":
        case "cds.Integer":
        case "cds.Int32":
        case "cds.Int64":
            if (typeof value === "number") return Decimal128.fromString(value.toString());
            if (typeof value === "string" && /^[0-9.+-]+$/.test(value)) {
                return Decimal128.fromString(value);
            }
            return value;

        case "cds.Boolean":
            if (typeof value === "string") return value.toLowerCase() === "true";
            return Boolean(value);

        case "cds.String":
            return value.toString();

        case "cds.Date":
        case "cds.DateTime":
        case "cds.Timestamp":
            return new Date(value);

        default:
            return value;
    }
}





/** Is element an association/composition? */
function isAssociation(el) {
    return !!(
        el &&
        (el.isAssociation ||
            el.type === "cds.Association" ||
            el.type === "cds.Composition")
    );
}

/** Parse assoc.on into { local:[], foreign:[] } using backlink (<assoc>.<childField> = <parentField>) */
function parseOnBacklink(assocName, onTokens) {
    if (!Array.isArray(onTokens) || !onTokens.length) return null;

    const local = [];
    const foreign = [];

    const refOf = (t) =>
        (t?.ref && t.ref.join(".")) ||
        (t?.xpr && t.xpr.find((z) => z.ref)?.ref?.join(".")) ||
        null;

    // Expect triplets joined by 'and': <ref> '=' <ref>
    for (let i = 0; i < onTokens.length; i += 4) {
        const L = onTokens[i],
            OP = onTokens[i + 1],
            R = onTokens[i + 2];
        if (!L || !R || (OP !== "=" && !(OP?.xpr && OP.xpr.includes("="))))
            continue;

        const l = refOf(L);
        const r = refOf(R);
        if (!l || !r) continue;

        const leftIsForeign = l.startsWith(`${assocName}.`);
        const rightIsForeign = r.startsWith(`${assocName}.`);

        if (leftIsForeign && !rightIsForeign) {
            // <assoc>.<child> = <parentField>
            foreign.push(l.split(".").pop()); // child field
            local.push(r.split(".").pop()); // parent field
        } else if (rightIsForeign && !leftIsForeign) {
            foreign.push(r.split(".").pop());
            local.push(l.split(".").pop());
        }
    }

    return local.length ? { local, foreign } : null;
}

/** Build a $lookup stage with $expr that supports composite keys */
function buildLookupWithExpr({
    from,
    as,
    localFields,
    foreignFields,
    childProject,
    toOne,
    keyFilter,
}) {
    const letVars = {};
    const localRefs = [];

    localFields.forEach((lf, i) => {
        const varName = `l${i}`;
        letVars[varName] = `$${lf}`;
        localRefs.push(`$$${varName}`);
    });

    const foreignRefs = foreignFields.map((f) => `$${f}`);

    const expr =
        localRefs.length === 1
            ? { $eq: [foreignRefs[0], localRefs[0]] }
            : { $and: foreignRefs.map((ff, i) => ({ $eq: [ff, localRefs[i]] })) };

    const pipeline = [{ $match: { $expr: expr } }];
    if (keyFilter) {
        // Add the key filter to ensure the query is limited to specific key value
        pipeline.push({ $match: keyFilter });
    }

    if (childProject && Object.keys(childProject).length) {
        pipeline.push({ $project: childProject });
    }

    const stages = [
        {
            $lookup: {
                from,
                let: letVars,
                pipeline,
                as,
            },
        },
    ];

    if (toOne) {
        stages.push({
            $unwind: { path: `$${as}`, preserveNullAndEmptyArrays: true },
        });
    }

    return stages;
}

/**
 * Build only the $lookup/$unwind parts for association fields.
 * @param {string[]} selectedFields
 * @param {Array<{name, from?, local?, foreign?, cardinality?}>} childTables (optional overrides)
 * @param {object} req  expects req.target.name or req.entity name string like 'your.namespace.Entity'
 * @returns {Promise<{lookups: any[], scalarProject: object, hasAssoc: boolean}>}
 */
async function handleExpand(selectedFields, childTables, req) {
    const lookups = [];
    const scalarProject = {};
    let hasAssoc = false;
    const keyFilter = {}; // To hold key filters for associations

    // Resolve current entity (CDS definition) from the request
    const entityFQN =
        req?.target?.name ||
        req?.entity ||
        req?.params?.entity ||
        req?.query?.from?.ref?.[0];
    if (!entityFQN) throw new Error("Cannot resolve entity name from request.");

    const model = await cds.reflect(cds.model);
    const entityDef = model.definitions[entityFQN];
    if (!entityDef) throw new Error(`Entity not found: ${entityFQN}`);

    // Quick access maps
    const elements = entityDef.elements || {};
    const childOverride = new Map(); // name -> override
    for (const c of childTables || []) childOverride.set(c.name, c);

    // Check $filter for key field-based filters
    const filter = req.query.$filter || "";
    selectedFields.forEach((field) => {
        const el = elements[field];
        if (el && isAssociation(el)) {
            // Check if the key field filter is present for this association in the $filter
            const keyField = el.name + "_ID"; // Assuming key field has "_ID" suffix (like foreign keys)
            const regex = new RegExp(`(${keyField})\\s*eq\\s*([a-zA-Z0-9-]+)`, "i");
            const matches = filter.match(regex);
            if (matches) {
                keyFilter[keyField] = matches[2]; // Store the key field value
            }
        }
    });

    // Build per selected field:
    for (const field of selectedFields) {
        const el = elements[field];

        if (isAssociation(el)) {
            hasAssoc = true;

            // Determine target & collection
            const targetDef = model.definitions[el.target];
            const from =
                childOverride.get(field)?.from ||
                (targetDef && mongoCollName(targetDef, childTables));
            if (!from) continue;

            // Figure out join pairs local(parent) ↔ foreign(child)
            let localFields = childOverride.get(field)?.local;
            let foreignFields = childOverride.get(field)?.foreign;

            if (!localFields || !foreignFields) {
                const parsed = parseOnBacklink(field, el.on);
                if (parsed) {
                    localFields = parsed.local;
                    foreignFields = parsed.foreign;
                }
            }
            if (
                !localFields ||
                !foreignFields ||
                localFields.length !== foreignFields.length
            ) {
                // last resort: try keys 1:1
                const pKeys = Object.keys(entityDef.keys || {});
                const cKeys = Object.keys((targetDef && targetDef.keys) || {});
                const n = Math.min(pKeys.length, cKeys.length);
                localFields = pKeys.slice(0, n);
                foreignFields = cKeys.slice(0, n);
            }

            // child projection if user wrote SELECT Assoc { a, b }
            let childProject = undefined;
            const col = (req.query.SELECT?.columns || []).find(
                (c) => c?.ref?.[0] === field
            );
            if (Array.isArray(col?.expand)) {
                childProject = {};
                for (const sub of col.expand) {
                    const f = sub?.ref?.[0];
                    if (f) childProject[f] = 1;
                }
            }

            const toOne =
                el?.cardinality?.max === 1 ||
                childOverride.get(field)?.cardinality === "one";

            lookups.push(
                ...buildLookupWithExpr({
                    from,
                    as: field,
                    localFields,
                    foreignFields,
                    childProject,
                    toOne,
                    keyFilter,
                })
            );

            // Ensure parent localFields survive projection (if you later project)
            localFields.forEach((k) => {
                scalarProject[k] = 1;
            });
        } else {
            // scalar field → include in root project
            scalarProject[field] = 1;
        }
    }

    return { lookups, scalarProject, hasAssoc, entityDef };
}


    async function mongoRead(entity, req, childTables) {
        const { database } = await getConnection();
        const collection = database.collection(entity);

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

        // ------------------------------
        // Recursive function to parse "where" array
        // ------------------------------
        async function buildMongoFilter(where) {
            let query = {};
            const whereClause = req.query.SELECT.where;
            for (let i = 0; i < whereClause.length; i++) {
                const clause = whereClause[i];

                if (clause.xpr) {
                    const parts = flattenXpr(clause.xpr);
                    for (let i = 0; i < parts.length; i += 4) {
                        const left = parts[i];
                        const op = parts[i + 1];
                        const right = parts[i + 2];
                        if (left.ref && op === "=" && right.val != null) {
                            query.$or = query.$or || [];
                            const field = left.ref[0];
                            query.$or.push({ [field]: right.val });
                        } else if (left.func && op === "<" && right.val != null) {
                            query.$or = query.$or || [];
                            const field = left.ref[0];
                            query.$or.push({ [field]: { $lt: right.val } }); // Use $lt for "less than"
                        } else if (
                            left.func &&
                            left.func.toLowerCase() === "endswith" &&
                            left.args &&
                            left.args[1].val != null
                        ) {
                            // Ensure that the $or condition is initialized
                            query.$or = query.$or || [];

                            const field = left.args[0].ref[0]; // The field name (e.g., 'Ebeln')
                            const value = left.args[1].val;
                            const regexPattern = value + "$";
                            query.$or.push({
                                [field]: { $regex: regexPattern, $options: "i" },
                            });
                        } else if (
                            left.func &&
                            left.func.toLowerCase() === "startswith" &&
                            left.args &&
                            left.args[1].val != null
                        ) {
                            // Ensure that the $or condition is initialized
                            query.$or = query.$or || [];

                            const field = left.args[0].ref[0]; // The field name (e.g., 'Ebeln')
                            const value = left.args[1].val; // The value to match against (e.g., '450000')

                            // Construct the regex pattern for 'startswith' (case-insensitive)
                            const regexPattern = "^" + value; // Starts with the specified value

                            // Add the condition to the $or array using $regex
                            query.$or.push({
                                [field]: { $regex: regexPattern, $options: "i" },
                            });
                        } else if (left.ref && op === ">" && right.val != null) {
                            query.$or = query.$or || [];
                            const field = left.ref[0];
                            query.$or.push({ [field]: { $gt: right.val } }); // Use $gt for "greater than"
                        } else if (left.ref && op === "<=" && right.val != null) {
                            query.$or = query.$or || [];
                            const field = left.ref[0];
                            query.$or.push({ [field]: { $lte: right.val } }); // Less than or equal
                        } else if (left.ref && op === ">=" && right.val != null) {
                            query.$or = query.$or || [];
                            const field = left.ref[0];
                            query.$or.push({ [field]: { $gte: right.val } }); // Greater than or equal
                        } else if (left.ref && op === "<>" && right.val != null) {
                            query.$or = query.$or || [];
                            const field = left.ref[0];
                            query.$or.push({ [field]: { $ne: right.val } }); // Not equal
                        }
                    }
                } else if (clause.ref) {
                    const field = clause.ref[0];
                    const operator = whereClause[i + 1];
                    const value = whereClause[i + 2].val;
                    if (operator === "=") {
                        query[field] = value; // Equal to
                    } else if (operator === "<>") {
                        query[field] = { $ne: value }; // Not equal to
                    } else if (operator === "<") {
                        query[field] = { $lt: value }; // Less than
                    } else if (operator === "<=") {
                        query[field] = { $lte: value }; // Less than or equal to
                    } else if (operator === ">") {
                        query[field] = { $gt: value }; // Greater than
                    } else if (operator === ">=") {
                        query[field] = { $gte: value }; // Greater than or equal to
                    } else if (operator === "!=") {
                        query.$and = query.$and || [];
                        query.$and.push({ [field]: { $ne: value } }); // Greater than or equal to
                    } else if (operator.toLowerCase() === "contains") {
                        query[field] = { $regex: value, $options: "i" }; // Contains (case-insensitive)
                    } else if (operator.toLowerCase() === "doesnotcontain") {
                        query[field] = { $not: { $regex: value, $options: "i" } }; // Does not contain
                    } else if (operator.toLowerCase() === "startswith") {
                        query[field] = { $regex: "^" + value, $options: "i" }; // Starts with
                    } else if (operator.toLowerCase() === "doesnotstartwith") {
                        query[field] = { $not: { $regex: "^" + value, $options: "i" } }; // Does not start with
                    } else if (operator.toLowerCase() === "endswith") {
                        query[field] = { $regex: value + "$", $options: "i" }; // Ends with
                    } else if (operator.toLowerCase() === "doesnotendwith") {
                        query[field] = { $not: { $regex: value + "$", $options: "i" } }; // Does not end with
                    } else if (operator.toLowerCase() === "empty") {
                        query[field] = { $in: [null, ""] }; // Empty
                    } else if (operator.toLowerCase() === "notempty") {
                        query[field] = { $nin: [null, ""] }; // Not empty
                    } else if (operator.toLowerCase() === "between") {
                        if (Array.isArray(value) && value.length === 2) {
                            query[field] = { $gte: value[0], $lte: value[1] }; // Between
                        }
                    } else if (operator.toLowerCase() === "notbetween") {
                        if (Array.isArray(value) && value.length === 2) {
                            query[field] = { $not: { $gte: value[0], $lte: value[1] } }; // Not between
                        }
                    } else if (operator.toLowerCase() === "exclude") {
                        if (Array.isArray(value)) query[field] = { $nin: value }; // Exclude list
                    }

                    i += 2;
                } else if (clause.args && clause.func) {
                    const field = clause.args[0]?.ref?.[0];
                    const value = clause.args[1]?.val;

                    if (!field) return;

                    switch (clause.func.toLowerCase()) {
                        case "contains":
                            if (whereClause[i - 1] && whereClause[i - 1] === "not") {
                                query[field] = { $not: { $regex: value, $options: "i" } };
                                break;
                            }
                            query[field] = { $regex: value, $options: "i" };
                            break;
                        case "doesnotcontain":
                            query[field] = { $not: { $regex: value, $options: "i" } };
                            break;
                        case "startswith":
                            if (whereClause[i - 1] && whereClause[i - 1] === "not") {
                                query[field] = { $not: { $regex: "^" + value, $options: "i" } };
                                break;
                            }
                            query[field] = { $regex: "^" + value, $options: "i" };
                            break;
                        case "doesnotstartwith":
                            query[field] = { $not: { $regex: "^" + value, $options: "i" } };
                            break;
                        case "endswith":
                            if (whereClause[i - 1] && whereClause[i - 1] === "not") {
                                query[field] = { $not: { $regex: value + "$", $options: "i" } };
                                break;
                            }
                            query[field] = { $regex: value + "$", $options: "i" };
                            break;
                        case "doesnotendwith":
                            query[field] = { $not: { $regex: value + "$", $options: "i" } };
                            break;
                        case "eq":
                        case "=":
                            query[field] = value;
                            break;
                        case "ne":
                        case "notequalto":
                            query[field] = { $ne: value };
                            break;
                        case "lt":
                        case "notgreaterthan":
                        case "notgte": // optional synonym
                            query[field] = { $lt: value };
                            break;
                        case "le":
                        case "notgreaterthanorequalto":
                            query[field] = { $lte: value };
                            break;
                        case "gt":
                        case "notlessthan":
                            query[field] = { $gt: value };
                            break;
                        case "ge":
                        case "notlessthanorequalto":
                            query[field] = { $gte: value };
                            break;
                        case "empty":
                            query[field] = { $in: [null, ""] };
                            break;
                        case "notempty":
                            query[field] = { $nin: [null, ""] };
                            break;
                        case "between":
                            if (Array.isArray(value) && value.length === 2) {
                                query[field] = { $gte: value[0], $lte: value[1] };
                            }
                            break;
                        case "notbetween":
                            if (Array.isArray(value) && value.length === 2) {
                                query[field] = { $not: { $gte: value[0], $lte: value[1] } };
                            }
                            break;
                        case "exclude":
                            if (Array.isArray(value)) query[field] = { $nin: value };
                            break;
                        default:
                            query[field] = value; // fallback exact match
                    }
                }
            }
            // return query;
            let state = await normalizeObject(query, req);
            return state
        }

        // ------------------------------
        // Prepare MongoDB query
        // ------------------------------
        const mongoFilter = {};
        let projection = null;
        let sort = {};
        let skip = 0;
        let limit = 20;
        let count, searchableFields;

        // handle $filter dynamically
        if (req.query.SELECT?.where?.length) {
            const filters = await buildMongoFilter(req.query.SELECT.where);
            Object.assign(mongoFilter, filters);
            if (filters.length === 1) Object.assign(mongoFilter, filters[0]);
            else if (filters.length > 1) mongoFilter.$and = filters;
        }

        // ------------------------------
        // handle $search dynamically
        // ------------------------------
        if (req.query?.SELECT.search) {
            let searchTerm = "";
            try {
                searchTerm = JSON.parse(req._queryOptions.$search);
            } catch {
                searchTerm = req.query?.SELECT.search[0]?.val || "";
            }
            searchTerm = searchTerm.replace(/^['"]|["']$/g, '');  // Remove leading and trailing quotes if present
            console.log(searchTerm);

            const columns = req.query.SELECT?.columns || [];
            const entities = cds.entities[entity];
            try {
                const keyField = Object.keys(entities.keys)[0]; // Get the first key field
                searchableFields = columns
                    .map((c) => c?.ref?.[0])   // Get the field names from columns
                    .filter(Boolean)           // Remove falsy values
                    .filter((field) => field !== keyField);
            } catch (Err) {
                searchableFields = columns
                    .map((c) => c?.ref?.[0])   // Get the field names from columns
                    .filter(Boolean)
            }
            // Remove the keyField from searchable fields

            // Create search conditions
            let searchConditions = searchableFields.map((f) => {
                return { [f]: { $regex: searchTerm, $options: "i" } };  // Case-insensitive search
            });

            if (searchConditions.length === 0) {

                mongoFilter.$and = mongoFilter.$and || [];
                mongoFilter.$and.push({ $or: [{ "name": { $regex: searchTerm, $options: "i" } }] });
            } else {
                mongoFilter.$and = mongoFilter.$and || [];
                mongoFilter.$and.push({ $or: searchConditions });  // Push search conditions with $or logic

                console.log(searchConditions);
            }
        }


        // ------------------------------
        // handle Include / Exclude dynamically
        // ------------------------------

        // ------------------------------
        // handle $select dynamically
        // ------------------------------

        if (req.params && Object.keys(req?.params).length) {
            const paramConditions = Object.entries(req.params[0]).map(
                ([key, value]) => {
                    if (value === null) return { [key]: { $eq: null } };
                    else if (value === "")
                        return { $or: [{ [key]: { $eq: null } }, { [key]: { $eq: "" } }] };
                    else return { [key]: { $eq: value } };
                }
            );
            mongoFilter.$and = mongoFilter.$and || [];
            mongoFilter.$and.push(...paramConditions);
        }

        // ------------------------------
        // handle $orderby dynamically
        // ----------------------------

        if (req.query.SELECT?.orderBy?.length) {
            req.query.SELECT.orderBy.forEach(o => {
                const field = o?.ref?.[0];
                if (!field || field === "ID") return; // Skip ID
                sort[field] = o.sort?.toLowerCase() === "desc" ? -1 : 1;
            });
            sort['modifiedAt'] = -1
            sort['createdAt'] = -1
            sort['timestamp'] = -1
        }

        else {
            sort = {
                modifiedAt: -1,
                createdAt: -1,
                timestamp: -1
            };
        }


        if (req.query.SELECT?.columns?.length) {
            projection = {};
            let projectFields = [],
                projectFieldsShow = false;
            req.query.SELECT.columns?.forEach((c) => {
                const field = c?.ref?.[0]; // Get the field name from ref[0]

                if (field) {
                    projection[field] = 1; // Set the field to be projected
                    projectFields.push(field); // Add the field to the projectFields array
                } else {
                    projectFieldsShow = true;
                    return; // Break the loop and stop further processing (equivalent to `continue`)
                }
            });

            if (projectFieldsShow) {
                projection = {};
            }
            console.log(projection);

            const { lookups, scalarProject, hasAssoc } = await handleExpand(
                projectFields,
                childTables,
                req
            );
            if (hasAssoc) {
                // Use aggregation when any association is selected
                const pipeline = [
                    { $match: mongoFilter },
                    // Only project scalar fields if any were explicitly selected; if no $select at all, skip $project to return full parent docs
                    ...(projectFields.length &&
                        Object.keys(scalarProject).length &&
                        Object.keys(projection).length
                        ? [{ $project: scalarProject }]
                        : []),
                    ...lookups,
                    { $sort: sort },
                    {
                        $facet: {
                            data: [{ $skip: skip }, { $limit: limit }],
                            total: [{ $count: "count" }],
                        },
                    },
                ];

                const [{ data, total }] = await collection
                    .aggregate(pipeline)
                    .toArray();
                const result = data || [];
                result["$count"] = (total && total[0]?.count) || 0;
                return result;
            }
        }

        // ------------------------------
        // handle $top, $skip and $count
        // ------------------------------
        if (req.query.SELECT?.limit?.rows?.val)
            limit = parseInt(req.query.SELECT.limit.rows.val);
        if (req.query.SELECT?.limit?.offset?.val)
            skip = parseInt(req.query.SELECT.limit?.offset?.val);
        if (req.query.SELECT?.columns?.[0] !== undefined)
            count = req.query.SELECT.columns[0].func === 'count';

        console.log(mongoFilter, "filterrrrrrrrrrrrrrrrrrrrrrrrrrr");

        let cursor = collection.find(mongoFilter);
        if (projection) cursor = cursor.project(projection);
        if (sort) cursor = cursor.sort(sort);
        if (skip) cursor = cursor.skip(skip);
        if (limit) cursor = cursor.limit(limit);
        const result = await cursor.toArray();
        let total = await collection.countDocuments(mongoFilter);
        if (count) return total;
        result.$count = total
        return result;

    }

    //for strictly following parent-child composition relationship while creating
    async function parentexists(req,action, field, value,data = null,entity){
         try {
            console.log("fetching if parent exists");

            const { database } = await getConnection();
            const collection = database.collection(entity);

                const parent = await collection.findOne({  
                    [field]:value
                    
         });
       
                if (!parent) {
                    //throw new Error(`${field} with value ${value} does not already exists.`);
                    req.reject(400, "VIM_PO_ITEMS: Parent VIM_PO_HEADERS does not exist");
                    return;
                }
                return parent;

                } catch (error) {
            console.error(`Error in ${action} operation:`, error);
            throw error;
        }

    }

      //for strictly following parent-child composition relationship while deletion
    async function cascadeDelete(req, action, field, value, data = null, childEntities) {
    try {
        console.log("Parent is deleted");

        const { database } = await getConnection();

        console.log(action);
        if (action === 'delete') {
            
            for (let entity of childEntities) {
                const childCollection = database.collection(entity);
                const result = await childCollection.deleteOne({ [field]: value });
                if (result.deletedCount === 0) {
                    console.log(`No records found to delete in ${entity}`);
                } else {
                    console.log(`${result.deletedCount} records deleted in ${entity}`);
                }
            }

            return true;
        }
    } catch (error) {
        console.error(`Error in ${action} operation:`, error);
        throw error;
    }
}
//for keys not null validation
async function requireKeys(req, keys, entityName) {

  const missing = keys.filter(
    k => req.data[k] === undefined || req.data[k] === null || req.data[k] === ""
  );

  if (missing.length) {
    req.reject(
      400,
      `${entityName}: Missing mandatory key field(s): ${missing.join(", ")}`
    );
  }
}

async function calculateRemainingQuantity(
  collectionName,
  queryParams,
  itemField = "ItemNumber",
  orderedField = "OrderedQuantity",
  dispatchedField = "CurrentDispatchQuantity"
) {
  try {
    // Connect to the MongoDB database
    const { database } = await getConnection();
    const collection = database.collection(collectionName);

    // MongoDB Aggregation pipeline
    const aggregationPipeline = [
      { 
        $match: queryParams  // Match based on PONumber, PlantCode, and ItemNumber
      },
      { 
        $group: { 
          _id: `$${itemField}`,  // Group by ItemNumber
          totalDispatched: { $sum: `$${dispatchedField}` },  // Sum of dispatched quantity
        }
      },
      {
        $lookup: {
          from: collectionName === "VIM_PO_DISPATCH_ITEMS" ? "VIM_PO_ITEMS" : collectionName,  // Join with appropriate collection
          localField: "_id",      // Use the _id from the group (ItemNumber)
          foreignField: itemField,  // Join condition on ItemNumber
          as: "itemDetails"  // Alias for the result
        }
      },
      { 
        $unwind: "$itemDetails"  // Unwind to flatten the result of the lookup
      },
      { 
        $project: {  // Project the remaining quantity calculation
          RemainingQuantity: {
            $subtract: ["$itemDetails." + orderedField, "$totalDispatched"]  // Calculate RemainingQuantity
          }
        }
      },
    ];

    // Perform aggregation query
    const result = await collection.aggregate(aggregationPipeline).toArray();
    return result;
  } catch (error) {
    console.error("Error in aggregation function:", error);
    throw error;
  }
}
    async function handleCRUD(req, action, field, value, data = null, entity) {
        try {
            console.log(entity, "fvg");

            const { database } = await getConnection();
            const collection = database.collection(entity);
            const duplicate = await collection.findOne({ [field]: value });

            console.log(action);

            if (action === 'create') {
                for (const key in req.data) {
                    if (req.data.hasOwnProperty(key)) {
                        if (key.toLowerCase().includes('id') && !req.data[key]) {
                            req.data[key] = uuidv4();
                            console.log(`Generated UUID for field: ${key}`);
                        }
                    }
                }
                ///
                req.data.createdAt = new Date();
                req.data.createdBy = req?.user?.id;


                // Check if a duplicate exists based on the provided `field`
                const duplicate = await collection.findOne({ [field]: value });
                if (duplicate) {
                    throw new Error(`${field} with value ${value} already exists.`);
                }

                // Insert the new record
                const result = await collection.insertOne(req.data);
                return result.ops; // Return the created entry

            }
            else if (action === 'update') {
                // Initialize the filter object
                let filter = {};

                const entities = cds.entities[entity];

                const keyField = Object.keys(entities.keys)[0];  // This assumes the entity has a single key

                // Access the key value from the request data
                const keyValue = req.data[keyField]

                req.data.modifiedAt = new Date();
                req.data.modifiedBy = req?.user?.id;

                // Check for duplicates using the dynamically created filter
                const duplicateUpdate = await collection.findOne({ [keyField]: { $ne: keyValue }, [field]: value });
                if (duplicateUpdate) {
                    throw new Error(`Duplicate record found with value: ${value}`);
                }

                // Proceed with the update operation
                const result = await collection.updateOne(
                    { [keyField]: keyValue },  // Find the document by the field value
                    { $set: req.data }    // Set the updated data
                );

                // Return the updated document
                return true;
            }

            else if (action === 'delete') {
                const entities = cds.entities[entity];

                const keyField = Object.keys(entities.keys)[0];
                const keyValue = req.data[keyField]

                const duplicate = await collection.findOne({ [keyField]: keyValue });
                if (!duplicate) {
                    throw new Error(`No record found with ${keyField}: ${keyValue}`);
                }

                const result = await collection.deleteOne({ [keyField]: keyValue });

                if (result.deletedCount === 0) {
                    throw new Error("No records deleted.");
                }

                return true;
            }

        } catch (error) {
            console.error(`Error in ${action} operation:`, error);
            throw error;
        }
    }
    async function handleCRUDForSeverity(req, action, field, value, data = null, entity) {
        try {

            const { database } = await getConnection();
            const collection = database.collection(entity);

            if (action === 'create') {

                const duplicate = await collection.findOne({
                    L1Classification: req.data.L1Classification,
                    SubCaseType: req.data.SubCaseType,
                    Priority: req.data.Priority
                });

                if (duplicate) {
                    throw new Error(
                        `A record with L1Classification '${req.data.L1Classification}', SubCaseType '${req.data.SubCaseType}', and Priority '${req.data.Priority}' already exists.`
                    );
                }


                for (const key in req.data) {
                    if (req.data.hasOwnProperty(key)) {
                        if (key.toLowerCase().includes('id') && !req.data[key]) {
                            req.data[key] = uuidv4();
                            console.log(`Generated UUID for field: ${key}`);
                        }
                    }
                }
                ///
                req.data.createdBy = req?.user?.id;
                req.data.createdAt = new Date();
                const result = await collection.insertOne(req.data);
                return result.ops;

            }
            else if (action === 'update') {

                let SeverityConfigID = req.params[0].SeverityConfigID;
                req.data.modifiedAt = new Date();
                req.data.modifiedBy = req?.user?.id;

                const duplicate = await collection.findOne({
                    L1Classification: req.data.L1Classification,
                    SubCaseType: req.data.SubCaseType,
                    Priority: req.data.Priority,
                    SeverityConfigID: { $ne: SeverityConfigID }
                });

                if (duplicate) {
                    throw new Error(
                        `A record with L1Classification '${req.data.L1Classification}', SubCaseType '${req.data.SubCaseType}', and Priority '${req.data.Priority}' already exists.`
                    );
                }

                const result = await collection.updateOne(
                    { SeverityConfigID },
                    { $set: req.data }
                );

                return result;
            }

            else if (action === 'delete') {

                let SeverityConfigID = req.params[0].SeverityConfigID;

                const result = await collection.deleteOne({ SeverityConfigID });

                if (result.deletedCount === 0) {
                    throw new Error("No records deleted.");
                }

                return true;
            }

        } catch (error) {
            console.error(`Error in ${action} operation:`, error);
            throw error;
        }
    }


module.exports = {
  calculateRemainingQuantity,
  handleCRUD,
  handleCRUDForSeverity,
  mongoRead,
  parentexists,
  requireKeys,
  cascadeDelete,
  mongoCollName,
  normalizeObject,
  castToType,
  isAssociation,
  handleExpand
};