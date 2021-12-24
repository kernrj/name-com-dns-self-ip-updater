/*
 * Copyright 2021 Rick Kern <kernrj@gmail.com>
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import {getLogger} from './Logger';
import util = require('./util');
import {NameComSelfIpUpdater} from './NameComSelfIpUpdater';
import os = require('os');

const log = getLogger('dns-updater-main');
const domain = util.getStringEnvOrDie('NAME_COM_DOMAIN');
const hostToUpdate = util.getStringEnv('NAME_COM_HOST', hostNameWithoutDomain());
const username = util.getStringEnvOrDie('NAME_COM_USER_NAME');
const token = util.getStringEnvOrDie('NAME_COM_TOKEN'); //'3707f0e42417793dfd7d8e7c40a26f1100156e87';
const nameComApiEndpoint = util.getStringEnv('NAME_COM_ENDPOINT', 'api.name.com');
const ttl = util.getNumericEnv('NAME_COM_DNS_TTL', 300);

const maxBodySize = 1024 * 1024;
const updateIpAfterIntervalMs = util.getNumericEnv('NAME_COM_DNS_UPDATE_INTERVAL_MS', 600000);

const hardExitAfterSignalCount: number = 3;
let exitSignalCount: number = 0;

let updateInterval: NodeJS.Timeout;
let nameComSelfUpdater = new NameComSelfIpUpdater();

process.on('SIGTERM', stopAndExit);
process.on('SIGINT', stopAndExit);

function stopAndExit(signal: string) {
  log.i(`Got signal ${signal}. Stopping.`);

  exitSignalCount++;

  if (exitSignalCount === hardExitAfterSignalCount) {
    log.i(`Hard exit after ${hardExitAfterSignalCount} exit signals.`);
    process.exit(0);
  }

  if (util.isSet(updateInterval)) {
    clearInterval(updateInterval);
  }
}

function hostNameWithoutDomain() : string {
  return os.hostname().split('.')[0];
}

updateIps();
updateInterval = setInterval(() => updateIps(), updateIpAfterIntervalMs);

function updateIps() {
  nameComSelfUpdater.updateHostDnsToCurrentAddresses(hostToUpdate, domain, username, token)
    .then(() => {
      log.i('Record update complete');
    })
    .catch((error: Error) => {
      log.e(`Failed to update record. ${error.stack}`);
    });
}