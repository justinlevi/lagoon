import { promisify } from 'util';
import axios, { AxiosResponse, AxiosInstance } from 'axios';

const TESTING = false;

const exec = promisify(require('child_process').exec);

let axiosInstance: AxiosInstance;

const requestConfig = token => ({
  baseURL: 'https://api.lagoon.amazeeio.cloud',
  timeout: 60000,
  headers: {
    Authorization: `Bearer ${token}`,
    'content-type': 'application/json'
  }
});

const initializeGraphQL = async () => {
  // ENTER ADMIN TOKEN
  const token = '';
  const config = requestConfig(token);
  axiosInstance = axios.create(config);
  return axiosInstance;
};

type DataResult = {
  data: {
    [key: string]: any;
  };
  errors?: any;
  // [key: string]: Project | Group;
};

type AxiosResponseGraphQL = Promise<AxiosResponse<DataResult>>;
type AxiosGraphQL = (query: String, variables?: any) => AxiosResponseGraphQL;

export const graphql: AxiosGraphQL = async (query: String, variables?: any) => {
  if (!axiosInstance) {
    await initializeGraphQL();
  }
  return axiosInstance.post('/graphql', {
    query,
    ...(variables ? { variables } : {})
  });
};

export const ALL_PROJECTS_QUERY = `
  query allProjects {
    allProjects{
      id, name
    }
  }
`;

export const PROJECT_BY_NAME_QUERY = `
query projectByName($name: String!) {
  projectByName(name: $name){
    id
    name
    created
    metadata
    environments (includeDeleted: true){
      id
      name
      created
      deleted
      openshiftProjectName
      storages{
        id
        updated
        bytesUsed
        persistentStorageClaim
      }
    }
  }
}
`;

export const PROJECT_BY_NAME_SIMPLIFIED_QUERY = `
query projectByName($name: String!) {
  projectByName(name: $name){
    id
    name
    created
    metadata
    environments (includeDeleted: true){
      id
      name
      created
      deleted
      openshiftProjectName
    }
  }
}
`;

export const ADD_OR_UPDATE_ENVIRONMENT_STORAGE_MUTATION = `
mutation addOrUpdateEnvironmentStorage($input: AddOrUpdateEnvironmentStorageInput!) {
  addOrUpdateEnvironmentStorage(input: $input){
    id
  }
}
`;

export const UPDATE_ENVIRONMENT_MUTATION = `
mutation updateEnvironment($input: UpdateEnvironmentInput!) {
  updateEnvironment(input: $input){
    id
  }
}
`;

export const UPDATE_PROJECT_BILLING_GROUP = `
mutation updateProjectBillingGroup($input: ProjectBillingGroupInput) {
  updateProjectBillingGroup(input: $input){
    id
    name
  }
}
`;

export const UPDATE_PROJECT_METADATA = `
mutation updateProjectMetadata($input: UpdateMetadataInput!) {
  updateProjectMetadata(input: $input){
    id, name, availability
  }
}
`;

export const allProjects = () => graphql(ALL_PROJECTS_QUERY);
export const projectByName = (name: string, query: string) =>
  graphql(query, { name });

const mockFn = msg => input => {
  console.log(msg);
  console.table(input);
};

// MUTATIONS BELOW - CAREFUL... Set TESTING=true above to run for real
export const addOrUpdateEnvironmentStorage = TESTING
  ? mockFn(`MOCK FN - UPDATING Environment Storage...`)
  : input => graphql(ADD_OR_UPDATE_ENVIRONMENT_STORAGE_MUTATION, { input });

export const updateEnvironment = TESTING
  ? mockFn('MOCK FN - UPDATING Environment...')
  : input => graphql(UPDATE_ENVIRONMENT_MUTATION, { input });

export const updateProjectBillingGroup = TESTING
  ? mockFn('MOCK FN - UPDATING Project Billing Group...')
  : input => graphql(UPDATE_PROJECT_BILLING_GROUP, { input });

export const updateProjectMetadata = TESTING
  ? mockFn('MOCK FN - UPDATING Project Metadata...')
  : input => graphql(UPDATE_PROJECT_METADATA, { input });

export const fetchOldProjects = async () => {
  const { data: allProjectsData } = await allProjects();
  if (!allProjectsData.data.allProjects) {
    throw new Error(allProjectsData.errors[0].message);
  }

  // get all migrated projects - projects that have `-old`
  const oldProjects = allProjectsData.data.allProjects.filter(({ name }) =>
    name.includes('old')
  );
  return oldProjects;
};

export const fetchOldAndNewProjectData = async project => {
  // get the full data for the project, including the storage data
  const { data: oldProjectByNameData } = await projectByName(
    project.name,
    PROJECT_BY_NAME_QUERY
  );

  // Get the Environment creation date for the NEW project/environment - used for limiting the update so we don't copy over existing new data
  const { data: newProjectByNameData } = await projectByName(
    project.name.replace('-old', ''),
    PROJECT_BY_NAME_SIMPLIFIED_QUERY
  );

  return {
    oldProject: oldProjectByNameData.data.projectByName,
    newProject: newProjectByNameData.data.projectByName
      ? newProjectByNameData.data.projectByName
      : undefined
  };
};

export const updateDeletedEnvironmentProjectId = async (
  environment,
  projectId
) => {
  if (environment.deleted === '0000-00-00 00:00:00') {
    try {
      const updateDeletedEnvironmentInput = {
        id: environment.id,
        patch: {
          project: projectId
        }
      };
      const updateDeletedEnvironmentProjectId = await updateEnvironment(
        updateDeletedEnvironmentInput
      );
    } catch (error) {
      console.debug(error);
    }
  }
};
