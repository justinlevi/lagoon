// npx ts-node src/helpers/update-all-migrated-projects-billing-data.ts 2
import { fetchOldProjects } from './graphqlQueries';
import { updateProject } from './update-migrated-project-billing-data';

const main = async (numProjectsToProcess: number = undefined) => {
  const oldProjects = await fetchOldProjects();

  const len = numProjectsToProcess ? numProjectsToProcess : oldProjects.length;
  // loop over each "old" projects
  for (let i = 0; i < len; i++) {
    const project = oldProjects[i];
    console.log(`UPDATING ${project.name}`);

    if (project && project.name) {
      updateProject(project.name);
    }
  }
};

const args = process.argv.slice(2);
if (args[0].length > 0) {
  main(parseInt(args[0], 10));
} else {
  main();
}
