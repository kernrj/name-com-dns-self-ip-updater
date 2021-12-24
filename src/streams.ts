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

import {
  isSet, notSet,
} from './util';

import {getLogger} from './Logger';
import stream = require('stream');

const log = getLogger('streams');

export function readStream(stream: stream.Readable, maxBodySize: number): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    let bodyChunks: Buffer[] = [];
    let bodyLen: number = 0;

    stream.on('data', (buf: Buffer) => {
      bodyLen += buf.length;

      if (bodyLen > maxBodySize) {
        log.e('Terminating connection because max buffer size ' + maxBodySize + ' exceeded.');
        stream.destroy();
        reject(new Error('Stream contents is too large.'));
        return;
      }

      bodyChunks.push(buf);
    });

    stream.on('end', () => {
      resolve(Buffer.concat(bodyChunks, bodyLen));
    });

    stream.on('error', (err: Error) => {
      reject(err);
    });

    stream.on('abort', () => {
      reject(new Error('Connection aborted.'));
    });
  });
}

export async function readStreamAsString(stream: stream.Readable, maxBodySize: number, encoding?: string): Promise<string> {
  if (notSet(encoding)) {
    encoding = 'utf-8';
  }

  return (await readStream(stream, maxBodySize)).toString();
}

export function readStreamAndDiscard(stream: stream.Readable): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    stream.on('data', () => {
    });

    stream.on('end', () => {
      resolve();
    });

    stream.on('error', (err: Error) => {
      reject(err);
    });

    stream.on('abort', () => {
      reject(new Error('Connection aborted.'));
    });
  });
}

export async function writeStream(s: stream.Writable, buf: Buffer): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    s.write(buf, (err: Error) => {
      if (isSet(err)) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export async function waitForEnd(stream: stream.Readable): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    stream.on('end', () => {
      resolve(null);
    });

    stream.on('close', () => {
      resolve(null);
    });

    stream.on('error', err => {
      log.e('stream error: ' + err);
      reject(err);
    });
  });
}

export async function waitForFinish(stream: stream.Writable): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    stream.on('finish', () => {
      resolve(null);
    });

    stream.on('error', err => {
      reject(err);
    });
  });
}

export async function endStream(stream: stream.Writable): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (notSet(stream)) {
      resolve();
      return;
    }

    stream.end(() => {
      resolve();
    });
  });
}

export async function endStreamWithLastBuffer(stream: stream.Writable, buffer: Buffer | string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    stream.end(buffer, () => {
      resolve();
    });
  });
}
