const config = {
  prefixes: {
    mandaat: "http://data.vlaanderen.be/ns/mandaat#",
    besluit: "http://data.vlaanderen.be/ns/besluit#",
    persoon: "http://data.vlaanderen.be/ns/persoon#",
    foaf: "http://xmlns.com/foaf/0.1/",
    org: "http://www.w3.org/ns/org#",
    skos: "http://www.w3.org/2004/02/skos/core#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    ext: "http://mu.semte.ch/vocabularies/ext/",
    regorg: "https://www.w3.org/ns/regorg#",
    person: "http://www.w3.org/ns/person#",
    schema: "http://schema.org/",
    prov: "http://www.w3.org/ns/prov#",
    adms: "http://www.w3.org/ns/adms#",
    mu: "http://mu.semte.ch/vocabularies/core/",
    owl: "http://www.w3.org/2002/07/owl#"
  },
  conceptScheme: 'http://lblod.data.gift/concept-schemes/0887b850-b810-40d4-be0f-cafd01d3259b',
  export: [
    {
      type: 'http://data.vlaanderen.be/ns/mandaat#Mandataris',
      pathToConceptScheme: [
        "http://www.w3.org/ns/org#holds",
        "^http://www.w3.org/ns/org#hasPost",
        "http://data.vlaanderen.be/ns/mandaat#isTijdspecialisatieVan",
        "http://data.vlaanderen.be/ns/besluit#bestuurt",
        "http://data.vlaanderen.be/ns/besluit#classificatie",
        "http://www.w3.org/2004/02/skos/core#inScheme"
      ],
      properties: [
        "http://mu.semte.ch/vocabularies/core/uuid",
        "http://data.vlaanderen.be/ns/mandaat#start",
        "http://data.vlaanderen.be/ns/mandaat#einde",
        "http://data.vlaanderen.be/ns/mandaat#rangorde",
        "http://data.vlaanderen.be/ns/mandaat#status",
        "http://data.vlaanderen.be/ns/mandaat#isBestuurlijkeAliasVan",
        "http://data.vlaanderen.be/ns/mandaat#isTijdelijkVervangenDoor",
        "http://data.vlaanderen.be/ns/mandaat#beleidsdomein",
        "http://www.w3.org/ns/org#hasMembership",
        "http://www.w3.org/ns/org#holds" // TODO move to relations
      ],
      relations: [

      ]
    },
    {
      type: 'http://data.vlaanderen.be/ns/mandaat#Mandaat',
      pathToConceptScheme: [
        "^http://www.w3.org/ns/org#hasPost",
        "http://data.vlaanderen.be/ns/mandaat#isTijdspecialisatieVan",
        "http://data.vlaanderen.be/ns/besluit#bestuurt",
        "http://data.vlaanderen.be/ns/besluit#classificatie",
        "http://www.w3.org/2004/02/skos/core#inScheme"
      ],
      properties: [
        "http://mu.semte.ch/vocabularies/core/uuid",
        "http://data.vlaanderen.be/ns/mandaat#aantalHouders",
        "http://www.w3.org/ns/org#role" // TODO move to relations
      ],
      relations: [
        "^http://www.w3.org/ns/org#holds"
      ]
    }
  ]
};

export default config;
