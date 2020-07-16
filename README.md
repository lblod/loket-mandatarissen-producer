# loket-mandatarissen-producer

Producer service generating diff files to sync data about mandatees to external applications. Diff files generated since a specific timestamp can be fetched by a consuming service (e.g. [mandatendatabank-consumer](http://github.com/lblod/mandatendatabank-consumer).

The service is based on a PoC application which can be found [here](http://github.com/redpencilio/app-poc-diff).

## Tutorials
### Add the service to a stack
Add the service to your `docker-compose.yml`:

```
  loket-mandatarissen-producer:
    image: lblod/loket-mandatarissen-producer
    volumes:
      - ./data/files:/share

```

The produced diff files will be written to a subfolder `./deltas/mandatarissen` of the mounted volume `./data/files`.

Add a migration with the export concept scheme to `./config/migrations/20200421151800-add-loket-mandatarissen-concept-scheme.sparql`

```
PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

INSERT DATA {
  GRAPH <http://mu.semte.ch/graphs/public> {
    <http://lblod.data.gift/concept-schemes/0887b850-b810-40d4-be0f-cafd01d3259b> a skos:ConceptScheme ;
    mu:uuid "0887b850-b810-40d4-be0f-cafd01d3259b" ;
    skos:prefLabel "Loket mandatarissen export" .
    <http://data.vlaanderen.be/id/concept/BestuurseenheidClassificatieCode/5ab0e9b8a3b2ca7c5e000000> skos:inScheme <http://lblod.data.gift/concept-schemes/0887b850-b810-40d4-be0f-cafd01d3259b> .
    <http://data.vlaanderen.be/id/concept/BestuurseenheidClassificatieCode/5ab0e9b8a3b2ca7c5e000001> skos:inScheme <http://lblod.data.gift/concept-schemes/0887b850-b810-40d4-be0f-cafd01d3259b> .
    <http://data.vlaanderen.be/id/concept/BestuurseenheidClassificatieCode/5ab0e9b8a3b2ca7c5e000002> skos:inScheme <http://lblod.data.gift/concept-schemes/0887b850-b810-40d4-be0f-cafd01d3259b> .
    <http://data.vlaanderen.be/id/concept/BestuurseenheidClassificatieCode/5ab0e9b8a3b2ca7c5e000003> skos:inScheme <http://lblod.data.gift/concept-schemes/0887b850-b810-40d4-be0f-cafd01d3259b> .
  }
}
```

Next, configure the delta-notifier in `./config/delta/rules.js` to send delta messages for all changes:
```javascript
export default [
  {
    match: {
      // anything
    },
    callback: {
      url: 'http://loket-mandatarissen-producer/delta',
      method: 'POST'
    },
    options: {
      resourceFormat: 'v0.0.1',
      gracePeriod: 1000,
      ignoreFromSelf: true
    }
  }

  // Other delta listeners
]
```

Finally add the following dispatcher rules in `./config/dispatcher/dispatcher.ex` to make the endpoint to list produced diff files available for the consuming service.

```elixir
  get "/sync/mandatarissen/files/*path" do
    Proxy.forward conn, path, "http://loket-mandatarissen-producer/files/"
  end
```

The service assumes a [file service](https://github.com/mu-semtech/file-service) hosting the files mounted in `/share` is already available in the stack for the consumer to download the diff files.

Restart the updated services
```
docker-compose restart migrations delta-notifier dispatcher
```

Create the newly added service
```
docker-compose up -d
```

## Reference
### Configuration
#### Export configuration
The export configuration defining which triples must be produced per `rdf:type` is specified in `/config/export.js`.

The configuration object, which must be exported by default, contains the following keys:
* `conceptScheme`: URI of the export concept scheme. Each resource that is relevant for the export must have a path to this concept scheme.
* `export`: array of export configurations per resource type

An export configuration entry in the `export` arrays contains the following keys:
* `type`: URI of the rdf:type for which the configuration holds
* `pathToConceptScheme`: list of path segments (URIs) from the resource to the export concept scheme. If the path exists, the resource is in scope of the export. Otherwise the resource is out of scope.
* `properties`: list of predicates (URIs) to export for the resource type

The `export` array may contain multiple entries for an `rdf:type`.
A resource may have multiple types and therefore map to multiple export configugrations, but the `pathToConceptScheme` must be identical in that case. The service only works under the assumption that a resource has only 1 way to the export concept scheme (but there may be multiple instances of that way).

#### Environment variables
The following enviroment variables can be optionally configured:
* `DELTA_INTERVAL (in ms, default: 1000)`: interval to keep generated delta's in an in-memory cache before writing to a file
* `LOG_INCOMING_DELTA (default: "false")`: log the delta message as received from the delta-notifier to the console
* `LOG_OUTGOING_DELTA (default: "false")`: log the resulting delta message that will be written to the diff file to the console
* `LOG_DELTA_REWRITE (default: "false")`: verbose log output during the rewrite of the incoming delta to the resulting delta. Only useful for debugging purposes.

### API
#### POST /delta
Endpoint that receives delta's from the [delta-notifier](https://github.com/mu-semtech/delta-notifier). The delta's are rewritten based on the configured export for mandatees. The resulting delta's are written to files that can be retrieved via the `GET /files` endpoint.

#### GET /files?since=<datetime>
Get a list of diff files generated since the request timestamp. The list is ordered by creation date, oldest first. This is also the order in which the files must be consumed.

Example response:
```json
{
  "data": [
    {
      "type": "files",
      "id": "3be63fd0-c030-11ea-a482-b30a6eeb477f",
      "attributes": {
        "name": "delta-2020-07-07T08:59:58.409Z.json",
        "created": "2020-07-07T08:59:58.413Z"
      }
    },
    {
      "type": "files",
      "id": "3fd04b40-c030-11ea-a482-b30a6eeb477f",
      "attributes": {
        "name": "delta-2020-07-07T09:00:04.977Z.json",
        "created": "2020-07-07T09:00:04.980Z"
      }
    }
  ]
}
```

### File format
The generated delta files follow the [delta-notifier v0.0.1](https://github.com/mu-semtech/delta-notifier#v001) format.

### Model
#### Diff files
The generated diff files are written to the store according to the [model of the file service](https://github.com/mu-semtech/file-service#resources). The virtual file is enriched with the following properties:

| Name      | Predicate       | Range           | Definition                                                                                                                    |
|-----------|-----------------|-----------------|-------------------------------------------------------------------------------------------------------------------------------|
| publisher | `dct:publisher` | `rdfs:Resource` | Publisher of the file, in this case always `<http://data.lblod.info/services/loket-mandatarissen-producer>` |

## Discussions
### Why must the generated delta's of the application stack be rewritten by the producer?
Simply writing all incoming delta messages to a file if the subject's `rdf:type` is of interest and offering those files to a consumer service may look as a simple and adequate solution at first sight, but it isn't. This simple approach has two downsides:
1. **Too much data may be exposed to the consuming application.** If we would for example export all triples for subjects that have `foaf:Person` as a type, we may be exporting too many persons. Not only the persons that hold a mandate, but also persons that are for example related to a `foaf:Account`. A lot of irrelevant data will be synced to the consuming application that way.
2. **Data may be missing in the consuming application.** A change on one resource may have an impact that is a lot bigger than just the single resource for which a delta arrived. E.g. relating a mandatee to a mandate doesn't only affect the mandatee resource. It also makes the person related to the mandatee relevant for the consuming application. On its turn, including the person also makes the person's birthdate relevant for the consuming application, etc.

To determine which resources are relevant to export, the producer makes use of an 'export concept scheme'. All resource that have a path in the triple store from the resource URI to the concept scheme are considered relevant. When a resource changes, all 'deeper' resources are recursively checked whether they also become (ir)relevant for the export. 'Deeper' in this context doesn't mean a hierarchical relationship, but more hops from the resource to the concept scheme.

The path to follow from the resource URI to the concept scheme is specified in the export configuration per resource type.

This approach may lead to duplicate inserts of data (eg. relating a mandate to a bestuursorgaan will produce triples to insert every mandatee, person, person's birthdate, etc. related to the mandate, while some of this data may have been synced before), but it will never expose irrelevant data or sync too little data.

## Known limitations
* The service keeps an in-memory cache of delta's to write to a file. If the service is killed before the delta's have been written to a file, the delta's are lost. Hence, shortening the `DELTA_INTERVAL`, decreases the chance to loose data on restart.

## Roadmap
* Add support for a prefix map in the export configuration
