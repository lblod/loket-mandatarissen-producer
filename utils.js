import { sparqlEscapeString, sparqlEscapeUri } from 'mu';

function isInverse(predicate) {
  return predicate && predicate.startsWith('^');
}

function sparqlEscapePredicate(predicate) {
  return isInverse(predicate) ? `^<${predicate.slice(1)}>` : `<${predicate}>`;
}

function normalizePredicate(predicate) {
  return isInverse(predicate) ? predicate.slice(1) : predicate;
}

function serializeTriple(triple) {
  const predicate = sparqlEscapePredicate(triple.predicate.value);
  return `${serializeTriplePart(triple.subject)} ${predicate} ${serializeTriplePart(triple.object)}.`;
}

function serializeTriplePart(triplePart){
  if(triplePart.type == 'uri'){
    return sparqlEscapeUri(triplePart.value);
  }
  else {
    if(triplePart.datatype){
      return `${sparqlEscapeString(triplePart.value)}^^${sparqlEscapeUri(triplePart.datatype)}`;
    }
    else {
      return sparqlEscapeString(triplePart.value);
    }
  }
}

/**
 * Returns whether 2 arrays of path segments (as string) are equal
*/
function isSamePath(a, b) {
  return a.join('/') == b.join('/');
}

export {
  isInverse,
  sparqlEscapePredicate,
  normalizePredicate,
  serializeTriple,
  isSamePath
};
