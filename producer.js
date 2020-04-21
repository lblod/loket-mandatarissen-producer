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
  const subjectsWithConfig = await getRelevantSubjects(delta);

  const updatedDeltas = [];

  for (let changeSet of delta) {
    const updatedChangeSet = { inserts: [], deletes: [] };

    const exportedUris = [];
    for (let triple of changeSet.inserts) {
       // assume every subject has only 1 matching type in the export config. Otherwise we should use filter instead of find
      const config = subjectsWithConfig.find(s => s.subject == triple.subject.value);
      if (config) {
        const inserts = handleInsertedDeltaTriple(triple, config.typeConfig, exportedUris);
        updatedChangeSet.inserts.push(...inserts);
      }
    }

    for (let triple of changeSet.deletes) {
      // assume every subject has only 1 matching type in the export config. Otherwise we should use filter instead of find
      const config = subjectsWithConfig.find(s => s.subject == triple.subject.value);
      if (config) {
        const deletes = handleDeletedDeltaTriple(triple, config.typeConfig, exportedUris);
        updatedChangeSet.deletes.push(...deletes);
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

  console.log(`Received deltas for ${subjects.length} subjects`);

  const relevantSubjects = [];
  for (let subject of subjects) {
    const typeConfigs = await getRelevantTypeConfigs(subject);
    relevantSubjects.push(...typeConfigs.map(t => { return { subject, typeConfig: t }; } ));
  }
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
          console.log(`rdf:type <${type}> configured for export and matching path to concept-scheme. Triples with subject <${subject}> will be exported.`);
        }
        relevantTypes.push(typeConfig);
      } else if (LOG_INCOMING_DELTA_TYPES) {
        console.log(`rdf:type <${type}> configured for export, but not matching path to concept-scheme. Triples with subject <${subject}> be ignored.`);
      }
    } else if (LOG_INCOMING_DELTA_TYPES) {
      console.log(`rdf:type <${type}> not configured for export.`);
    }
  }

  return relevantTypes;
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
 * The exportedUris array serves as a cache to make we don't export the same resource multiple times
*/
async function handleInsertedDeltaTriple(triple, typeConfig, exportedUris) {
  const subject = triple.subject.value;
  const inserts = [];

  if (triple.predicate.value == 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
    if (LOG_DELTA_MATCHING)
      console.log(`Adding resource <${subject}> to insert-block of export and recursively following relations`);
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
      console.log(`Adding triple <${subject}> <${triple.predicate.value}> ${triple.object.value} to insert-block of export`);
    inserts.push(triple);
  }
  // else: triple doesn't need to be exported. Just ignore.

  return inserts;
}

/**
 * Construct the triples to be exported for a given subject URI based on the export configuration.
 * Recursively export related resources. I.e. resources linked via a 'relation' in the export config.
 *
 * The exportedUris array serves as a cache to make we don't export the same resource multiple times
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
 * Get triples to remove for a given deleted delta triple based on the export config
 *
 * Deletion of 1 triple may lead to a bunch of triples to be deleted in the export,
 * because the removed triple breaks the path to the export concept scheme.
 *
 * E.g. Unlinking a person from a mandate may cause the deletion of the person, but as well
 *      the deletion of the mandate, the mandatee, the administrative unit etc.
*/
async function handleDeletedDeltaTriple(triple, typeConfig, exportedUris) {
  const subject = triple.subject.value;
  const deletes = [];

  if (triple.predicate.value == 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
    // TODO: deletion of a type. Requires deletion of the full resource and related resources if they are not linked to a bestuurseenheid anymore
  } else if (typeConfig.relations.includes(triple.predicate.value)) {
    // TODO: deletion of a relation. Requires deletion of related resource if it's not linked to a bestuurseenheid anymore (recursively until bestuurseenheid is reached)
  } else if (typeConfig.properties.includes(triple.predicate.value)) { // 'normal' property, copy the triple
    if (LOG_DELTA_MATCHING)
      console.log(`Adding triple <${subject}> <${triple.predicate.value}> ${triple.object.value} to delete-block of export`);
    deletes.push(triple);
  }
  // else: triple doesn't need to be exported. Just ignore.

  return deletes;
}


export {
  produceMandateesDelta
}
