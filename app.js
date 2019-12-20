import { app, errorHandler } from 'mu';
import bodyParser from 'body-parser';
import DeltaCache from './delta-cache';
import { produceMandateesDelta } from './producer';

app.use( bodyParser.json( { type: function(req) { return /^application\/json/.test( req.get('content-type') ); } } ) );

const LOG_INCOMING_DELTA = process.env.LOG_INCOMING_DELTA || true;
const LOG_OUTGOING_DELTA = process.env.LOG_OUTGOING_DELTA || true;

const DELTA_INTERVAL = process.env.DELTA_INTERVAL_MS || 1000;

const cache = new DeltaCache();
let hasTimeout = null;

app.post('/delta', async function( req, res ) {
  const body = req.body;

  if (LOG_INCOMING_DELTA)
    console.log(`Receiving delta ${JSON.stringify(body)}`);

  const delta = await produceMandateesDelta(body);

  if (LOG_OUTGOING_DELTA)
    console.log(`Pushing onto cache ${JSON.stringify(delta)}`);

  cache.push( ...delta );

  if( !hasTimeout ){
    triggerTimeout();
  }

  res.status(200).send({ status: "done" });
} );

app.get('/files', async function( req, res ) {
  const since = req.query.since || new Date().toISOString();
  const files = await cache.getDeltaFiles(since);
  res.json({ data: files });
} );

function triggerTimeout(){
  setTimeout( () => {
    hasTimeout = false;
    cache.generateDeltaFile();
  }, DELTA_INTERVAL );
  hasTimeout = true;
}

app.use(errorHandler);
