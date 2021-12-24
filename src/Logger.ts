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

export interface ILogger {
  d(message: string): void;

  i(message: string): void;

  w(message: string): void;

  e(message: string, err?: Error): void;
}

class Logger implements ILogger {
  private readonly logId: string;

  constructor(logId: string) {
    this.logId = logId;
  }

  d(message: string, err?: Error): void {
    if (err) {
      console.debug(this.getFullMessage(message, 'debug'), err);
    } else {
      console.debug(this.getFullMessage(message, 'debug'));
    }
  }

  i(message: string, err?: Error): void {
    if (err) {
      console.log(this.getFullMessage(message, 'info'), err);
    } else {
      console.log(this.getFullMessage(message, 'info'));
    }
  }

  w(message: string, err?: Error): void {
    if (err) {
      console.warn(this.getFullMessage(message, 'warn'), err);
    } else {
      console.warn(this.getFullMessage(message, 'warn'));
    }
  }

  e(message: string, err?: Error): void {
    if (err) {
      console.error(this.getFullMessage(message, 'error'), err);
    } else {
      console.error(this.getFullMessage(message, 'error'));
    }
  }

  private getFullMessage(message: string, level: string): string {
    return `${new Date().toISOString()} [${level}] [${this.logId}] ${message}`;
  }
}

export function getLogger(logId: string): ILogger {
  return new Logger(logId);
}