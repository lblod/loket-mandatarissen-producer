import { uuid, sparqlEscapeUri } from 'mu';
import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';
import uniq from 'lodash.uniq';
import flatten from 'lodash.flatten';
import exportConfig from './config/export';
import { isInverse, sparqlEscapePredicate, normalizePredicate, serializeTriple, isSamePath } from './utils';
import {
  LOG_INCOMING_DELTA_TYPES,
  LOG_DELTA_REWRITE
} from './env-config';

// TODO add support for a prefix map in the export configuration
//      preprocess the imported config by resolving all prefixed URIs with full URIs

/**
 * Rewriting the incoming delta message to a delta message relevant for the mandatee export
*/
async function produceMandateesDelta(delta) {
  const updatedDeltas = [];

  for (let changeSet of delta) {
    const updatedChangeSet = { inserts: [], deletes: [] };

    const typeCache = await buildTypeCache(changeSet);

    if (LOG_DELTA_REWRITE)
      console.log(`Rewriting inserted changeSet containing ${changeSet.inserts.length} triples`);
    const inserts = await rewriteInsertedChangeset(changeSet.inserts, typeCache);
    updatedChangeSet.inserts.push(...inserts);

    if (LOG_DELTA_REWRITE)
      console.log(`Rewriting deleted changeSet containing ${changeSet.deletes.length} triples`);
    const deletes = await rewriteDeletedChangeset(changeSet.deletes, typeCache);
    updatedChangeSet.deletes.push(...deletes);

    if (updatedChangeSet.inserts.length || updatedChangeSet.deletes.length)
      updatedDeltas.push(updatedChangeSet);
  }

  // TODO optimization: remove sequential changesets that insert/delete exactly the same triples (or vice versa)

  return updatedDeltas;
}

/**
 * Build a mapping of URIs to their export config for each subject/object URI in a changeset
 * based on the rdf:type of the URI. The mapping will be used as an in-memory cache.
 * There may be multiple entries in the mapping for a specific URI. Either, the URI has
 * multiple rdf:type or there are multiple export configurations for one rdf:type.
 *
 * For deletions it's important to note that the deleted data is not available anymore
 * in the store since the data has been deleted. That's why the rdf:type for a URI is retrieved
 * from the triple store as well as from the delta changeset.
 *
 * Building the cache is purely based on rdf:type and does not take the path from
 * a resource to the export concept scheme into account.
 *
 * @param object changeSet Delta changeset including `inserts` and `deletes`
 * @return Array Array of objects like { uri, config }
*/
async function buildTypeCache(changeSet) {
  const cache = [];

  const triples = [...changeSet.inserts, ...changeSet.deletes];
  const subjects = triples.map(t => t.subject.value);
  const objects = triples.filter(t => t.object.type == 'uri').map(t => t.object.value);
  const uris = uniq([...subjects, ...objects]);
  if (LOG_DELTA_REWRITE)
    console.log(`Building type cache for ${uris.length} URIs based on types found in the store and the changeset.`);

  for (let uri of uris) {
    const result = await query(`SELECT DISTINCT ?type WHERE { ${sparqlEscapeUri(uri)} a ?type }`);
    const typesFromStore = result.results.bindings.map(b => b['type'].value);
    const typesFromChangeset = triples.filter(t => t.subject.value == uri && t.predicate.value == 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type').map(t => t.object.value);
    const types = uniq([...typesFromStore, ...typesFromChangeset]);
    if (LOG_DELTA_REWRITE)
      console.log(`Found ${types.length} distinct types for URI <${uri}>.`);

    for (let type of types) {
      const typeConfigs = exportConfig.export.filter(t => t.type == type);
      if (typeConfigs.length) {
        if (LOG_DELTA_REWRITE)
          console.log(`rdf:type <${type}> configured for export.`);
        const cacheEntries = typeConfigs.map(config => { return { uri, config }; });
        cache.push(...cacheEntries);
      } else if (LOG_DELTA_REWRITE) {
        console.log(`rdf:type <${type}> is not configured for export and will be ignored.`);
      }
    }
  }

  return cache;
}

/**
 * Rewrite the received triples to insert to an insert changeset relevant for the export of mandatees.
 *
 * Insertion of 1 triple may lead to a bunch of resources to be exported,
 * because the newly inserted triple completes the path to the export concept scheme.
 *
 * E.g. Linking a mandatee to a mandate may cause the export of the mandate, but as well
 *      the export of the person, the person's birthdate etc.
 *
 * High-level description of the function:
 * The function first walks over the received insert changeset
 * and checks for each triple whether it should be exported based
 * on the subject's type and the export configuration.
 * Next, for each inserted relation triple (ie. object is a URI, not a literal)
 * it checks whether the subject/object needs to be added as an additional resource
 * based on the predicate and the export configuration.
 * This enrichment is checked recursively for any newly added relation triple as well.
*/
async function rewriteInsertedChangeset(changeSet, typeCache) {
  const triplesToInsert = [];

  // For each triple of the changeset, check if it is relevant for the export.
  // Ie. the subject has a path to the export concept-scheme and the predicate is configured to be exported
  for (let triple of changeSet) {
    const subject = triple.subject.value;
    const exportConfigurations = typeCache.filter(e => e.uri == subject).map(e => e.config);
    if (exportConfigurations.length) {
      for (let config of exportConfigurations) {
        const isInScope = await hasPathToExportConceptScheme(subject, config);
        const predicate = triple.predicate.value;
        const isConfiguredForExport = predicate == 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' || config.properties.includes(predicate);
        if (isInScope && isConfiguredForExport) {
          if (LOG_DELTA_REWRITE)
            console.log(`Triple ${serializeTriple(triple)} copied to insert changeset for export.`);
          triplesToInsert.push(triple);
          break; // no need to check the remaining export configurations since triple is already copied to the resulting changeset
        } else if (LOG_DELTA_REWRITE) {
          if (!isInScope)
            console.log(`No path to export concept scheme found for subject <${subject}>.`);
          else if (!isConfiguredForExport)
            console.log(`Predicate <${predicate}> not configured for export for type <${config.type}>.`);
        }
        if (LOG_DELTA_REWRITE)
          console.log(`Triple ${serializeTriple(triple)} not relevant for export and will be ignored.`);
      }
    } else if (LOG_DELTA_REWRITE) {
      console.log(`Triple ${serializeTriple(triple)} has a rdf:type that is not configured for export and will be ignored.`);
    }
  }

  const processedResources = []; // tmp cache of recursively added resources
  const enrichments = await enrichInsertedChangeset(changeSet, typeCache, processedResources);
  if (LOG_DELTA_REWRITE) {
    console.log(`Checked ${processedResources.length} additional resources to insert.`);
    console.log(`Adding ${enrichments.length} triples to insert to the changeset.`);
  }
  triplesToInsert.push(...enrichments);

  return triplesToInsert;
}

/**
 * Enrich the insert changeset with resources that become
 * relevant for the export based on the triples in the original insert changeset.
 * Ie. 'deeper' resources that now also have a complete path to the export concept scheme.
 * Eg. insertion of a mandatee may cause the insertion of the person resource as well.
 *
 * The function is recursively applied to insert new related resources for the resources
 * that have just been added.
 * Eg. addition of the person in the previous example may cause the insertion
 * of the person's birthdate as well.
*/
async function enrichInsertedChangeset(changeSet, typeCache, processedResources) {
  const impactedResources = getImpactedResources(changeSet, typeCache);

  const triplesToInsert = [];
  for (let { uri, config } of impactedResources) {
    const id = [config.type, ...config.pathToConceptScheme].join('-');
    if (!processedResources.includes(id)) {
      processedResources.push(id); // make sure to handle each resource only once
      const isInScope = await hasPathToExportConceptScheme(uri, config);
      if (isInScope) {
        if (LOG_DELTA_REWRITE)
          console.log(`Enriching insert changeset with export of resource <${uri}>.`);
        const resourceExport = await exportResource(uri, config);
        triplesToInsert.push(...resourceExport);

        if (LOG_DELTA_REWRITE)
          console.log(`Recursively checking for enrichments based on the newly inserted triples for resource <${uri}>.`);
        const recursiveTypeCache = await buildTypeCache({ inserts: resourceExport, deletes: [] });
        const recursiveTriples = await enrichInsertedChangeset(resourceExport, recursiveTypeCache, processedResources);
        triplesToInsert.push(...recursiveTriples);
      } else if (LOG_DELTA_REWRITE) {
        console.log(`Resource <${uri}> doesn't have a path to the export concept scheme. Ignoring this resource.`);
      }
    } else {
      if (LOG_DELTA_REWRITE)
        console.log(`Resource <${uri}> already added to export for given config. Ignoring now.`);
    }
  }

  return triplesToInsert;
}


/**
 * Rewrite the received triples to delete to a delete changeset relevant for the export of mandatees.
 *
 * Deletion of 1 triple may lead to a bunch of resources to be deleted,
 * because the deleted triple breaks the path to the export concept scheme.
 *
 * E.g. Deletion of a mandatee may cause the deletion of the person as well,
 *       unless the person is still related to another mandatee.
 *
 * Note: additional triples to delete are computed only based on the data that is still
 * in the store. Other triples that need to be deleted, that are not in the store anymore,
 * will arrive in (different) delta changesets.
*/
async function rewriteDeletedChangeset(changeSet, typeCache) {
  const triplesToDelete = [];

  // For each triple of the changeset, check if it is relevant for the export.
  // Ie. the subject doesn't have any path to the export concept-scheme and the predicate is configured to be exported
  // There is an implicit assumption that a resource only has 1 kind-of path to the export CS (but there may be multiple instances of this path)
  for (let triple of changeSet) {
    const subject = triple.subject.value;
    const exportConfigurations = typeCache.filter(e => e.uri == subject).map(e => e.config);
    if (exportConfigurations.length) {
      for (let config of exportConfigurations) {
        // No need to check the path to the export concept scheme. We want to copy the deletion in either case.
        // E.g. deletion of the end date of a mandatee must be copied, whether the mandatee is still related to the export concept scheme or not
        const predicate = triple.predicate.value;
        const isConfiguredForExport = predicate == 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' || config.properties.includes(predicate);
        if (isConfiguredForExport) {
          if (LOG_DELTA_REWRITE)
            console.log(`Triple ${serializeTriple(triple)} copied to delete changeset for export.`);
          triplesToDelete.push(triple);
          break; // no need to check the remaining export configurations since triple is already copied to the resulting changeset
        } else if (LOG_DELTA_REWRITE) {
          console.log(`Predicate <${predicate}> not configured for export for type <${config.type}>.`);
        }
        if (LOG_DELTA_REWRITE)
          console.log(`Triple ${serializeTriple(triple)} not relevant for export and will be ignored.`);
      }
    } else if (LOG_DELTA_REWRITE) {
      console.log(`Triple ${serializeTriple(triple)} has a rdf:type that is not configured for export and will be ignored.`);
    }
  }

  const processedResources = []; // tmp cache of recursively deleted resources
  const enrichments = await enrichDeletedChangeset(changeSet, typeCache, processedResources);
  if (LOG_DELTA_REWRITE) {
    console.log(`Checked ${processedResources.length} additional resources to delete.`);
    console.log(`Adding ${enrichments.length} triples to delete to the changeset.`);
  }
  triplesToDelete.push(...enrichments);

  return triplesToDelete;
}

/**
 * Enrich the delete changeset with resources that become irrelevant for the export
 * based on the triples in the original delete changeset.
 * Ie. 'deeper' resources that now don't have a complete path to the export concept scheme anymore.
 * Eg. deletion of a mandatee may cause the deletion of the person resource as well.
 *
 * The function is recursively applied to delete additional related resources
 * for the resources that have just been added to the delete changeset.
 * Eg. deletion of the person in the previous example may cause the deletion
 * of the person's birthdate as well.
*/
async function enrichDeletedChangeset(changeSet, typeCache, processedResources) {
  const impactedResources = getImpactedResources(changeSet, typeCache);

  const triplesToDelete = [];
  for (let { uri, config } of impactedResources) {
    const id = [config.type, ...config.pathToConceptScheme].join('-');
    if (!processedResources.includes(id)) {
      processedResources.push(id); // make sure to handle each resource only once
      const isOutOfScope = !(await hasPathToExportConceptScheme(uri, config));
      if (isOutOfScope) {
        if (LOG_DELTA_REWRITE)
          console.log(`Enriching delete changeset with export of resource <${uri}>.`);
        const resourceExport = await exportResource(uri, config);
        triplesToDelete.push(...resourceExport);

        if (LOG_DELTA_REWRITE)
          console.log(`Recursively checking for enrichments based on the newly deleted triples for resource <${uri}>.`);
        const recursiveTypeCache = await buildTypeCache({ inserts: [], deletes: resourceExport });
        const recursiveTriples = await enrichDeletedChangeset(resourceExport, recursiveTypeCache, processedResources);
        triplesToDelete.push(...recursiveTriples);
      }
    } else {
      if (LOG_DELTA_REWRITE)
        console.log(`Resource <${uri}> already removed from export for given config. Ignoring now.`);
    }
  }

  return triplesToDelete;
}

/**
 * Get all possibly impacted resources by a changeset of triples. Impacted resources are subject/objects
 * of the triples in the changeSet for which a relation (predicate) has been inserted/deleted, that may
 * cause the resource to be included/excluded from the export.
 *
 * This function is the most complex part of the delta rewriting. The reasoning, which is explained in
 * inline documentation, can be best understood by creating a diagram of all configured types to export
 * and their path to the export concept scheme.
 *
 * Note: this function returns any possibly impacted resources. Whether the resource is
 * (ir)relevant for the export (ie. it has/doesn't have a path to the export concept scheme)
 * is validated in the enrichInserted/DeletedChangeset functions.
*/
function getImpactedResources(changeSet, typeCache) {
  const resources = [];

  const relations = changeSet.filter(t => t.object.type == 'uri');
  if (LOG_DELTA_REWRITE)
    console.log(`Found ${relations.length} triples in the changeset that are relations to other resources. They may possibly impact the export.`);

  for (let triple of relations) {
    // Add all subjects of triples with a predicate that equals the last (deepest) path segment
    // to the export CS in the export configuration of the subject's type
    // E.g. on insertion of the triple <mandatee-x> org:holds <mandate-a>
    // the full mandatee-x resource needs to be inserted (similar for delete)
    const subject = triple.subject.value;
    const exportConfigurations = typeCache.filter(e => e.uri == subject).map(e => e.config);
    if (LOG_DELTA_REWRITE)
      console.log(`Subject ${subject} has ${exportConfigurations.length} export configurations.`);

    const subjectExports = exportConfigurations.filter(config => config.pathToConceptScheme[0] == triple.predicate.value);
    for (let config of subjectExports) {
      if (LOG_DELTA_REWRITE)
        console.log(`Relation triple with subject <${subject}> with type <${config.type}> and predicate <${triple.predicate.value}> may have an impact on the export.`);
      resources.push({ uri: subject, config: config });
    }

    // Add all objects of triples with a predicate that is the inverse of the last path segment
    // to the export CS in the export configuration of the object's type
    // E.g. on insertion of the triple <mandate-a> besluit:isBestuurlijkeAliasVan <person-x>
    // the full person-x resource needs to be inserted (similar for delete)
    const object = triple.object.value;
    const objectTypes = uniq(typeCache.filter(e => e.uri == object).map(e => e.config.type));
    if (LOG_DELTA_REWRITE)
      console.log(`Object ${object} has ${objectTypes.length} types in the cache.`);

    if (objectTypes.length) {
      for (let config of exportConfigurations) {
        const deeperConfigurations = getChildConfigurations(config)
              .filter(config => objectTypes.includes(config.type) && config.pathToConceptScheme[0] == `^${triple.predicate.value}`);
        for (let deeperConfig of deeperConfigurations) {
          if (LOG_DELTA_REWRITE)
            console.log(`Relation triple with object <${object}> with type <${deeperConfig.type}> and predicate <${triple.predicate.value}> may have an impact on the export.`);
          resources.push({ uri: object, config: deeperConfig });
        }
      }
    }
  }

  if (LOG_DELTA_REWRITE)
    console.log(`Found ${resources.length} triple that may cause the insertion/deletion of additional resources in the export.`);

  return resources;
}

/**
 * Construct the triples to be exported (inserted/deleted) for a given subject URI
 * based on the export configuration and the triples in the triplestore
*/
async function exportResource(uri, config) {
  const delta = [];

  delta.push({
    subject: { type: 'uri', value: uri },
    predicate: { type: 'uri', value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' },
    object: { type: 'uri', value: config.type }
  });

  for (let prop of config.properties) {
    const result = await query(`SELECT DISTINCT ?o WHERE { ${sparqlEscapeUri(uri)} ${sparqlEscapePredicate(prop)} ?o }`);

    for (let b of result.results.bindings) {
      const relatedUri = b['o'].value;
      if (isInverse(prop)) {
        delta.push({
          subject: { type: 'uri', value: relatedUri },
          predicate: { type: 'uri', value: normalizePredicate(prop) },
          object: { type: 'uri', value: uri }
        });
      } else {
        delta.push({
          subject: { type: 'uri', value: uri },
          predicate: { type: 'uri', value: normalizePredicate(prop) },
          object: b['o']
        });
      }
    }
  }

  return delta;
}


/**
 * Returns child configurations a given config.
 * Ie. all configurations with a path that is 1 segment deeper than the given configuration.
*/
function getChildConfigurations(config) {
  return exportConfig.export.filter(child => {
    return child.pathToConceptScheme.length == config.pathToConceptScheme.length + 1
      && isSamePath(child.pathToConceptScheme.slice(1), config.pathToConceptScheme);
  });
}

/**
 * Returns whether the given subject has a path to the export concept scheme for the given export configuration
*/
async function hasPathToExportConceptScheme(subject, config) {
  const predicatePath = config.pathToConceptScheme.map(p => sparqlEscapePredicate(p)).join('/');
  const result = await query(`
    SELECT ?p WHERE {
      ${sparqlEscapeUri(subject)} ${predicatePath} ${sparqlEscapeUri(exportConfig.conceptScheme)} ; ?p ?o .
    } LIMIT 1
  `);
  return result.results.bindings.length;
}

export {
  produceMandateesDelta
}
