import { app, errorHandler } from 'mu';
import bodyParser from 'body-parser';
import DeltaCache from './delta-cache';
import { produceMandateesDelta } from './producer';

import {
  LOG_INCOMING_DELTA,
  LOG_OUTGOING_DELTA,
  DELTA_INTERVAL
} from './env-config';

app.use( bodyParser.json( { type: function(req) { return /^application\/json/.test( req.get('content-type') ); } } ) );

const cache = new DeltaCache();
let hasTimeout = null;

app.post('/delta', async function( req, res ) {
  const body = req.body;

  if (LOG_INCOMING_DELTA)
    console.log(`Receiving delta ${JSON.stringify(body)}`);

  const processDelta = async function() {
    const delta = await produceMandateesDelta(body);

    if (LOG_OUTGOING_DELTA)
      console.log(`Pushing onto cache ${JSON.stringify(delta)}`);

    cache.push( ...delta );

    if( !hasTimeout ){
      triggerTimeout();
    }
  };
  processDelta();  // execute async

  res.status(202).send();
});

app.get('/files', async function( req, res ) {
  const since = req.query.since || new Date().toISOString();
  const files = await cache.getDeltaFiles(since);
  res.json({ data: files });
});

function triggerTimeout(){
  setTimeout( () => {
    hasTimeout = false;
    cache.generateDeltaFile();
  }, DELTA_INTERVAL );
  hasTimeout = true;
}

app.use(errorHandler);

// TODO write the in-memory delta cache to a file before shutting down the service
