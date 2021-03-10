import { uuid, sparqlEscapeDateTime, sparqlEscapeUri } from 'mu';
import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';
import fs from 'fs-extra';
import { PUBLISHER_URI,
         RELATIVE_FILE_PATH,
         HEALING_JOB_OPERATION,
         HEALING_TASK_DIFFFING_OPERATION,
         STATUS_FAILED,
         STATUS_SUCCESS,
         TASK_TYPE,
         PREFIXES,
         JOB_TYPE,
         CACHE_GRAPH
       } from './env-config';
import { chain } from 'lodash';
import { serializeTriple } from './utils';

const SHARE_FOLDER = '/share';

export default class DeltaCache {

  constructor() {
    this.cache = [];
  }

  /**
   * Push new entries to the delta cache
   *
   * @public
  */
  push() {
    this.cache.push(...arguments);
  }

  /**
   * Write current state of the delta cache to a file
   *
   * @public
  */
  async generateDeltaFile() {
    if (this.cache.length) {
      const cachedArray = this.cache;
      this.cache = [];

      try {
        const filename = `delta-${new Date().toISOString()}.json`;
        const filepath = `/${SHARE_FOLDER}/${RELATIVE_FILE_PATH}/${filename}`;

        if(!(await this.isAllowedToWriteCache())){
          console.log(`Found ${HEALING_TASK_DIFFFING_OPERATION} is busy for ${HEALING_JOB_OPERATION}.`);
          console.log(`This caching operation will be skipped and taken care of by the healing process`);
          return;
        }
        else {
          await this.updateCacheGraph(cachedArray);
          await fs.writeFile(filepath, JSON.stringify( cachedArray ));
          console.log(`Delta cache has been written to file. Cache contained ${cachedArray.length} items.`);
          await this.writeFileToStore(filename, filepath);
          console.log("File is persisted in store and can be consumed now.");
        }
      } catch (e) {
        console.log(e);
      }
    } else {
      console.log("Empty cache. Nothing to save on disk");
    }
  }

  /**
   * Get all delta files produced since a given timestamp
   *
   * @param since {string} ISO date time
   * @public
  */
  async getDeltaFiles(since) {
    console.log(`Retrieving delta files since ${since}`);

    const result = await query(`
    ${PREFIXES}

    SELECT ?uuid ?filename ?created WHERE {
      ?s a nfo:FileDataObject ;
          mu:uuid ?uuid ;
          nfo:fileName ?filename ;
          dct:publisher <${PUBLISHER_URI}> ;
          dct:created ?created .
      ?file nie:dataSource ?s .

      FILTER (?created > "${since}"^^xsd:dateTime)
    } ORDER BY ?created
  `);

    return result.results.bindings.map(b => {
      return {
        type: 'files',
        id: b['uuid'].value,
        attributes: {
          name: b['filename'].value,
          created: b['created'].value
        }
      };
    });
  }

  /**
   * @private
   */
  async updateCacheGraph(cachedArray){
    const deleteChunks =
          chain(cachedArray)
          .map(c => c.deletes)
          .flatten()
          .map(t => serializeTriple(t))
          .chunk(20)
          .value();

    for(const deleteChunk of deleteChunks){
      const deleteQuery = `
        ${PREFIXES}
        DELETE DATA {
          GRAPH ${sparqlEscapeUri(CACHE_GRAPH)}{
              ${deleteChunk.join('\n')}
           }
        }
      `;
      await update(deleteQuery);
    }

    const insertChunks =
          chain(cachedArray)
          .map(c => c.inserts)
          .flatten()
          .map(t => serializeTriple(t))
          .chunk(20)
          .value();

    for(const insertChunk of insertChunks){
      const insertQuery = `
        ${PREFIXES}
        INSERT DATA {
          GRAPH ${sparqlEscapeUri(CACHE_GRAPH)}{
              ${insertChunk.join('\n')}
           }
        }
      `;
      await update(insertQuery);
    }
  }

  async isAllowedToWriteCache(){
    const queryDiffingTask = `
      ${PREFIXES}
      SELECT DISTINCT ?task WHERE {
        GRAPH ?g {
          ?task a ${sparqlEscapeUri(TASK_TYPE)};
                adms:status ?status;
                task:operation ${sparqlEscapeUri(HEALING_TASK_DIFFFING_OPERATION)};
                dct:isPartOf ?job.
          ?job a ${sparqlEscapeUri(JOB_TYPE)};
               task:operation ${sparqlEscapeUri(HEALING_JOB_OPERATION)}.
        }
        FILTER(?status NOT IN (
         ${sparqlEscapeUri(STATUS_FAILED)},
         ${sparqlEscapeUri(STATUS_SUCCESS)}
        ))
      }
    `;

    const result = await query(queryDiffingTask);

    return !result.results.length;
  }

  async writeFileToStore(filename, filepath) {
    const virtualFileUuid = uuid();
    const virtualFileUri = `http://data.lblod.info/files/${virtualFileUuid}`;
    const nowLiteral = sparqlEscapeDateTime(new Date());
    const physicalFileUuid = uuid();
    const physicalFileUri = `share://${RELATIVE_FILE_PATH}/${filename}`;

    await update(`
    ${PREFIXES}

    INSERT DATA {
      GRAPH <http://mu.semte.ch/graphs/public> {
        <${virtualFileUri}> a nfo:FileDataObject ;
          mu:uuid "${virtualFileUuid}" ;
          nfo:fileName "${filename}" ;
          dct:format "application/json" ;
          dbpedia:fileExtension "json" ;
          dct:created ${nowLiteral} ;
          dct:modified ${nowLiteral} ;
          dct:publisher <${PUBLISHER_URI}> .
        <${physicalFileUri}> a nfo:FileDataObject ;
          mu:uuid "${physicalFileUuid}" ;
          nie:dataSource <${virtualFileUri}> ;
          nfo:fileName "${filename}" ;
          dct:format "application/json" ;
          dbpedia:fileExtension "json" ;
          dct:created ${nowLiteral} ;
          dct:modified ${nowLiteral} .
      }
    }
  `);
  }
}
