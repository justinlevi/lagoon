// @flow

/* eslint-disable no-console */

import path from 'path';
import inquirer from 'inquirer';
import writeDefaultConfig from '../writeDefaultConfig';
import { fileExists } from '../util/fs';
import { exitError } from '../exit';

import typeof Yargs from 'yargs';
import type { BaseArgs } from './index';

const name = 'init';
const description = 'Creates a .amazeeio.yml config in the current working directory';

export async function setup(yargs: Yargs): Promise<Object> {
  return yargs.usage(`$0 ${name} - ${description}`).argv;
}

export async function run({ cwd, clog = console.log }: BaseArgs): Promise<number> {
  const filepath = path.join(cwd, '.amazeeio.yml');

  if (await fileExists(filepath)) {
    return exitError(clog, `File '${filepath}' already exists!`);
  }

  try {
    clog(`Creating file '${filepath}'...`);
    await writeDefaultConfig(filepath);
    clog('Writing Successful');
  } catch (e) {
    clog(`Error occurred while writing to ${filepath}:`);
    clog(e.message);
    return 1;
  }

  return 0;
}

export default {
  setup,
  name,
  description,
  run,
};
