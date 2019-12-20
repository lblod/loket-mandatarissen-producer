import { uuid, sparqlEscapeUri } from 'mu';
import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';
import uniq from 'lodash.uniq';
import flatten from 'lodash.flatten';
import config from './config/export';

const LOG_INCOMING_DELTA_TYPES = process.env.LOG_INCOMING_DELTA_TYPES || true;
const LOG_DELTA_MATCHING = process.env.LOG_DELTA_MATCHING || true;

async function produceMandateesDelta(delta) {
  const subjectsWithConfig = await getRelevantSubjects(delta);

  const updatedDeltas = [];

  for (let changeSet of delta) {
    const updatedChangeSet = { inserts: [], deletes: [] };

    const exportedUris = [];
    for (let triple of changeSet.inserts) {
      const subjectConfig = subjectsWithConfig.find(s => s.subject == triple.subject.value); // assume every subject has only 1 type. Otherwise we should use filter instead of find

      if (subjectConfig) {
        const typeConfig = subjectConfig.typeConfig;
        const subject = subjectConfig.subject;
        if (triple.predicate.value == 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
          if (LOG_DELTA_MATCHING)
            console.log(`Adding resource <${subject}> to insert-block of export and recursively following relations`);
          const updatedDelta = await constructDeltaForInsert(subject, exportedUris);
          updatedChangeSet.inserts.push(...updatedDelta);
        } else if (typeConfig.relations.includes(triple.predicate.value)) {
          if (LOG_DELTA_MATCHING)
            console.log(`Adding triple <${subject}> <${triple.predicate.value}> ${triple.object.value} to insert-block of export and recursively following relations of the object`);
          updatedChangeSet.inserts.push(triple);
          const updatedDelta = await constructDeltaForInsert(triple.object.value, exportedUris);
          updatedChangeSet.inserts.push(...updatedDelta);
        } else if (typeConfig.properties.includes(triple.predicate.value)) { // 'normal' property, copy the triple
          if (LOG_DELTA_MATCHING)
            console.log(`Adding triple <${subject}> <${triple.predicate.value}> ${triple.object.value} to insert-block of export`);
          updatedChangeSet.inserts.push(triple);
        }
        // else: triple doesn't need to be exported. Just ignore.
      }
    }

    for (let triple of changeSet.deletes) {
      const subjectConfig = subjectsWithConfig.find(s => s.subject == triple.subject.value); // assume every subject has only 1 type. Otherwise we should use filter instead of find

      if (subjectConfig) {
        const typeConfig = subjectConfig.typeConfig;
        const subject = subjectConfig.subject;

        if (triple.predicate.value == 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
          // TODO: deletion of a type. Requires deletion of the full resource and related resources if they are not linked to a bestuurseenheid anymore
        } else if (typeConfig.relations.includes(triple.predicate.value)) {
          // TODO: deletion of a relation. Requires deletion of related resource if it's not linked to a bestuurseenheid anymore (recursively until bestuurseenheid is reached)
        } else if (typeConfig.properties.includes(triple.predicate.value)) { // 'normal' property, copy the triple
          if (LOG_DELTA_MATCHING)
            console.log(`Adding triple <${subject}> <${triple.predicate.value}> ${triple.object.value} to delete-block of export`);
          updatedChangeSet.deletes.push(triple);
        }
        // else: triple doesn't need to be exported. Just ignore.
      }
    }

    if (updatedChangeSet.inserts.length || updatedChangeSet.deletes.length)
      updatedDeltas.push(updatedChangeSet);
  }

  return updatedDeltas;
}

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

async function getRelevantTypeConfigs(subject) {
  const result = await query(`SELECT DISTINCT ?type WHERE { ${sparqlEscapeUri(subject)} a ?type }`);
  const types = result.results.bindings.map(b => b['type'].value);

  const relevantTypes = [];

  for (let type of types) {
    const typeConfig = config.export.find(t => t.type == type);
    if (typeConfig) { // resource of this type must be exported
      const predicatePath = typeConfig.pathToConceptScheme.map(p=> p.startsWith('^') ? `^<${p.slice(1)}>` : `<${p}>`).join('/');
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


async function constructDeltaForInsert(uri, exportedUris = []) {
  exportedUris.push(uri);

  const delta = [];
  const typeConfigs = await getRelevantTypeConfigs(uri);

  const properties = uniq(flatten(typeConfigs.map(t => t.properties)));
  for (let prop of properties) {
    const result = await query(`SELECT DISTINCT ?o WHERE { ${sparqlEscapeUri(uri)} ${sparqlEscapeUri(prop)} ?o }`);
    const triples = result.results.bindings.map(b => b['o']);
    delta.push(...triples);
  }

  const relations = uniq(flatten(typeConfigs.map(t => t.relations)));
  for (let rel of relations) {
    const predicate = rel.startsWith('^') ? `^${sparqlEscapeUri(rel.slice(1))}` : sparqlEscapeUri(rel);
    const result = await query(`SELECT DISTINCT ?o WHERE { ${sparqlEscapeUri(uri)} ${predicate} ?o }`);

    for (let b of result.results.bindings) {
      const relatedUri = b['o'].value;

      if (!exportedUris.includes(relatedUri)) {
        const relatedTriples = await constructDeltaForInsert(relatedUri, exportedUris);
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
