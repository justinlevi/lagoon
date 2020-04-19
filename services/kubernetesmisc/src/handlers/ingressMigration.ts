import * as R from 'ramda';
import { getOpenShiftInfoForProject, updateTask } from '@lagoon/commons/src/api';
import { BaaS } from '@lagoon/commons/src/openshiftApi';
import { logger } from "@lagoon/commons/src/local-logging";
import { sendToLagoonLogs } from '@lagoon/commons/src/logs';
import { promisify } from 'util';

async function ingressMigration (data: any) {
  // TODO: FILL THIS IN
}

export default ingressMigration;
