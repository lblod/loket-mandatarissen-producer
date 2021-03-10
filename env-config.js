const LOG_INCOMING_DELTA = process.env.LOG_INCOMING_DELTA || false;
const LOG_OUTGOING_DELTA = process.env.LOG_OUTGOING_DELTA || false;
const DELTA_INTERVAL = process.env.DELTA_INTERVAL_MS || 1000;
const LOG_DELTA_REWRITE = process.env.LOG_DELTA_REWRITE || false;
const RELATIVE_FILE_PATH = process.env.RELATIVE_FILE_PATH || 'deltas';
const PUBLISHER_URI = process.env.PUBLISHER_URI || 'http://data.lblod.info/services/loket-producer';

const PREFIXES = `
  PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
  PREFIX task: <http://redpencil.data.gift/vocabularies/tasks/>
  PREFIX dct: <http://purl.org/dc/terms/>
  PREFIX prov: <http://www.w3.org/ns/prov#>
  PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
  PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
  PREFIX oslc: <http://open-services.net/ns/core#>
  PREFIX cogs: <http://vocab.deri.ie/cogs#>
  PREFIX adms: <http://www.w3.org/ns/adms#>
  PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
  PREFIX dbpedia: <http://dbpedia.org/resource/>
`;

const JOB_TYPE = 'http://vocab.deri.ie/cogs#Job';
const TASK_TYPE = 'http://redpencil.data.gift/vocabularies/tasks/Task';
const HEALING_TASK_DIFFFING_OPERATION = process.env.HEALING_TASK_DIFFFING_OPERATION || 'http://redpencil.data.gift/id/jobs/concept/TaskOperation/deltaHealingDiffCalculation';
const STATUS_BUSY = 'http://redpencil.data.gift/id/concept/JobStatus/busy';
const STATUS_SCHEDULED = 'http://redpencil.data.gift/id/concept/JobStatus/scheduled';
const STATUS_SUCCESS = 'http://redpencil.data.gift/id/concept/JobStatus/success';
const STATUS_FAILED = 'http://redpencil.data.gift/id/concept/JobStatus/failed';

if(!process.env.CACHE_GRAPH)
  throw `Expected 'CACHE_GRAPH' should be provided.`;

const CACHE_GRAPH = process.env.CACHE_GRAPH;

if(!process.env.HEALING_JOB_OPERATION)
  throw `Expected 'HEALING_JOB_OPERATION' should be provided.`;

const HEALING_JOB_OPERATION = process.env.HEALING_JOB_OPERATION;

export {
  LOG_INCOMING_DELTA,
  LOG_OUTGOING_DELTA,
  DELTA_INTERVAL,
  LOG_DELTA_REWRITE,
  RELATIVE_FILE_PATH,
  PUBLISHER_URI,
  CACHE_GRAPH,
  HEALING_JOB_OPERATION,
  HEALING_TASK_DIFFFING_OPERATION,
  STATUS_BUSY,
  STATUS_SUCCESS,
  STATUS_SCHEDULED,
  STATUS_FAILED,
  PREFIXES,
  TASK_TYPE,
  JOB_TYPE
};
