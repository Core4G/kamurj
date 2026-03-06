const LOAN_UID_CANDIDATES = ['api::loan.loan'];
const NEWS_UID_CANDIDATES = ['api::news-item.news-item', 'api::news.news-item', 'api::news.news'];

const MAX_COLLECTION_ITEMS = Number(process.env.CONTENT_SEARCH_MAX_ITEMS || 1000);
const MAX_POPULATE_DEPTH = Number(process.env.CONTENT_SEARCH_POPULATE_DEPTH || 4);
const POPULATE_RELATIONS_DEEPLY = process.env.CONTENT_SEARCH_POPULATE_RELATIONS === 'true';
const SEARCH_CACHE_TTL_MS = Number(process.env.CONTENT_SEARCH_CACHE_TTL_MS || 30_000);
const SEARCH_CONCURRENCY = Number(process.env.CONTENT_SEARCH_CONCURRENCY || 1);
const SEARCH_MAX_TEXT_LENGTH = Number(process.env.CONTENT_SEARCH_MAX_TEXT_LENGTH || 250_000);
const SEARCH_FLATTEN_DEPTH = Number(process.env.CONTENT_SEARCH_FLATTEN_DEPTH || 20);
const SEARCH_FLATTEN_NODES = Number(process.env.CONTENT_SEARCH_FLATTEN_NODES || 300_000);
const UID_QUERY_TIMEOUT_MS = Number(process.env.CONTENT_SEARCH_UID_TIMEOUT_MS || 3000);

const populateCache = new Map();
const responseCache = new Map();

const nowMs = () => Date.now();
const normalizeForSearch = (value) => String(value || '').normalize('NFKC').toLowerCase();
const normalizeLocale = (value) => {
  const locale = String(value || '').trim();
  return locale || null;
};
const normalizeEntries = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (Array.isArray(value?.results)) {
    return value.results.filter(Boolean);
  }

  if (Array.isArray(value?.data)) {
    return value.data.filter(Boolean);
  }

  if (value?.data && typeof value.data === 'object') {
    return [value.data];
  }

  return [value];
};

const runWithConcurrency = async (items, worker) => {
  if (!items.length) {
    return [];
  }

  const limit = Math.max(1, SEARCH_CONCURRENCY);
  const results = new Array(items.length);
  let index = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  });

  await Promise.all(runners);
  return results;
};

const withTimeout = async (promise, timeoutMs) => {
  if (!timeoutMs || timeoutMs <= 0) {
    return promise;
  }

  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
};

const toPascalCase = (value) =>
  String(value || '')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

const pageNameFromUid = (uid) => {
  const apiPart = uid.split('::')[1] || '';
  const contentTypeName = apiPart.split('.')[0] || apiPart;
  return toPascalCase(contentTypeName);
};

const getEntryRef = (entry) => String(entry?.documentId || entry?.id || '');
const getLoanName = (entry) => String(entry?.name || entry?.title || entry?.loanName || entry?.slug || getEntryRef(entry));
const getNewsName = (entry) => String(entry?.title || entry?.name || entry?.slug || getEntryRef(entry));
const getDirectSearchText = (entry) => {
  const directValues = [
    entry?.name,
    entry?.title,
    entry?.description,
    entry?.loanName,
    entry?.slug,
    entry?.text,
    entry?.content,
    entry?.body,
    entry?.summary,
  ]
    .filter((value) => value !== null && value !== undefined)
    .map((value) => (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : ''))
    .filter(Boolean)
    .join(' ');

  return normalizeForSearch(directValues);
};

const flattenSearchText = (entry) => {
  const chunks = [];
  const stack = [{ value: entry, depth: 0 }];
  const visitedObjects = new WeakSet();
  let traversedNodes = 0;

  while (stack.length) {
    const currentNode = stack.pop();
    if (!currentNode) {
      continue;
    }

    traversedNodes += 1;
    if (SEARCH_FLATTEN_NODES > 0 && traversedNodes > SEARCH_FLATTEN_NODES) {
      break;
    }

    const { value, depth } = currentNode;
    if (value === null || value === undefined) {
      continue;
    }

    const primitiveType = typeof value;
    if (primitiveType === 'string' || primitiveType === 'number' || primitiveType === 'boolean') {
      const normalized = normalizeForSearch(String(value));
      if (normalized) {
        chunks.push(normalized);
      }
      continue;
    }

    if (depth >= SEARCH_FLATTEN_DEPTH) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        stack.push({ value: item, depth: depth + 1 });
      }
      continue;
    }

    if (primitiveType === 'object') {
      if (visitedObjects.has(value)) {
        continue;
      }
      visitedObjects.add(value);
      for (const child of Object.values(value)) {
        stack.push({ value: child, depth: depth + 1 });
      }
    }
  }

  const merged = chunks.join(' ');
  return merged.length > SEARCH_MAX_TEXT_LENGTH ? merged.slice(0, SEARCH_MAX_TEXT_LENGTH) : merged;
};

const buildPopulateFromAttributes = (attributes, depth, strapi, visited) => {
  if (!attributes || depth <= 0) {
    return '*';
  }

  const populate = {};

  for (const [attributeName, rawAttribute] of Object.entries(attributes)) {
    const attribute: any = rawAttribute;
    if (!attribute || typeof attribute !== 'object') {
      continue;
    }

    if (attribute.type === 'media') {
      populate[attributeName] = true;
      continue;
    }

    if (attribute.type === 'relation' && attribute.target) {
      if (!POPULATE_RELATIONS_DEEPLY) {
        populate[attributeName] = true;
        continue;
      }

      const targetUid = String(attribute.target);
      const visitKey = `relation:${targetUid}:${depth}`;

      if (visited.has(visitKey)) {
        populate[attributeName] = true;
        continue;
      }

      visited.add(visitKey);
      const targetSchema = strapi.contentTypes?.[targetUid];
      populate[attributeName] = targetSchema?.attributes
        ? { populate: buildPopulateFromAttributes(targetSchema.attributes, depth - 1, strapi, visited) }
        : true;
      visited.delete(visitKey);
      continue;
    }

    if (attribute.type === 'component' && attribute.component) {
      const componentUid = String(attribute.component);
      const visitKey = `component:${componentUid}:${depth}`;

      if (visited.has(visitKey)) {
        populate[attributeName] = true;
        continue;
      }

      visited.add(visitKey);
      const componentSchema = strapi.components?.[componentUid];
      populate[attributeName] = {
        populate: buildPopulateFromAttributes(componentSchema?.attributes, depth - 1, strapi, visited),
      };
      visited.delete(visitKey);
      continue;
    }

    if (attribute.type === 'dynamiczone' && Array.isArray(attribute.components)) {
      const on = {};

      for (const componentUid of attribute.components) {
        const uid = String(componentUid);
        const visitKey = `dynamic:${uid}:${depth}`;

        if (visited.has(visitKey)) {
          on[uid] = { populate: '*' };
          continue;
        }

        visited.add(visitKey);
        const componentSchema = strapi.components?.[uid];
        on[uid] = {
          populate: buildPopulateFromAttributes(componentSchema?.attributes, depth - 1, strapi, visited),
        };
        visited.delete(visitKey);
      }

      populate[attributeName] = { on };
    }
  }

  return Object.keys(populate).length ? populate : '*';
};

const buildPopulateForUid = (uid, strapi) => {
  if (populateCache.has(uid)) {
    return populateCache.get(uid);
  }

  const schema = strapi.contentTypes?.[uid];
  if (!schema) {
    return '*';
  }

  const populate = buildPopulateFromAttributes(schema.attributes, MAX_POPULATE_DEPTH, strapi, new Set());
  populateCache.set(uid, populate);
  return populate;
};

const fetchEntriesByUid = async (uid, kind, strapi, locale) => {
  const schema = strapi.contentTypes?.[uid];
  const query: any = {
    populate: buildPopulateForUid(uid, strapi),
    limit: kind === 'singleType' ? 1 : MAX_COLLECTION_ITEMS,
  };

  if (schema?.pluginOptions?.i18n?.localized && locale) {
    query.locale = locale;
  }

  try {
    const dbResult = await strapi.db.query(uid).findMany(query);
    const normalizedDb = normalizeEntries(dbResult);
    if (normalizedDb.length) {
      return normalizedDb;
    }
  } catch (_dbError) {
  }

  const entityResult = await strapi.entityService.findMany(uid, query);
  return normalizeEntries(entityResult);
};

const resolveCollectionUid = (strapi, candidates, singularName) => {
  const contentTypes = strapi.contentTypes || {};

  for (const candidate of candidates) {
    if (contentTypes[candidate]) {
      return candidate;
    }
  }

  return Object.keys(contentTypes).find((uid) => {
    if (!uid.startsWith('api::')) {
      return false;
    }

    const schema = contentTypes[uid];
    return schema?.kind === 'collectionType' && schema?.info?.singularName === singularName;
  });
};

const getTargetUids = (strapi) => {
  const contentTypes = strapi.contentTypes || {};
  const singleTypeUids = Object.keys(contentTypes).filter((uid) => {
    const schema = contentTypes[uid];
    return uid.startsWith('api::') && schema?.kind === 'singleType';
  });

  const loanUid = resolveCollectionUid(strapi, LOAN_UID_CANDIDATES, 'loan');
  const newsUid = resolveCollectionUid(strapi, NEWS_UID_CANDIDATES, 'news-item');
  const manualCollections = [loanUid, newsUid].filter(Boolean);
  return [...singleTypeUids, ...manualCollections];
};

const getCachedResponse = (cacheKey) => {
  const cached = responseCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= nowMs()) {
    responseCache.delete(cacheKey);
    return null;
  }

  return cached.response;
};

const setCachedResponse = (cacheKey, response) => {
  if (SEARCH_CACHE_TTL_MS <= 0) {
    return;
  }

  responseCache.set(cacheKey, {
    expiresAt: nowMs() + SEARCH_CACHE_TTL_MS,
    response,
  });
};

const cleanupExpiredResponseCache = () => {
  const currentTime = nowMs();
  for (const [key, cached] of responseCache.entries()) {
    if (cached.expiresAt <= currentTime) {
      responseCache.delete(key);
    }
  }
};

module.exports = {
  async search(ctx) {
    cleanupExpiredResponseCache();

    const rawWord = String(ctx.request.body?.word || '').trim();
    const locale = normalizeLocale(ctx.request.body?.locale || ctx.query?.locale);

    if (!rawWord) {
      const error: any = new Error('word is required');
      error.status = 400;
      throw error;
    }

    const searchWord = normalizeForSearch(rawWord);
    const cacheKey = `${searchWord}:${locale || '__default__'}`;
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      return cached;
    }

    const targetUids = getTargetUids(strapi);
    const loanUid = resolveCollectionUid(strapi, LOAN_UID_CANDIDATES, 'loan');
    const newsUid = resolveCollectionUid(strapi, NEWS_UID_CANDIDATES, 'news-item');

    const scanResults = await runWithConcurrency(targetUids, async (uid) => {
      const schema = strapi.contentTypes?.[uid];
      if (!schema) {
        return { uid, schema: null, entries: [] };
      }

      try {
        const entries = await withTimeout(fetchEntriesByUid(uid, schema.kind, strapi, locale), UID_QUERY_TIMEOUT_MS);
        return { uid, schema, entries };
      } catch (error) {
        strapi.log.warn(`[content-search] skipped ${uid}: ${String(error?.message || error)}`);
        return { uid, schema, entries: [] };
      }
    });

    const foundPages = new Set();
    const foundLoans = new Map();
    const foundNews = new Map();

    for (const result of scanResults) {
      const schema = result?.schema;
      if (!schema || !Array.isArray(result.entries) || !result.entries.length) {
        continue;
      }

      for (const entry of result.entries) {
        const searchableText = [getDirectSearchText(entry), flattenSearchText(entry)].filter(Boolean).join(' ');
        if (!searchableText || !searchableText.includes(searchWord)) {
          continue;
        }

        if (loanUid && result.uid === loanUid) {
          const id = String(entry?.documentId || entry?.id || '');
          if (!id) {
            continue;
          }
          foundLoans.set(id, { id, name: getLoanName(entry) });
          continue;
        }

        if (newsUid && result.uid === newsUid) {
          const id = String(entry?.documentId || entry?.id || '');
          if (!id) {
            continue;
          }
          foundNews.set(id, { id, name: getNewsName(entry) });
          continue;
        }

        if (schema.kind === 'singleType') {
          foundPages.add(pageNameFromUid(result.uid));
        }
      }
    }

    const response = {
      word: rawWord,
      ...(locale ? { locale } : {}),
      foundIn: {
        pages: Array.from(foundPages),
        loans: Array.from(foundLoans.values()),
        news: Array.from(foundNews.values()),
      },
    };

    setCachedResponse(cacheKey, response);
    return response;
  },
};
