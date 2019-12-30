import * as R from 'ramda';
import EnvironmentNotFound from 'components/errors/EnvironmentNotFound';
import TaskNotFound from 'components/errors/TaskNotFound';
import DeploymentNotFound from 'components/errors/DeploymentNotFound';
import ProjectNotFound from 'components/errors/ProjectNotFound';
import BillingGroupNotFound from 'components/errors/BillingGroupNotFound';
import renderWhile from 'lib/renderWhile';

const noProp = R.complement(R.prop);
const noEnvironmentData = noProp('environment');
const noProjectData = noProp('project');
const noBillingGroupData = noProp('group');

export const withEnvironmentRequired = renderWhile(
  ({ data }) => noEnvironmentData(data),
  EnvironmentNotFound
);

export const withTaskRequired = renderWhile(
  ({ data: { environment } }) => !environment.tasks.length,
  TaskNotFound
);

export const withDeploymentRequired = renderWhile(
  ({ data: { environment } }) => !environment.deployments.length,
  DeploymentNotFound
);

export const withProjectRequired = renderWhile(
  ({ data }) => noProjectData(data),
  ProjectNotFound
);

export const withBillingGroupRequired = renderWhile(
  ({ data }) => noBillingGroupData(data),
  BillingGroupNotFound
);