// npx ts-node src/helpers/update-billing-data.ts

import { promisify } from 'util';
import axios, { AxiosResponse, AxiosInstance } from 'axios';

const exec = promisify(require('child_process').exec);

let axiosInstance: AxiosInstance;

const requestConfig = (token) => ({
  baseURL: 'https://api.lagoon.amazeeio.cloud/graphql',
  timeout: 60000,
  headers: {
    Authorization:
    `Bearer ${token}`,
    'content-type': 'application/json'
  }
});

export const initializeGraphQL = async () => {
  // GET JWT Token
  const token = 'API-GRAPHQL-TOKEN-HERE'
  const config = requestConfig(token);
  axiosInstance = axios.create(config);
  return axiosInstance;
}


type DataResult = {
  data: {
    [key: string] : any
  };
  errors?: any;
  // [key: string]: Project | Group;
};

type AxiosResponseGraphQL = Promise<AxiosResponse<DataResult>>;
type AxiosGraphQL = (query: String, variables?: any) => AxiosResponseGraphQL;

const graphql: AxiosGraphQL = async (query: String, variables?: any) => {
  if (!axiosInstance){
    await initializeGraphQL()
  }
  return axiosInstance.post('/graphql', {
    query,
    ...(variables ? { variables } : {})
  });
}

const ALL_PROJECTS = `
  query allProjects {
    allProjects{
      id, name
    }
  }
`;


export const PROJECT_BY_NAME = `
query projectByName($name:String!) {
  projectByName(name:$name){
    id
    name
    created
    environments{
      id
      name
      created
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

export const PROJECT_BY_NAME_SIMPLE = `
query projectByName($name:String!) {
  projectByName(name:$name){
    id
    name
    created
    environments{
      id
      name
      created
      openshiftProjectName
    }
  }
}
`;

export const ADD_OR_UPDATE_ENVIRONMENT_STORAGE = `
mutation addOrUpdateEnvironmentStorage($input: AddOrUpdateEnvironmentStorageInput!) {
  addOrUpdateEnvironmentStorage(input:$input){
    id
  }
}`;

export const allProjects = () => graphql(ALL_PROJECTS);
export const projectByName = ( name: string, query: string) => graphql(query, { name });


// export const addOrUpdateEnvironmentStorage = (input) => graphql(ADD_OR_UPDATE_ENVIRONMENT_STORAGE, { input })

// TESTING - comment the above
export const addOrUpdateEnvironmentStorage = (input) => {
  console.log('UPDATE THE FOLLOWING')
  console.table(input)
}



const main = async () => {
  const { data: allProjectsData } = await allProjects();

  if (!allProjectsData.data.allProjects) {
    throw new Error(allProjectsData.errors[0].message);
  }

  // get all migrated projects - projects that have `-old`
  const oldProjects = allProjectsData.data.allProjects.filter(({name}) => name.includes('old'))

  // loop over each "old" projects
  oldProjects.forEach(async project => {

    // get the full data for the project, including the storage data
    const { data: projectByNameData} = await projectByName(project.name, PROJECT_BY_NAME);

    // Get the Environment creation date for the NEW project/environment - used for limiting the update so we don't copy over existing new data
    const { data: newProjectByNameData } = await projectByName(project.name.replace('-old', ''), PROJECT_BY_NAME_SIMPLE);

    if (!newProjectByNameData.data.projectByName){
      return;
    }
    const newProjectCreatedDate = new Date(newProjectByNameData.data.projectByName.created); // format: "2019-07-22 00:22:31",
    console.log(`${project.name} PROJECT CREATED DATE: ${newProjectCreatedDate}`)

    const environments = projectByNameData.data.projectByName.environments;

    environments.forEach( environment => {
      environment.storages.forEach(async storage => {

        // don't copy over existing new data
        if (new Date(storage.updated) > newProjectCreatedDate) {
          console.log('skipping new data')
          return;
        }

        // addOrUpdateEnvironmentStorage
        const input = {
          environment: environment.id,
          persistentStorageClaim: storage.persistentStorageClaim,
          bytesUsed: storage.bytesUsed,
          updated: storage.updated
        };
        const result = await addOrUpdateEnvironmentStorage(input)
      });
    });

  });
}

main();