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

import https = require('https');
import http = require('http');
import streamUtil = require('./streams');
import {getLogger} from './Logger';
import util = require('./util');

const log = getLogger('name.com self-ip updater');
const maxBodySize = 1024 * 1024;

export class NameComSelfIpUpdater {
  private lastIpv4Address: string;
  private lastIpv6Address: string;
  private readonly nameComEndpoint: string;
  private readonly dnsRecordTtl: number;

  constructor(nameComEndpoint: string, dnsRecordTtl: number) {
    this.nameComEndpoint = util.requireNonEmptyString(nameComEndpoint, 'nameComEndPoint');
    this.dnsRecordTtl = util.requirePositiveInt(dnsRecordTtl, 'dnsRecordTtl');
  }

  private async bareHttpsRequest(options: https.RequestOptions, body?: string): Promise<http.IncomingMessage> {
    return new Promise<http.IncomingMessage>((resolve, reject) => {
      const clientRequest: http.ClientRequest = https.request(options, (response: http.IncomingMessage) => {
        resolve(response);
      });

      clientRequest.on('error', (error: Error) => {
        reject(error);
      });

      clientRequest.on('abort', () => {
        reject(new Error('Aborted'));
      });

      if (util.isSet(body)) {
        clientRequest.write(body);
      }

      clientRequest.end();
    });
  }

  private async makeHttpsRequest(options: https.RequestOptions, body?: string): Promise<http.IncomingMessage> {
    const maxRedirectCount: number = 20;

    let redirectCount: number = 0;
    const redirectStatusCode = 302;

    do {
      const response = await this.bareHttpsRequest(options, body);

      if (response.statusCode !== redirectStatusCode) {
        return response;
      }

      log.i(`Redirecting to ${response.headers.location}`);

      redirectCount++;

      options = JSON.parse(JSON.stringify(options));

      if (response.headers.location.startsWith('/')) {
        options.path = response.headers.location;
      } else {
        const newUrl = new URL(response.headers.location);

        if (newUrl.protocol !== 'https') {
          throw new Error(`Insecure redirect to ${response.headers.location}`);
        }

        options.hostname = newUrl.hostname;
        if (util.isSet(newUrl.port)) {
          options.port = newUrl.port;
        } else {
          delete options.port;
        }

        options.path = newUrl.pathname;
      }
    } while (redirectCount <= maxRedirectCount);
  }

  async updateHostDnsToCurrentAddresses(
    host: string,
    domain: string,
    username: string,
    token: string): Promise<void> {
    const requestOptions: https.RequestOptions = {
      auth: `${username}:${token}`,
      method: 'GET',
      hostname: this.nameComEndpoint,
      path: `/v4/domains/${domain}/records`,
    };

    const response: http.IncomingMessage = await this.makeHttpsRequest(requestOptions);
    const responseBody: string = await streamUtil.readStreamAsString(response, maxBodySize);

    if (response.statusCode >= 400) {
      throw new Error(`HTTP Error ${response.statusCode} ${response.statusMessage}:\n${responseBody}`);
    }

    const responseData = JSON.parse(responseBody);
    const records: any[] = responseData.records;

    if (util.notSet(records)) {
      log.e(`${response.statusCode} ${response.statusMessage}\n${responseBody}`);
      return;
    }

    let ipv4AddressId: number;
    let ipv6AddressId: number;

    records.forEach((record: any) => {
      if (record.type === 'A' && util.notSet(ipv4AddressId)) {
        ipv4AddressId = record.id;
      } else if (record.type === 'AAAA' && util.notSet(ipv6AddressId)) {
        ipv6AddressId = record.id;
      }
    });

    const currentIpv4Address = await this.getCurrentIpv4AddressOrReturnNull();
    const currentIpv6Address = await this.getCurrentIpv6AddressOrReturnNull();

    if (util.notSet(currentIpv4Address) && util.notSet(currentIpv6Address)) {
      throw new Error('No public IP addresses found.');
    }

    const v4IsTheSame = util.isSet(currentIpv4Address) && this.lastIpv4Address === currentIpv4Address;
    const v6IsTheSame = util.isSet(currentIpv6Address) && this.lastIpv6Address === currentIpv6Address;

    if (util.notSet(currentIpv4Address)) {
      log.i('Could not get public IPv4 address. Not updating.');
    } else if (v4IsTheSame) {
      log.i('Public IPv4 address has not changed. Not updating name.com');
    } else {
      if (util.isSet(ipv4AddressId)) {
        await this.updateRecord(username, token, ipv4AddressId, host, domain, 'A', currentIpv4Address, this.dnsRecordTtl);
      } else {
        await this.createRecord(username, token, host, domain, 'A', currentIpv4Address, this.dnsRecordTtl);
      }
    }

    if (util.notSet(currentIpv6Address)) {
      log.i('Could not get public IPv6 address. Not updating.');
    } else if (v6IsTheSame) {
      log.i('Public IPv6 address has not changed. Not updating name.com');
    } else {
      if (util.isSet(ipv6AddressId)) {
        await this.updateRecord(username, token, ipv6AddressId, host, domain, 'AAAA', currentIpv6Address, this.dnsRecordTtl);
      } else {
        await this.createRecord(username, token, host, domain, 'AAAA', currentIpv6Address, this.dnsRecordTtl);
      }
    }

    this.lastIpv4Address = currentIpv4Address;
    this.lastIpv6Address = currentIpv6Address;
  }

  private async getCurrentIpv4AddressOrReturnNull(): Promise<string> {
    try {
      const response = await this.makeHttpsRequest({
                                                hostname: 'v4.ident.me',
                                                path: '/',
                                                method: 'GET',

                                              });

      if (response.statusCode !== 200) {
        await streamUtil.readStreamAndDiscard(response);

        return null;
      }

      return await streamUtil.readStreamAsString(response, maxBodySize);
    } catch (e) {
      return null;
    }
  }

  private async getCurrentIpv6AddressOrReturnNull(): Promise<string> {
    try {
      const response = await this.makeHttpsRequest({
                                                hostname: 'v6.ident.me',
                                                path: '/',
                                                method: 'GET',
                                              });

      if (response.statusCode !== 200) {
        await streamUtil.readStreamAndDiscard(response);

        return null;
      }

      const ipv6Address: string = await streamUtil.readStreamAsString(response, maxBodySize);

      return ipv6Address;
    } catch (e) {
      return null;
    }
  }

  async updateRecord(
    username: string,
    token: string,
    recordId: number,
    host: string,
    domain: string,
    recordType: string,
    answer: string,
    ttl: number): Promise<any> {
    const options: https.RequestOptions = {
      auth: `${username}:${token}`,
      method: 'PUT',
      hostname: this.nameComEndpoint,
      path: `/v4/domains/${domain}/records/${recordId}`,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const body = JSON.stringify({
                                  host,
                                  type: recordType,
                                  answer,
                                  ttl,
                                });

    log.i(`Updating ${host}.${domain} ${recordType} record with ID ${recordId} with answer '${answer}'`);

    return await this.makeHttpsRequest(options, body);
  }

  async createRecord(
    username: string,
    token: string,
    host: string,
    domain: string,
    recordType: string,
    answer: string,
    ttl: number): Promise<any> {
    util.requireNonEmptyString(username, 'username');
    util.requireNonEmptyString(token, 'token');
    util.requireNonEmptyString(host, 'host');
    util.requireNonEmptyString(domain, 'domain');
    util.requireNonEmptyString(recordType, 'recordType');
    util.requireNonEmptyString(answer, 'answer');
    util.requirePositiveInt(ttl, 'ttl');

    const options: https.RequestOptions = {
      auth: `${username}:${token}`,
      method: 'POST',
      hostname: this.nameComEndpoint,
      path: `/v4/domains/${domain}/records`,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const body = JSON.stringify({
                                  host,
                                  type: recordType,
                                  answer,
                                  ttl,
                                });


    log.i(`Creating ${host}.${domain} ${recordType} record with answer '${answer}'`);

    return await this.makeHttpsRequest(options, body);
  }
}