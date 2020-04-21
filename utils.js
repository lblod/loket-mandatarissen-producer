function isInverse(predicate) {
  return predicate && predicate.startsWith('^');
}

function sparqlEscapePredicate(predicate) {
  return isInverse(predicate) ? `^<${predicate.slice(1)}>` : `<${predicate}>`;
}

function normalizePredicate(predicate) {
  return isInverse(predicate) ? predicate.slice(1) : predicate;
}

export default {
  isInverse,
  sparqlEscapePredicate,
  normalizePredicate
};
