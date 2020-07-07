import { uuid, sparqlEscapeUri } from 'mu';
import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';
import uniq from 'lodash.uniq';
import flatten from 'lodash.flatten';
import config from './config/export';
import { isInverse, sparqlEscapePredicate, normalizePredicate } from './utils';
import {
  LOG_INCOMING_DELTA_TYPES,
  LOG_DELTA_MATCHING
} from './env-config';

async function produceMandateesDelta(delta) {
  // Build a local cache of subjects relevant for the export with their according type configs for export
  const subjectsWithConfig = await getRelevantSubjects(delta);

  const updatedDeltas = [];

  // Rewriting the incoming delta message to a delta message relevant for the mandatee export
  for (let changeSet of delta) {
    const updatedChangeSet = { inserts: [], deletes: [] };

    let exportedUris = []; // local cache to keep track of already exported URIs in the recursive function

    for (let triple of changeSet.inserts) {
      const configs = subjectsWithConfig.filter(s => s.subject == triple.subject.value);
      for (let config of configs) {
        const inserts = await rewriteInsertedDeltaTriple(triple, config.typeConfig, exportedUris);
        updatedChangeSet.inserts.push(...inserts);
      }
    }

    exportedUris = [];
    const subjectsToDelete = changeSet.deletes.filter(t => t.predicate.value == 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type').map(t => t.subject.value);
    for (let triple of changeSet.deletes) {
      // All subjects with an rdf:type-triple in the changeset are considered to be deleted completly
      // We make the assumption all triples to be deleted for the resource are included in the same changeset (this holds for deletions via mu-cl-resources)
      // TODO: should we query for additional properties to be removed in the DB?
      if (subjectsToDelete.includes(triple.subject.value)) {
        if (LOG_DELTA_MATCHING) {
          console.log(`Resource with URI <${triple.subject.value}> must be completly deleted`);
          console.log(`Adding triple <${triple.subject.value}> <${triple.predicate.value}> ${triple.object.type == 'uri' ? '<' + triple.object.value + '>' : '"' + triple.object.value + '"' } to delete-block of export`);
        }
        updatedChangeSet.deletes.push(triple);
        // TODO: should we walk down the path recursively to see whether more resources need to be deleted if they don't have a path to the CS anymore
      } else {
        // Handling of deletion of triples for which the subject still has an rdf:type in the database. I.e. update of a property/relation for an existing resource.
        // These triples follow the same logic as inserted triples: the delta's must only be synced if the resource is in scope of the export
        const configs = subjectsWithConfig.filter(s => s.subject == triple.subject.value);
        for (let config of configs) {
          const deletes = await rewriteDeletedDeltaTriple(triple, config.typeConfig, exportedUris);
          updatedChangeSet.deletes.push(...deletes);
        }
      }
    }

    if (updatedChangeSet.inserts.length || updatedChangeSet.deletes.length)
      updatedDeltas.push(updatedChangeSet);
  }

  return updatedDeltas;
}

/**
 * Get the configured type exports for each subject in the given delta.
*/
async function getRelevantSubjects(delta) {
  const inserts = flatten(delta.map(cs => cs.inserts));
  const deletes = flatten(delta.map(cs => cs.deletes));
  const triples = [...inserts, ...deletes];
  const subjects = uniq(triples.map(t => t.subject.value));

  if (LOG_DELTA_MATCHING)
    console.log(`Received deltas for ${subjects.length} subjects. Going to check whether they are relevant for the export now.`);

  const relevantSubjects = [];
  for (let subject of subjects) {
    const typeConfigs = await getRelevantTypeConfigs(subject);
    relevantSubjects.push(...typeConfigs.map(t => { return { subject, typeConfig: t }; } ));
  }

  if (LOG_DELTA_MATCHING)
    console.log(`Found ${relevantSubjects.length} subjects that are relevant for the export: [${relevantSubjects.map(s => s.subject).join(',')}]`);

  return relevantSubjects;
}

/**
 * Get the export config for the type(s) of the given subject
 * if the type is configured to be exported and there is a complete path from the subject to the export concept scheme.
 *
 * @return Array of type configs as configured for export
*/
async function getRelevantTypeConfigs(subject) {
  const result = await query(`SELECT DISTINCT ?type WHERE { ${sparqlEscapeUri(subject)} a ?type }`);
  const types = result.results.bindings.map(b => b['type'].value);

  const relevantTypes = [];

  for (let type of types) {
    const typeConfig = config.export.find(t => t.type == type);
    if (typeConfig) { // resource of this type must be exported
      const predicatePath = typeConfig.pathToConceptScheme.map(p => sparqlEscapePredicate(p)).join('/');
      const result = await query(`
        SELECT ?p WHERE {
          ${sparqlEscapeUri(subject)} ${predicatePath} ${sparqlEscapeUri(config.conceptScheme)} ; ?p ?o .
        } LIMIT 1
      `);

      if (result.results.bindings.length) {
        if (LOG_INCOMING_DELTA_TYPES) {
          console.log(`rdf:type <${type}> configured for export and matching path to concept-scheme found. Triples with subject <${subject}> will be exported.`);
        }
        relevantTypes.push(typeConfig);
      } else if (LOG_INCOMING_DELTA_TYPES) {
        console.log(`rdf:type <${type}> configured for export, but no matching path to concept-scheme found. Triples with subject <${subject}> will be ignored.`);
      }
    } else if (LOG_INCOMING_DELTA_TYPES) {
      console.log(`rdf:type <${type}> not configured for export.`);
    }
  }

  return relevantTypes;
}

/**
 * Get the export config for the type(s) of the given subject
 * if the type is configured to be exported and there is no complete path from the subject to the export concept scheme.
 *
 * @return Array of type configs as configured for export
*/
async function getOutOfScopeTypeConfigs(subject) {
  const result = await query(`SELECT DISTINCT ?type WHERE { ${sparqlEscapeUri(subject)} a ?type }`);
  const types = result.results.bindings.map(b => b['type'].value);

  const outOfScopeTypes = [];

  for (let type of types) {
    const typeConfig = config.export.find(t => t.type == type);
    if (typeConfig) { // resource of this type is relevant for export
      const predicatePath = typeConfig.pathToConceptScheme.map(p => sparqlEscapePredicate(p)).join('/');
      const result = await query(`
        SELECT ?p WHERE {
          ${sparqlEscapeUri(subject)} ${predicatePath} ${sparqlEscapeUri(config.conceptScheme)} ; ?p ?o .
        } LIMIT 1
      `);

      if (result.results.bindings.length) {
        if (LOG_INCOMING_DELTA_TYPES) {
          console.log(`rdf:type <${type}> configured for export and matching path to concept-scheme found. Triples with subject <${subject}> are still relevant.`);
        }
        return []; // no need to further process the types. The subject should remain in the export.
      } else if (LOG_INCOMING_DELTA_TYPES) {
        console.log(`rdf:type <${type}> is in scope for export. No matching path to concept-scheme found so triples with subject <${subject}> might not be relevant anymore.`);
        outOfScopeTypes.push(type);
      }
    } else if (LOG_INCOMING_DELTA_TYPES) {
      console.log(`rdf:type <${type}> is out of scope for export.`);
    }
  }

  return outOfScopeTypes;
}

/**
 * Get triples to insert for a given inserted delta triple based on the export config
 *
 * Insertion of 1 triple may lead to a bunch of triples to be exported,
 * because the newly inserted triple completes the path to the export concept scheme.
 *
 * E.g. Linking a person to a mandate may cause the export of the person, but as well
 *      the export of the mandate, the mandatee, the administrative unit etc.
 *
 * The exportedUris array serves as a temporary cache to make sure we don't export the same resource multiple times
*/
async function rewriteInsertedDeltaTriple(triple, typeConfig, exportedUris) {
  const subject = triple.subject.value;
  const inserts = [];

  if (triple.predicate.value == 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
    if (LOG_DELTA_MATCHING)
      console.log(`Adding resource <${subject}> to insert-block of export and recursively following relations`);
    inserts.push(triple);
    const updatedDelta = await constructExportForInsert(subject, exportedUris);
    inserts.push(...updatedDelta);
  } else if (typeConfig.relations.includes(triple.predicate.value)) {
    if (LOG_DELTA_MATCHING)
      console.log(`Adding triple <${subject}> <${triple.predicate.value}> ${triple.object.value} to insert-block of export and recursively following relations of the object`);
    inserts.push(triple);
    const updatedDelta = await constructExportForInsert(triple.object.value, exportedUris);
    inserts.push(...updatedDelta);
  } else if (typeConfig.properties.includes(triple.predicate.value)) { // 'normal' property, copy the triple
    if (LOG_DELTA_MATCHING)
      console.log(`Adding triple <${subject}> <${triple.predicate.value}> ${triple.object.type == 'uri' ? '<' + triple.object.value + '>' : '"' + triple.object.value + '"' } to insert-block of export`);
    inserts.push(triple);
  }
  // else: triple doesn't need to be exported. Just ignore.

  return inserts;
}

/**
 * Get triples to remove for a given deleted delta triple based on the export config
 *
 * Deletion of 1 triple may lead to a bunch of triples to be deleted in the export,
 * because the removed triple breaks the path to the export concept scheme.
 *
 * E.g. Unlinking a person from a mandate may cause the deletion of the person, but as well
 *      the deletion of the mandate, the mandatee, the administrative unit etc.
 *
 * This method works under the assumption that the subject is not completly deleted so
 * the rdf:type can still be found in the triplestore.
*/
async function rewriteDeletedDeltaTriple(triple, typeConfig, exportedUris) {
  const subject = triple.subject.value;
  const deletes = [];

  if (triple.predicate.value == 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
    console.log(`Deleted triples with rdf:type as predicate should already be handled before. Ignoring triple <${subject}> <${triple.predicate.value}> ${triple.object.value}.`);
  } else if (typeConfig.relations.includes(triple.predicate.value)) {
    if (LOG_DELTA_MATCHING)
      console.log(`Adding triple <${subject}> <${triple.predicate.value}> ${triple.object.value} to delete-block of export and recursively following relations of the object`);
    deletes.push(triple);
    const updatedDelta = await constructExportForDelete(triple.object.value, exportedUris);
    deletes.push(...updatedDelta);
  } else if (typeConfig.properties.includes(triple.predicate.value)) {
    if (LOG_DELTA_MATCHING)
      console.log(`Adding triple <${subject}> <${triple.predicate.value}> ${triple.object.type == 'uri' ? '<' + triple.object.value + '>' : '"' + triple.object.value + '"' } to delete-block of export`);
    deletes.push(triple);
  }
  // else: triple doesn't need to be exported. Just ignore.

  return deletes;
}


/**
 * Construct the triples to be exported for a given subject URI based on the export configuration.
 * Recursively export related resources. I.e. resources linked via a 'relation' in the export config.
 *
 * The exportedUris array serves as a temporary cache to make sure we don't export the same resource multiple times
*/
async function constructExportForInsert(uri, exportedUris = []) {
  exportedUris.push(uri);

  const delta = [];
  const typeConfigs = await getRelevantTypeConfigs(uri);

  // Export properties
  const properties = uniq(flatten(typeConfigs.map(t => t.properties)));
  for (let prop of properties) {
    const result = await query(`SELECT DISTINCT ?o WHERE { ${sparqlEscapeUri(uri)} ${sparqlEscapeUri(prop)} ?o }`);
    const triples = result.results.bindings.map(b => b['o']).map(obj => {
      if (isInverse(prop)) {
        return {
          subject: obj,
          predicate: { type: 'uri', value: normalizePredicate(prop) },
          object: { type: 'uri', value: uri }
        };
      } else {
        return {
          subject: { type: 'uri', value: uri },
          predicate: { type: 'uri', value: normalizePredicate(prop) },
          object: obj
        };
      }
    });
    delta.push(...triples);
  }

  // Export relations
  const relations = uniq(flatten(typeConfigs.map(t => t.relations)));
  for (let rel of relations) {
    const result = await query(`SELECT DISTINCT ?o WHERE { ${sparqlEscapeUri(uri)} ${sparqlEscapePredicate(rel)} ?o }`);

    for (let b of result.results.bindings) {
      // Export relation triple
      const relatedUri = b['o'].value;
      if (isInverse(rel)) {
        delta.push({
          subject: { type: 'uri', value: relatedUri },
          predicate: { type: 'uri', value: normalizePredicate(rel) },
          object: { type: 'uri', value: uri }
        });
      } else {
        delta.push({
          subject: { type: 'uri', value: uri },
          predicate: { type: 'uri', value: normalizePredicate(rel) },
          object: { type: 'uri', value: relatedUri }
        });
      }

      // Export related resource recursively
      if (!exportedUris.includes(relatedUri)) {
        const relatedTriples = await constructExportForInsert(relatedUri, exportedUris);
        delta.push(...relatedTriples);
      }
      // else related resource has already been exported
    }
  }

  return delta;
}

/**
 * Construct the triples to be deleted for a given subject URI based on the export configuration.
 * Recursively delete related resources. I.e. resources linked via a 'relation' in the export config.
 *
 * The exportedUris array serves as a temporary cache to make sure we don't export the same resource multiple times
*/
async function constructExportForDelete(uri, exportedUris = []) {
  exportedUris.push(uri);

  // Check if the resource has a path to the bestuurseenheid in the store
  // If not, deltas to remove the resource must be generated and the export path must be walked down recursively
  // If it has, the resource should remain. No need to walk down the path further

  const delta = [];
  const typeConfigs = await getOutOfScopeTypeConfigs(uri);

  // Export properties
  const properties = uniq(flatten(typeConfigs.map(t => t.properties)));
  for (let prop of properties) {
    const result = await query(`SELECT DISTINCT ?o WHERE { ${sparqlEscapeUri(uri)} ${sparqlEscapeUri(prop)} ?o }`);
    const triples = result.results.bindings.map(b => b['o']).map(obj => {
      if (isInverse(prop)) {
        return {
          subject: obj,
          predicate: { type: 'uri', value: normalizePredicate(prop) },
          object: { type: 'uri', value: uri }
        };
      } else {
        return {
          subject: { type: 'uri', value: uri },
          predicate: { type: 'uri', value: normalizePredicate(prop) },
          object: obj
        };
      }
    });
    delta.push(...triples);
  }

  // Export relations
  const relations = uniq(flatten(typeConfigs.map(t => t.relations)));
  for (let rel of relations) {
    const result = await query(`SELECT DISTINCT ?o WHERE { ${sparqlEscapeUri(uri)} ${sparqlEscapePredicate(rel)} ?o }`);

    for (let b of result.results.bindings) {
      // Export relation triple
      const relatedUri = b['o'].value;
      if (isInverse(rel)) {
        delta.push({
          subject: { type: 'uri', value: relatedUri },
          predicate: { type: 'uri', value: normalizePredicate(rel) },
          object: { type: 'uri', value: uri }
        });
      } else {
        delta.push({
          subject: { type: 'uri', value: uri },
          predicate: { type: 'uri', value: normalizePredicate(rel) },
          object: { type: 'uri', value: relatedUri }
        });
      }

      // Export related resource recursively
      if (!exportedUris.includes(relatedUri)) {
        const relatedTriples = await constructExportForDelete(relatedUri, exportedUris);
        delta.push(...relatedTriples);
      }
      // else related resource has already been exported
    }
  }

  return delta;
}

export {
  produceMandateesDelta
}
