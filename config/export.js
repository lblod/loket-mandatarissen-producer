const config = {
  conceptScheme: "http://lblod.data.gift/concept-schemes/0887b850-b810-40d4-be0f-cafd01d3259b",
  export: [
    {
      type: "http://mu.semte.ch/vocabularies/ext/MandatarisStatusCode",
      pathToConceptScheme: [
        "^http://data.vlaanderen.be/ns/mandaat#status",
        "http://www.w3.org/ns/org#holds",
        "^http://www.w3.org/ns/org#hasPost",
        "http://data.vlaanderen.be/ns/mandaat#isTijdspecialisatieVan",
        "http://data.vlaanderen.be/ns/besluit#bestuurt",
        "http://data.vlaanderen.be/ns/besluit#classificatie",
        "http://www.w3.org/2004/02/skos/core#inScheme"
      ],
      properties: [
        "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "http://mu.semte.ch/vocabularies/core/uuid",
        "http://www.w3.org/2004/02/skos/core#prefLabel",
        "http://www.w3.org/2004/02/skos/core#scopeNote"
      ]
    },
    {
      type: "http://mu.semte.ch/vocabularies/ext/BeleidsdomeinCode",
      pathToConceptScheme: [
        "^http://data.vlaanderen.be/ns/mandaat#beleidsdomein",
        "http://www.w3.org/ns/org#holds",
        "^http://www.w3.org/ns/org#hasPost",
        "http://data.vlaanderen.be/ns/mandaat#isTijdspecialisatieVan",
        "http://data.vlaanderen.be/ns/besluit#bestuurt",
        "http://data.vlaanderen.be/ns/besluit#classificatie",
        "http://www.w3.org/2004/02/skos/core#inScheme"
      ],
      properties: [
        "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "http://mu.semte.ch/vocabularies/core/uuid",
        "http://www.w3.org/2004/02/skos/core#prefLabel",
        "http://www.w3.org/2004/02/skos/core#scopeNote"
      ]
    },
    {
      type: "http://data.vlaanderen.be/ns/mandaat#Mandataris",
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
        "http://data.vlaanderen.be/ns/mandaat#isBestuurlijkeAliasVan",
        "http://www.w3.org/ns/org#holds",
        "http://data.vlaanderen.be/ns/mandaat#status",
        "http://data.vlaanderen.be/ns/mandaat#isTijdelijkVervangenDoor",
        "http://data.vlaanderen.be/ns/mandaat#beleidsdomein",
        "http://www.w3.org/ns/org#hasMembership"
      ]
    },
    {
      type: "http://www.w3.org/ns/person#Person",
      pathToConceptScheme: [
        "^http://data.vlaanderen.be/ns/mandaat#isBestuurlijkeAliasVan",
        "http://www.w3.org/ns/org#holds",
        "^http://www.w3.org/ns/org#hasPost",
        "http://data.vlaanderen.be/ns/mandaat#isTijdspecialisatieVan",
        "http://data.vlaanderen.be/ns/besluit#bestuurt",
        "http://data.vlaanderen.be/ns/besluit#classificatie",
        "http://www.w3.org/2004/02/skos/core#inScheme"
      ],
      properties: [
        "http://mu.semte.ch/vocabularies/core/uuid",
        "http://xmlns.com/foaf/0.1/familyName",
        "http://xmlns.com/foaf/0.1/name",
        "http://data.vlaanderen.be/ns/persoon#gebruikteVoornaam",
        "http://www.w3.org/2002/07/owl#sameAs",
        "http://data.vlaanderen.be/ns/persoon#heeftGeboorte",
        "http://data.vlaanderen.be/ns/persoon#geslacht"
      ]
    },
    {
      type: "http://data.vlaanderen.be/ns/persoon#Geboorte",
      pathToConceptScheme: [
        "^http://data.vlaanderen.be/ns/persoon#heeftGeboorte",
        "^http://data.vlaanderen.be/ns/mandaat#isBestuurlijkeAliasVan",
        "http://www.w3.org/ns/org#holds",
        "^http://www.w3.org/ns/org#hasPost",
        "http://data.vlaanderen.be/ns/mandaat#isTijdspecialisatieVan",
        "http://data.vlaanderen.be/ns/besluit#bestuurt",
        "http://data.vlaanderen.be/ns/besluit#classificatie",
        "http://www.w3.org/2004/02/skos/core#inScheme"
      ],
      properties: [
        "http://mu.semte.ch/vocabularies/core/uuid",
        "http://data.vlaanderen.be/ns/persoon#datum",
        "http://www.w3.org/2002/07/owl#sameAs"
      ]
    },
    {
      type: "http://www.w3.org/ns/org#Membership",
      pathToConceptScheme: [
        "^http://www.w3.org/ns/org#hasMembership",
        "http://www.w3.org/ns/org#holds",
        "^http://www.w3.org/ns/org#hasPost",
        "http://data.vlaanderen.be/ns/mandaat#isTijdspecialisatieVan",
        "http://data.vlaanderen.be/ns/besluit#bestuurt",
        "http://data.vlaanderen.be/ns/besluit#classificatie",
        "http://www.w3.org/2004/02/skos/core#inScheme"
      ],
      properties: [
        "http://mu.semte.ch/vocabularies/core/uuid",
        "http://www.w3.org/ns/org#organisation"
      ]
    },
    {
      type: "http://data.vlaanderen.be/ns/mandaat#Fractie",
      pathToConceptScheme: [
        "^http://www.w3.org/ns/org#organisation",
        "^http://www.w3.org/ns/org#hasMembership",
        "http://www.w3.org/ns/org#holds",
        "^http://www.w3.org/ns/org#hasPost",
        "http://data.vlaanderen.be/ns/mandaat#isTijdspecialisatieVan",
        "http://data.vlaanderen.be/ns/besluit#bestuurt",
        "http://data.vlaanderen.be/ns/besluit#classificatie",
        "http://www.w3.org/2004/02/skos/core#inScheme"
      ],
      properties: [
        "http://mu.semte.ch/vocabularies/core/uuid",
        "https://www.w3.org/ns/regorg#legalName",
        "http://www.w3.org/ns/org#memberOf",
        "http://www.w3.org/ns/org#linkedTo"
      ]
    },
    {
      type: "http://data.vlaanderen.be/ns/mandaat#Mandaat",
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
        "http://www.w3.org/ns/org#role"
      ]
    },
    {
      type: "http://mu.semte.ch/vocabularies/ext/BestuursfunctieCode",
      pathToConceptScheme: [
        "^http://www.w3.org/ns/org#role",
        "^http://www.w3.org/ns/org#hasPost",
        "http://data.vlaanderen.be/ns/mandaat#isTijdspecialisatieVan",
        "http://data.vlaanderen.be/ns/besluit#bestuurt",
        "http://data.vlaanderen.be/ns/besluit#classificatie",
        "http://www.w3.org/2004/02/skos/core#inScheme"
      ],
      properties: [
        "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "http://mu.semte.ch/vocabularies/core/uuid",
        "http://www.w3.org/2004/02/skos/core#prefLabel",
        "http://www.w3.org/2004/02/skos/core#scopeNote"
      ]
    },
    { // bestuursorgaan in tijd
      type: "http://data.vlaanderen.be/ns/besluit#Bestuursorgaan",
      pathToConceptScheme: [
        "http://data.vlaanderen.be/ns/mandaat#isTijdspecialisatieVan",
        "http://data.vlaanderen.be/ns/besluit#bestuurt",
        "http://data.vlaanderen.be/ns/besluit#classificatie",
        "http://www.w3.org/2004/02/skos/core#inScheme"
      ],
      properties: [
        "http://mu.semte.ch/vocabularies/core/uuid",
        "http://data.vlaanderen.be/ns/mandaat#bindingEinde",
        "http://data.vlaanderen.be/ns/mandaat#bindingStart",
        "http://www.w3.org/ns/org#hasPost",
        "http://data.vlaanderen.be/ns/mandaat#isTijdspecialisatieVan"
      ]
    },
    { // bestuursorgaan niet in tijd
      type: "http://data.vlaanderen.be/ns/besluit#Bestuursorgaan",
      pathToConceptScheme: [
        "http://data.vlaanderen.be/ns/besluit#bestuurt",
        "http://data.vlaanderen.be/ns/besluit#classificatie",
        "http://www.w3.org/2004/02/skos/core#inScheme"
      ],
      properties: [
        "http://mu.semte.ch/vocabularies/core/uuid",
        "http://www.w3.org/2004/02/skos/core#prefLabel",
        "http://data.vlaanderen.be/ns/besluit#bestuurt",
        "http://data.vlaanderen.be/ns/besluit#classificatie"
      ]
    },
    {
      type: "http://mu.semte.ch/vocabularies/ext/BestuursorgaanClassificatieCode",
      pathToConceptScheme: [
        "^http://data.vlaanderen.be/ns/besluit#classificatie",
        "http://data.vlaanderen.be/ns/besluit#bestuurt",
        "http://data.vlaanderen.be/ns/besluit#classificatie",
        "http://www.w3.org/2004/02/skos/core#inScheme"
      ],
      properties: [
        "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "http://mu.semte.ch/vocabularies/core/uuid",
        "http://www.w3.org/2004/02/skos/core#prefLabel",
        "http://www.w3.org/2004/02/skos/core#scopeNote"
      ]
    },
    {
      type: "http://data.vlaanderen.be/ns/besluit#Bestuurseenheid",
      pathToConceptScheme: [
        "http://data.vlaanderen.be/ns/besluit#classificatie",
        "http://www.w3.org/2004/02/skos/core#inScheme"
      ],
      properties: [
        "http://mu.semte.ch/vocabularies/core/uuid",
        "http://www.w3.org/2004/02/skos/core#prefLabel",
        "http://www.w3.org/2004/02/skos/core#altLabel",
        "http://data.vlaanderen.be/ns/besluit#classificatie",
        "http://data.vlaanderen.be/ns/besluit#werkingsgebied"
      ]
    },
    {
      type: "http://mu.semte.ch/vocabularies/ext/BestuurseenheidClassificatieCode",
      pathToConceptScheme: [
        "http://www.w3.org/2004/02/skos/core#inScheme"
      ],
      properties: [
        "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "http://mu.semte.ch/vocabularies/core/uuid",
        "http://www.w3.org/2004/02/skos/core#prefLabel",
        "http://www.w3.org/2004/02/skos/core#scopeNote"
      ]
    },
    {
      type: "http://www.w3.org/ns/prov#Location",
      pathToConceptScheme: [
        "^http://data.vlaanderen.be/ns/besluit#werkingsgebied",
        "http://data.vlaanderen.be/ns/besluit#classificatie",
        "http://www.w3.org/2004/02/skos/core#inScheme"
      ],
      properties: [
        "http://mu.semte.ch/vocabularies/core/uuid",
        "http://www.w3.org/2000/01/rdf-schema#label",
        "http://mu.semte.ch/vocabularies/ext/werkingsgebiedNiveau"
      ]
    }
  ]
};

export default config;
