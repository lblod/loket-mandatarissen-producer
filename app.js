import { app, errorHandler, uuid, sparqlEscapeDateTime } from 'mu';
import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';
import bodyParser from 'body-parser';
import DeltaCache from './delta-cache';

app.use( bodyParser.json( { type: function(req) { return /^application\/json/.test( req.get('content-type') ); } } ) );

const DELTA_INTERVAL = process.env.DELTA_INTERVAL_MS || 1000;

const cache = new DeltaCache();
let hasTimeout = null;

app.post('/delta', function( req, res ) {
  const body = req.body;

  console.log(`Pushing onto cache ${JSON.stringify(body)}`);

  // TODO verification which data to push to the cache

  cache.push( ...body );

  if( !hasTimeout ){
    triggerTimeout();
  }

  res.status(200).send("Processed");
} );

app.get('/files', async function( req, res ) {
  const since = req.query.since || new Date().toISOString();
  const files = await cache.getDeltaFiles(since);
  res.json({ data: files });
} );

function triggerTimeout(){
  hasTimeout = false;  // TODO move into setTimeout once infinte loop is resolved
  setTimeout( () => {
    cache.generateDeltaFile();
  }, DELTA_INTERVAL );
  hasTimeout = true;
}

