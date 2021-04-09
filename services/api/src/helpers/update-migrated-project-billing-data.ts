// npx ts-node src/helpers/update-migrated-project-billing-data.ts [MIGRATED-PROJECT-TO-UPDATE]-old
import {
  updateEnvironment,
  updateProjectMetadata,
  updateProjectBillingGroup,
  addOrUpdateEnvironmentStorage,
  fetchOldAndNewProjectData,
  updateDeletedEnvironmentProjectId
} from './graphqlQueries';

export const updateProject = async name => {
  const project = { name };

  console.log(`UPDATING ${project.name}`);

  const { oldProject, newProject } = await fetchOldAndNewProjectData({
    name: name
  });
  // If we can't find the new project, skip to the next
  if (!newProject) {
    console.log(`NEW PROJECT NOT FOUND: ${project.name}`);
    return;
  }

  // CHECK METADATA TO SEE IF IT'S ALREADY BEEN MIGRATED
  if (oldProject && oldProject.metadata) {
    const metadata = JSON.parse(oldProject.metadata);
    if (metadata.migrated === true || metadata.migrated === 'true') {
      console.log(`PROJECT ALREADY MIGRATED: ${project.name}`);
      return;
    }
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
        // console.log('skipping new data');
        return;
      }

      console.log(
        `Add old storage data to new: ${environmentOld.id} : ${environmentNew.id}`
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
      key: 'migrated',
      value: 'true'
    }
  };

  try {
    await updateProjectMetadata(updateProjectInput);
    console.log(`SUCCESS - ${oldProject.name} storage data has been migrated`);
  } catch (error) {
    console.debug(error);
  }
};

const args = process.argv.slice(2);
if (args[0].length > 0) {
  updateProject(args[0]);
} else {
  console.log('you must pass in a project name');
}
