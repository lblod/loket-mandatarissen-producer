const LOG_INCOMING_DELTA = process.env.LOG_INCOMING_DELTA || false;
const LOG_OUTGOING_DELTA = process.env.LOG_OUTGOING_DELTA || false;
const DELTA_INTERVAL = process.env.DELTA_INTERVAL_MS || 1000;
const LOG_DELTA_REWRITE = process.env.LOG_DELTA_REWRITE || false;
const RELATIVE_FILE_PATH = process.env.RELATIVE_FILE_PATH || 'deltas';
const PUBLISHER_URI = process.env.PUBLISHER_URI || 'http://data.lblod.info/services/loket-producer';

export {
  LOG_INCOMING_DELTA,
  LOG_OUTGOING_DELTA,
  DELTA_INTERVAL,
  LOG_DELTA_REWRITE,
  RELATIVE_FILE_PATH,
  PUBLISHER_URI,
};
