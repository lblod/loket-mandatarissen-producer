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
  const predicate = isInverse(triple.predicate.value) ? `<${triple.predicate.value.slice(1)}>` : `<${triple.predicate.value}>`;
  const object = triple.object.type == 'uri' ? `<${triple.object.value}>` : `"${triple.object.value}"`;
  return `<${triple.subject.value}> ${predicate} ${object}`;
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
