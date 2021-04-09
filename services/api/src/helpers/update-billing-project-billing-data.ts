// npx ts-node src/helpers/update-billing-project-billing-data.ts [MIGRATED-PROJECT-TO-UPDATE]-old

import { promisify } from 'util';
import axios, { AxiosResponse, AxiosInstance } from 'axios';

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
  // GET JWT Token
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

const graphql: AxiosGraphQL = async (query: String, variables?: any) => {
  if (!axiosInstance) {
    await initializeGraphQL();
  }
  return axiosInstance.post('/graphql', {
    query,
    ...(variables ? { variables } : {})
  });
};

// const ALL_PROJECTS_QUERY = `
//   query allProjects {
//     allProjects{
//       id, name
//     }
//   }
// `;

const PROJECT_BY_NAME_QUERY = `
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

const PROJECT_BY_NAME_SIMPLIFIED_QUERY = `
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

const ADD_OR_UPDATE_ENVIRONMENT_STORAGE_MUTATION = `
mutation addOrUpdateEnvironmentStorage($input: AddOrUpdateEnvironmentStorageInput!) {
  addOrUpdateEnvironmentStorage(input: $input){
    id
  }
}
`;

const UPDATE_ENVIRONMENT_MUTATION = `
mutation updateEnvironment($input: UpdateEnvironmentInput!) {
  updateEnvironment(input: $input){
    id
  }
}
`;

const UPDATE_PROJECT_BILLING_GROUP = `
mutation updateProjectBillingGroup($input: ProjectBillingGroupInput) {
  updateProjectBillingGroup(input: $input){
    id
    name
  }
}
`;

const UPDATE_PROJECT_METADATA = `
mutation updateProjectMetadata($input: UpdateProjectInput!) {
  updateProject(input: $input){
    id, name, availability
  }
}
`;

// const allProjects = () => graphql(ALL_PROJECTS_QUERY);
const projectByName = (name: string, query: string) => graphql(query, { name });

// MUTATIONS BELOW - CAREFUL... COMMENT THESE OUT FOR TESTING IN FAVOR OF MOCKS
// const addOrUpdateEnvironmentStorage = (input) => graphql(ADD_OR_UPDATE_ENVIRONMENT_STORAGE_MUTATION, { input });
// const updateEnvironment = (input) => graphql(UPDATE_ENVIRONMENT_MUTATION, { input });
// const updateProjectBillingGroup = (input) => graphql(UPDATE_PROJECT_BILLING_GROUP, { input });
// const updateProjectMetadata = (input) => graphql(UPDATE_PROJECT_METADATA, { input });

//TESTING - Uncomment out the below
const addOrUpdateEnvironmentStorage = input => {
  console.log(`MOCK FN - UPDATING Environment Storage...`);
  console.table(input);
};

const updateEnvironment = input => {
  console.log('MOCK FN - UPDATING Environment...');
  console.table(input);
};

const updateProjectBillingGroup = input => {
  console.log('MOCK FN - UPDATING Project Billing Group...');
  console.table(input);
};

const updateProjectMetadata = input => {
  console.log('MOCK FN - UPDATING Project Metadata...');
  console.table(input);
};

const fetchOldAndNewProjectData = async project => {
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

const updateDeletedEnvironmentProjectId = async (environment, projectId) => {
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

const main = async arg => {
  const project = {
    name: arg
  };

  console.log(`UPDATING ${project.name}`);

  const { oldProject, newProject } = await fetchOldAndNewProjectData({
    name: arg
  });
  // If we can't find the new project, skip to the next
  if (!newProject) {
    throw new Error('NEW PROJECT NOT FOUND');
  }

  // CHECK METADATA TO SEE IF IT'S ALREADY BEEN MIGRATED
  if (oldProject && oldProject.metadata && oldProject.metadata.migrated) {
    throw new Error('PROJECT ALREADY MIGRATED');
  }

  const newProjectCreatedDate = new Date(newProject.created); // format: "2019-07-22 00:22:31",
  console.log(`${project.name} PROJECT CREATED DATE: ${newProjectCreatedDate}`);

  const environmentsOld = oldProject.environments;
  const environmentsNew = newProject.environments;

  environmentsOld.forEach(async environmentOld => {
    // Update the project ID of deleted environments to point from the -old project to the new one
    await updateDeletedEnvironmentProjectId(environmentOld, newProject.id);

    // Get the new environment ID value
    const environmentNew = environmentsNew.find(
      o => o.name === environmentOld.name
    );
    if (environmentNew === undefined) {
      console.log(
        'The old environment name was not found on the new project environment!??'
      );
      return;
    }

    environmentOld.storages.forEach(async storage => {
      // don't copy over existing new data
      if (new Date(storage.updated) > newProjectCreatedDate) {
        console.log('skipping new data');
        return;
      }

      console.log(
        `Add the old storage data to the new environment: ${environmentOld.id} : ${environmentNew.id}`
      );

      // addOrUpdateEnvironmentStorage
      try {
        const addOrUpdateEnvironmentStorageInput = {
          environment: environmentNew.id,
          persistentStorageClaim: storage.persistentStorageClaim,
          bytesUsed: storage.bytesUsed,
          updated: storage.updated
        };
        await addOrUpdateEnvironmentStorage(addOrUpdateEnvironmentStorageInput);
      } catch (error) {
        console.debug(error);
      }

      // Update the created date of the new environment to match the old one
      try {
        const updateEnvironmentInput = {
          id: environmentNew.id,
          patch: {
            created: environmentOld.created
          }
        };
        await updateEnvironment(updateEnvironmentInput);
      } catch (error) {
        console.debug(error);
      }
    });
  });

  // Move the -old project to the `migration -old - DISREGARD` billing group
  const projectBillingGroupInput = {
    group: { name: 'migration -old - DISREGARD' },
    project: { name: oldProject.name }
  };
  try {
    await updateProjectBillingGroup(projectBillingGroupInput);
  } catch (error) {
    console.debug(error);
  }

  // ADD "migrated:true" TO -OLD && NEW PROJECT METADATA
  const updateProjectInput = {
    id: oldProject.id,
    patch: {
      metadata: {
        migrated: true
      }
    }
  };
  try {
    await updateProjectMetadata(updateProjectInput);
  } catch (error) {
    console.debug(error);
  }
};

const args = process.argv.slice(2);
if (args[0].length > 0) {
  main(args[0]);
}
